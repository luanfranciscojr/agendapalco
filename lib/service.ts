import {
  BookingOrigin,
  BookingStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import type { AuthUser } from "@/lib/auth";
import {
  CONFIG_KEY_MAX_REQUESTS,
  DEFAULT_MAX_REQUESTS_PER_WEEK,
  SLOT_HOURS,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  ACTIVE_STATUSES,
  canCreateWeeklyRequest,
  getReviewStatus,
  hasDuplicateSlots,
  validateSlotsInCurrentWeek,
  validateWeekStart,
} from "@/lib/rules";
import { dateKeyToUtcDate, getCurrentWeekContext, parseSlotKey, buildSlotKey } from "@/lib/time";
import type { DashboardData, PublicPanelData } from "@/lib/types";
import { validateHour } from "@/lib/validators";
import { parsePublicReviewToken } from "@/lib/public-review";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type NotificationTarget = {
  recipientName: string;
  phone: string;
};

type ApprovedSlotNotification = NotificationTarget & {
  dateKey: string;
  hour: number;
};

type PendingAdminNotification = NotificationTarget & {
  requestId: string;
  ministryName: string;
  dateKey: string;
  hour: number;
};

type CreateBookingInput = {
  ministryId: string;
  slotKeys: string[];
  submissionMode: "pending" | "approved";
  reviewNote?: string;
};

type ReviewBookingInput = {
  approvedSlotKeys: string[];
  reviewNote?: string;
};

function canCancelRequest(currentUser: AuthUser, request: {
  ministryId: string;
  status: BookingStatus;
}) {
  if (currentUser.role === "admin") {
    return !["rejected", "cancelled"].includes(request.status);
  }

  return (
    currentUser.ministryId === request.ministryId &&
    request.status === "pending"
  );
}

function getWeekDatesOrThrow(slotKeys: string[]) {
  if (!slotKeys.length || !validateSlotsInCurrentWeek(slotKeys)) {
    throw new AppError("Somente a semana atual pode ser usada.", 422);
  }

  if (hasDuplicateSlots(slotKeys)) {
    throw new AppError("Não repita horários no mesmo agendamento.", 422);
  }

  const parsed = slotKeys.map(parseSlotKey);
  if (!parsed.every(({ hour }) => validateHour(hour))) {
    throw new AppError("Use apenas blocos de 1 hora dentro da agenda configurada.", 422);
  }
  const weekStart = getCurrentWeekContext().weekStart;

  return {
    weekStart,
    parsed,
  };
}

async function getMaxRequestsPerWeek(db: PrismaClient | Prisma.TransactionClient) {
  const config = await db.systemConfig.findUnique({
    where: { key: CONFIG_KEY_MAX_REQUESTS },
  });

  return Number(config?.value ?? DEFAULT_MAX_REQUESTS_PER_WEEK);
}

async function acquireWeeklyMinistryLock(
  db: Prisma.TransactionClient,
  ministryId: string,
  weekStart: string,
) {
  const lockName = `booking:${ministryId}:${weekStart}`;
  const result = await db.$queryRaw<Array<{ lockStatus: number | bigint | null }>>`
    SELECT GET_LOCK(${lockName}, 5) AS lockStatus
  `;
  const lockStatus = Number(result[0]?.lockStatus ?? 0);

  if (lockStatus !== 1) {
    throw new AppError(
      "Não foi possível confirmar sua solicitação agora. Tente novamente.",
      409,
    );
  }

  return lockName;
}

async function releaseWeeklyMinistryLock(
  db: Prisma.TransactionClient,
  lockName: string,
) {
  await db.$queryRaw<Array<{ releaseStatus: number | bigint | null }>>`
    SELECT RELEASE_LOCK(${lockName}) AS releaseStatus
  `;
}

function mapRequest(request: Prisma.BookingRequestGetPayload<{
  include: {
    ministry: true;
    requestedSlots: true;
    reservedSlots: true;
  };
}>) {
  const normalizedStatus =
    request.reservedSlots.length === 0 &&
    request.reviewNote?.toLowerCase().includes("cancelado")
      ? BookingStatus.cancelled
      : request.status;

  return {
    id: request.id,
    ministryId: request.ministryId,
    ministryName: request.ministry.name,
    requestedByName: request.requestedByName,
    origin: request.origin,
    status: normalizedStatus,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt.toISOString(),
    requestedSlotKeys: request.requestedSlots.map((slot) =>
      buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
    ),
    reservedSlotKeys: request.reservedSlots.map((slot) =>
      buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
    ),
  };
}

function uniqueNotifications(
  notifications: ApprovedSlotNotification[],
) {
  const seen = new Set<string>();

  return notifications.filter((notification) => {
    const key = `${notification.phone}:${notification.dateKey}:${notification.hour}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function sendApprovedSlotNotifications(
  notifications: ApprovedSlotNotification[],
) {
  const unique = uniqueNotifications(notifications);

  await Promise.all(
    unique.map(async (notification) => {
      try {
        await sendWhatsAppTemplate("approved", notification);
      } catch (error) {
        console.error("Falha ao enviar WhatsApp de aprovação:", error);
      }
    }),
  );
}

async function sendRejectedSlotNotifications(
  notifications: ApprovedSlotNotification[],
) {
  const unique = uniqueNotifications(notifications);

  await Promise.all(
    unique.map(async (notification) => {
      try {
        await sendWhatsAppTemplate("rejected", notification);
      } catch (error) {
        console.error("Falha ao enviar WhatsApp de reprovação/cancelamento:", error);
      }
    }),
  );
}

async function sendPendingAdminNotifications(
  notifications: PendingAdminNotification[],
) {
  const seen = new Set<string>();
  const unique = notifications.filter((notification) => {
    const key = `${notification.phone}:${notification.ministryName}:${notification.dateKey}:${notification.hour}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  await Promise.all(
    unique.map(async (notification) => {
      try {
        await sendWhatsAppTemplate("pending_admin", notification);
      } catch (error) {
        console.error("Falha ao enviar WhatsApp para admin:", error);
      }
    }),
  );
}

async function getMinistryNotificationTargets(
  db: PrismaClient | Prisma.TransactionClient,
  ministryId: string,
) {
  const users = await db.user.findMany({
    where: {
      ministryId,
      role: "ministry",
      whatsappPhone: {
        not: null,
      },
    },
    select: {
      name: true,
      whatsappPhone: true,
    },
  });

  return users
    .filter((user) => Boolean(user.whatsappPhone))
    .map((user) => ({
      recipientName: user.name,
      phone: user.whatsappPhone as string,
    }));
}

async function getAdminNotificationTargets(
  db: PrismaClient | Prisma.TransactionClient,
) {
  const users = await db.user.findMany({
    where: {
      role: "admin",
      whatsappPhone: {
        not: null,
      },
    },
    select: {
      name: true,
      whatsappPhone: true,
    },
  });

  return users
    .filter((user) => Boolean(user.whatsappPhone))
    .map((user) => ({
      recipientName: user.name,
      phone: user.whatsappPhone as string,
    }));
}

function buildApprovedSlotNotifications(
  targets: NotificationTarget[],
  slotKeys: string[],
  ministryName?: string,
) {
  return slotKeys.flatMap((slotKey) => {
    const { dateKey, hour } = parseSlotKey(slotKey);

    return targets.map((target) => ({
      ...target,
      ministryName,
      dateKey,
      hour,
    }));
  });
}

function buildPendingAdminNotifications(
  targets: NotificationTarget[],
  requestId: string,
  ministryName: string,
  slotKeys: string[],
) {
  return slotKeys.flatMap((slotKey) => {
    const { dateKey, hour } = parseSlotKey(slotKey);

    return targets.map((target) => ({
      ...target,
      requestId,
      ministryName,
      dateKey,
      hour,
    }));
  });
}

export async function getDashboardData(currentUser: AuthUser): Promise<DashboardData> {
  const { weekStart, today, days } = getCurrentWeekContext();
  await prisma.$executeRaw`
    UPDATE BookingRequest br
    LEFT JOIN ReservedSlot rs ON rs.bookingRequestId = br.id
    SET br.status = 'cancelled'
    WHERE br.status IN ('pending', 'approved')
      AND rs.id IS NULL
      AND br.reviewNote IS NOT NULL
      AND LOWER(br.reviewNote) LIKE '%cancelado%'
  `;
  const [config, ministries, requests, reservedSlots] = await Promise.all([
    prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY_MAX_REQUESTS },
    }),
    prisma.ministry.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.bookingRequest.findMany({
      where: {
        weekStart: dateKeyToUtcDate(weekStart),
        ...(currentUser.role === "ministry"
          ? { ministryId: currentUser.ministryId ?? "__blocked__" }
          : {}),
      },
      include: {
        ministry: true,
        requestedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
        reservedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.reservedSlot.findMany({
      where: {
        slotDate: {
          gte: dateKeyToUtcDate(days[0]),
          lte: dateKeyToUtcDate(days[days.length - 1]),
        },
      },
      include: {
        bookingRequest: {
          include: {
            ministry: true,
          },
        },
      },
      orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
    }),
  ]);

  return {
    currentUser,
    weekStart,
    today,
    days,
    slotHours: SLOT_HOURS,
    maxRequestsPerMinistryPerWeek: Number(
      config?.value ?? DEFAULT_MAX_REQUESTS_PER_WEEK,
    ),
    ministries: ministries.map((ministry) => ({
      id: ministry.id,
      name: ministry.name,
    })),
    requests: requests.map(mapRequest),
    reservations: reservedSlots.map((slot) => ({
      slotKey: buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
      dateKey: slot.slotDate.toISOString().slice(0, 10),
      hour: slot.hour,
      requestId: slot.bookingRequestId,
      ministryId: slot.bookingRequest.ministryId,
      ministryName: slot.bookingRequest.ministry.name,
      requestedByName: slot.bookingRequest.requestedByName,
      status: slot.bookingRequest.status,
    })),
  };
}

export async function getPublicPanelData(): Promise<PublicPanelData> {
  const { weekStart, today, days } = getCurrentWeekContext();
  const reservedSlots = await prisma.reservedSlot.findMany({
    where: {
      slotDate: {
        gte: dateKeyToUtcDate(days[0]),
        lte: dateKeyToUtcDate(days[days.length - 1]),
      },
    },
    include: {
      bookingRequest: {
        include: {
          ministry: true,
        },
      },
    },
    orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
  });

  return {
    weekStart,
    today,
    days,
    slotHours: SLOT_HOURS,
    reservations: reservedSlots.map((slot) => ({
      slotKey: buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
      dateKey: slot.slotDate.toISOString().slice(0, 10),
      hour: slot.hour,
      requestId: slot.bookingRequestId,
      ministryId: slot.bookingRequest.ministryId,
      ministryName: slot.bookingRequest.ministry.name,
      requestedByName: slot.bookingRequest.requestedByName,
      status: slot.bookingRequest.status,
    })),
  };
}

export async function getAvailability(weekStart?: string) {
  if (weekStart && !validateWeekStart(weekStart)) {
    throw new AppError("Somente a semana atual pode ser consultada.", 422);
  }

  throw new AppError("Use a agenda autenticada para consultar disponibilidade.", 401);
}

function getCreatePayloadForUser(currentUser: AuthUser, input: CreateBookingInput) {
  if (currentUser.role === "ministry") {
    if (!currentUser.ministryId) {
      throw new AppError("Seu usuário não está vinculado a um ministério.", 403);
    }

    return {
      role: "ministry" as const,
      ministryId: currentUser.ministryId,
      requesterName: currentUser.name,
      submissionMode: "pending" as const,
    };
  }

  return {
    role: "admin" as const,
    ministryId: input.ministryId,
    requesterName: currentUser.name,
    submissionMode: input.submissionMode,
  };
}

export async function createBookingRequest(currentUser: AuthUser, input: CreateBookingInput) {
  const payload = getCreatePayloadForUser(currentUser, input);
  const { weekStart, parsed } = getWeekDatesOrThrow(input.slotKeys);

  if (currentUser.role === "ministry" && !currentUser.whatsappPhone?.trim()) {
    throw new AppError(
      "Cadastre e salve seu WhatsApp antes de enviar o primeiro agendamento.",
      409,
    );
  }

  let notifications: ApprovedSlotNotification[] = [];
  let pendingAdminNotifications: PendingAdminNotification[] = [];

  const created = await prisma.$transaction(async (tx) => {
    const maxRequestsPerWeek = await getMaxRequestsPerWeek(tx);
    let weeklyLockName: string | null = null;

    try {
      if (payload.role === "ministry") {
        weeklyLockName = await acquireWeeklyMinistryLock(
          tx,
          payload.ministryId,
          weekStart,
        );

        const activeCount = await tx.bookingRequest.count({
          where: {
            ministryId: payload.ministryId,
            weekStart: dateKeyToUtcDate(weekStart),
            status: { in: ACTIVE_STATUSES },
            reservedSlots: {
              some: {},
            },
          },
        });

        if (!canCreateWeeklyRequest(activeCount, maxRequestsPerWeek)) {
          throw new AppError("Este ministério já usou a tentativa da semana atual.", 409);
        }
      }

      const conflicts = await tx.reservedSlot.findMany({
        where: {
          OR: parsed.map(({ dateKey, hour }) => ({
            slotDate: dateKeyToUtcDate(dateKey),
            hour,
          })),
        },
        include: {
          bookingRequest: {
            include: { ministry: true },
          },
        },
      });

      if (conflicts.length) {
        const conflict = conflicts[0];
        throw new AppError(
          `Horário ocupado por ${conflict.bookingRequest.ministry.name}.`,
          409,
        );
      }

      const status =
        payload.role === "admin" && payload.submissionMode === "approved"
          ? BookingStatus.approved
          : BookingStatus.pending;
      const origin =
        payload.role === "admin"
          ? BookingOrigin.admin_created
          : BookingOrigin.ministry_request;

      const bookingRequest = await tx.bookingRequest.create({
        data: {
          ministryId: payload.ministryId,
          requestedByName: payload.requesterName,
          origin,
          status,
          reviewNote: payload.role === "admin" ? input.reviewNote || null : null,
          weekStart: dateKeyToUtcDate(weekStart),
          requestedSlots: {
            create: parsed.map(({ dateKey, hour }) => ({
              slotDate: dateKeyToUtcDate(dateKey),
              hour,
            })),
          },
          reservedSlots: {
            create: parsed.map(({ dateKey, hour }) => ({
              slotDate: dateKeyToUtcDate(dateKey),
              hour,
            })),
          },
        },
        include: {
          ministry: true,
          requestedSlots: true,
          reservedSlots: true,
        },
      });

      if (status === BookingStatus.approved) {
        const targets = await getMinistryNotificationTargets(tx, payload.ministryId);
        notifications = buildApprovedSlotNotifications(
          targets,
          bookingRequest.reservedSlots.map((slot) =>
            buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
          ),
          bookingRequest.ministry.name,
        );
      }

      if (status === BookingStatus.pending && origin === BookingOrigin.ministry_request) {
        const adminTargets = await getAdminNotificationTargets(tx);
        pendingAdminNotifications = buildPendingAdminNotifications(
          adminTargets,
          bookingRequest.id,
          bookingRequest.ministry.name,
          bookingRequest.reservedSlots.map((slot) =>
            buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
          ),
        );
      }

      return mapRequest(bookingRequest);
    } finally {
      if (weeklyLockName) {
        await releaseWeeklyMinistryLock(tx, weeklyLockName);
      }
    }
  });

  await sendApprovedSlotNotifications(notifications);
  await sendPendingAdminNotifications(pendingAdminNotifications);

  return created;
}

export async function reviewBookingRequest(requestId: string, input: ReviewBookingInput) {
  let notifications: ApprovedSlotNotification[] = [];
  let rejectedNotifications: ApprovedSlotNotification[] = [];

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const bookingRequest = await tx.bookingRequest.findUnique({
      where: { id: requestId },
      include: {
        ministry: true,
        requestedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
        reservedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
      },
    });

    if (!bookingRequest) {
      throw new AppError("Agendamento não encontrado.", 404);
    }

    if (bookingRequest.status !== BookingStatus.pending) {
      throw new AppError("Somente agendamentos pendentes podem ser revisados.", 409);
    }

    const requestedSlotKeys = bookingRequest.requestedSlots.map((slot) =>
      buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
    );
    const approvedSet = new Set(input.approvedSlotKeys);

    if (!validateSlotsInCurrentWeek(input.approvedSlotKeys)) {
      throw new AppError("Aprovação fora da semana atual não é permitida.", 422);
    }

    for (const slotKey of input.approvedSlotKeys) {
      if (!requestedSlotKeys.includes(slotKey)) {
        throw new AppError("A aprovação deve usar apenas o horário solicitado.", 422);
      }
    }

    const chosenSlots = input.approvedSlotKeys.map(parseSlotKey);
    if (!chosenSlots.every(({ hour }) => validateHour(hour))) {
      throw new AppError("Um dos horários aprovados é inválido.", 422);
    }
    if (chosenSlots.length) {
      const conflicts = await tx.reservedSlot.findMany({
        where: {
          bookingRequestId: { not: requestId },
          OR: chosenSlots.map(({ dateKey, hour }) => ({
            slotDate: dateKeyToUtcDate(dateKey),
            hour,
          })),
        },
      });

      if (conflicts.length) {
        throw new AppError("Um dos horários escolhidos foi ocupado enquanto você revisava.", 409);
      }
    }

    const nextStatus = getReviewStatus(
      input.approvedSlotKeys.length,
    );

    if (nextStatus === "rejected") {
      await tx.reservedSlot.deleteMany({
        where: { bookingRequestId: requestId },
      });
    } else {
      const slotsToRemove = bookingRequest.reservedSlots.filter((slot) => {
        const slotKey = buildSlotKey(
          slot.slotDate.toISOString().slice(0, 10),
          slot.hour,
        );
        return !approvedSet.has(slotKey);
      });

      if (slotsToRemove.length) {
        await tx.reservedSlot.deleteMany({
          where: {
            id: {
              in: slotsToRemove.map((slot) => slot.id),
            },
          },
        });
      }
    }

    const updated = await tx.bookingRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        reviewNote: input.reviewNote || null,
      },
      include: {
        ministry: true,
        requestedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
        reservedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
      },
    });

    if (updated.status === BookingStatus.approved) {
      const targets = await getMinistryNotificationTargets(tx, updated.ministryId);
      notifications = buildApprovedSlotNotifications(
        targets,
        updated.reservedSlots.map((slot) =>
          buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
        ),
        updated.ministry.name,
      );
    }

    if (updated.status === BookingStatus.rejected) {
      const targets = await getMinistryNotificationTargets(tx, updated.ministryId);
      rejectedNotifications = buildApprovedSlotNotifications(
        targets,
        bookingRequest.requestedSlots.map((slot) =>
          buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
        ),
        updated.ministry.name,
      );
    }

    return mapRequest(updated);
  });

  await sendApprovedSlotNotifications(notifications);
  await sendRejectedSlotNotifications(rejectedNotifications);

  return updatedRequest;
}

export async function reviewBookingRequestByPublicLink(token: string) {
  const payload = parsePublicReviewToken(token);
  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: payload.requestId },
    include: {
      ministry: true,
      requestedSlots: {
        orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
      },
      reservedSlots: {
        orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
      },
    },
  });

  if (!bookingRequest) {
    throw new AppError("Agendamento não encontrado.", 404);
  }

  if (bookingRequest.status !== BookingStatus.pending) {
    return {
      alreadyProcessed: true as const,
      action: payload.action,
      request: mapRequest(bookingRequest),
    };
  }

  const approvedSlotKeys =
    payload.action === "approve"
      ? bookingRequest.requestedSlots.map((slot) =>
          buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
        )
      : [];

  const updated = await reviewBookingRequest(payload.requestId, {
    approvedSlotKeys,
    reviewNote:
      payload.action === "approve"
        ? "Aprovado por link público."
        : "Reprovado por link público.",
  });

  return {
    alreadyProcessed: false as const,
    action: payload.action,
    request: updated,
  };
}

export async function updateSystemConfig(maxRequestsPerMinistryPerWeek: number) {
  const updated = await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY_MAX_REQUESTS },
    update: {
      value: String(maxRequestsPerMinistryPerWeek),
    },
    create: {
      key: CONFIG_KEY_MAX_REQUESTS,
      value: String(maxRequestsPerMinistryPerWeek),
    },
  });

  return {
    key: updated.key,
    value: Number(updated.value),
  };
}

export async function updateOwnProfile(
  currentUser: AuthUser,
  input: { whatsappPhone: string },
) {
  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      whatsappPhone: input.whatsappPhone.trim(),
    },
    include: {
      ministry: true,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    username: updated.username,
    whatsappPhone: updated.whatsappPhone,
    role: updated.role,
    ministryId: updated.ministryId,
    ministryName: updated.ministry?.name ?? null,
  } satisfies AuthUser;
}

export async function updateOwnPassword(
  currentUser: AuthUser,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new AppError("Senha atual incorreta.", 409);
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError("A nova senha deve ser diferente da senha atual.", 409);
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      passwordHash: hashPassword(input.newPassword),
    },
  });

  return { success: true as const };
}

export async function cancelBookingRequest(currentUser: AuthUser, requestId: string) {
  let rejectedNotifications: ApprovedSlotNotification[] = [];

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const bookingRequest = await tx.bookingRequest.findUnique({
      where: { id: requestId },
      include: {
        ministry: true,
        requestedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
        reservedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
      },
    });

    if (!bookingRequest) {
      throw new AppError("Agendamento não encontrado.", 404);
    }

    if (!canCancelRequest(currentUser, bookingRequest)) {
      throw new AppError("Você não pode cancelar este agendamento.", 403);
    }

    await tx.reservedSlot.deleteMany({
      where: { bookingRequestId: requestId },
    });

    const updated = await tx.bookingRequest.update({
      where: { id: requestId },
      data: {
        status: BookingStatus.cancelled,
        reviewNote:
          currentUser.role === "admin"
            ? "Agendamento cancelado pela coordenação."
            : "Solicitação cancelada pelo ministério.",
      },
      include: {
        ministry: true,
        requestedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
        reservedSlots: {
          orderBy: [{ slotDate: "asc" }, { hour: "asc" }],
        },
      },
    });

    if (currentUser.role === "admin") {
      const targets = await getMinistryNotificationTargets(tx, updated.ministryId);
      rejectedNotifications = buildApprovedSlotNotifications(
        targets,
        bookingRequest.requestedSlots.map((slot) =>
          buildSlotKey(slot.slotDate.toISOString().slice(0, 10), slot.hour),
        ),
        updated.ministry.name,
      );
    }

    return mapRequest(updated);
  });

  await sendRejectedSlotNotifications(rejectedNotifications);

  return updatedRequest;
}

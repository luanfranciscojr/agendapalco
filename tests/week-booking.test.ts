import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/lib/auth";

const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    systemConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    ministry: { findMany: vi.fn() },
    bookingRequest: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    reservedSlot: { findMany: vi.fn(), deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  createBookingRequest,
  getDashboardData,
  getPublicPanelData,
  updateWeekBookingStatus,
} from "@/lib/service";

const ministry: AuthUser = {
  id: "leader", name: "Líder CoralKids", username: "coralkids",
  role: "ministry", ministryId: "coralkids", ministryName: "CoralKids",
  whatsappPhone: "92999999999",
};
const admin: AuthUser = { ...ministry, id: "admin", role: "admin", ministryId: null };
const input = {
  ministryId: "coralkids", slotKeys: ["2026-11-05T18:00"],
  submissionMode: "pending" as const,
};
const configs = new Map<string, string>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
  configs.clear();
  db.$transaction.mockImplementation((callback) => callback(db));
  db.systemConfig.findUnique.mockImplementation(async ({ where }) =>
    configs.has(where.key) ? { value: configs.get(where.key) } : null,
  );
  db.systemConfig.upsert.mockImplementation(async ({ where, create, update }) => {
    configs.set(where.key, configs.has(where.key) ? update.value : create.value);
  });
  db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray, key: string) => {
    if (strings.join("").includes("FROM SystemConfig")) {
      return configs.has(key) ? [{ value: configs.get(key) }] : [];
    }
    return [{ lockStatus: 1, releaseStatus: 1 }];
  });
  db.ministry.findMany.mockResolvedValue([]);
  db.bookingRequest.findMany.mockResolvedValue([]);
  db.bookingRequest.count.mockResolvedValue(0);
  db.reservedSlot.findMany.mockResolvedValue([]);
  db.reservedSlot.deleteMany.mockResolvedValue({ count: 0 });
  db.user.findMany.mockResolvedValue([]);
  db.bookingRequest.create.mockImplementation(async ({ data }) => ({
    ...data, id: "booking", createdAt: new Date(), ministry: { name: "CoralKids" },
    requestedSlots: data.requestedSlots.create,
    reservedSlots: data.reservedSlots.create,
  }));
});

afterEach(() => vi.useRealTimers());

describe("weekly booking access", () => {
  it("starts closed on both dashboards and the public panel", async () => {
    expect((await getDashboardData(ministry)).isWeekOpen).toBe(false);
    expect((await getDashboardData(admin)).isWeekOpen).toBe(false);
    expect((await getPublicPanelData()).isWeekOpen).toBe(false);
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("opens and closes only the selected week without changing bookings", async () => {
    await updateWeekBookingStatus(admin, "2026-11-01", true);
    expect((await getDashboardData(ministry)).isWeekOpen).toBe(true);
    expect((await getPublicPanelData()).isWeekOpen).toBe(true);
    expect((await getDashboardData(ministry, "2026-11-08")).isWeekOpen).toBe(false);
    await updateWeekBookingStatus(admin, "2026-11-01", false);
    await updateWeekBookingStatus(admin, "2026-11-01", false);
    expect((await getPublicPanelData()).isWeekOpen).toBe(false);
    expect(db.bookingRequest.create).not.toHaveBeenCalled();
  });

  it("prevents ministries from changing weekly access", async () => {
    await expect(updateWeekBookingStatus(ministry, "2026-11-01", true))
      .rejects.toMatchObject({ status: 403 });
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
  });

  it("keeps manual blocks when releasing without the cleanup option", async () => {
    await expect(updateWeekBookingStatus(admin, "2026-11-01", true))
      .resolves.toMatchObject({ isOpen: true, removedManualSlots: 0 });
    expect(db.bookingRequest.findMany).not.toHaveBeenCalled();
    expect(db.reservedSlot.deleteMany).not.toHaveBeenCalled();
  });

  it("removes only manual blocks from the selected week and keeps their history", async () => {
    db.bookingRequest.findMany.mockResolvedValue([{ id: "manual-1" }, { id: "manual-2" }]);
    db.reservedSlot.deleteMany.mockResolvedValue({ count: 3 });

    await expect(updateWeekBookingStatus(admin, "2026-11-01", true, true))
      .resolves.toMatchObject({ isOpen: true, removedManualSlots: 3 });
    expect(db.bookingRequest.findMany).toHaveBeenCalledWith({
      where: {
        weekStart: new Date("2026-11-01T00:00:00Z"),
        ministry: { name: "__BLOQUEIO_PALCO__" },
        origin: "admin_created",
        status: { notIn: ["cancelled", "rejected"] },
        reservedSlots: { some: {} },
        OR: [
          { reviewNote: null },
          { NOT: { reviewNote: { startsWith: "Ensaio coletivo: " } } },
        ],
      },
      select: { id: true },
    });
    expect(db.reservedSlot.deleteMany).toHaveBeenCalledWith({
      where: { bookingRequestId: { in: ["manual-1", "manual-2"] } },
    });
    expect(db.bookingRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["manual-1", "manual-2"] } },
      data: {
        status: "cancelled",
        reviewNote: "Bloqueio cancelado ao liberar a semana.",
      },
    });
  });

  it("rejects cleanup while closing a week", async () => {
    await expect(updateWeekBookingStatus(admin, "2026-11-01", false, true))
      .rejects.toMatchObject({ status: 422 });
    expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    expect(db.reservedSlot.deleteMany).not.toHaveBeenCalled();
  });

  it("allows cleanup to be repeated when there are no manual blocks left", async () => {
    await expect(updateWeekBookingStatus(admin, "2026-11-01", true, true))
      .resolves.toMatchObject({ removedManualSlots: 0 });
    expect(db.reservedSlot.deleteMany).not.toHaveBeenCalled();
  });

  it("reports cleanup failures without marking blocks cancelled", async () => {
    db.bookingRequest.findMany.mockResolvedValue([{ id: "manual-1" }]);
    db.reservedSlot.deleteMany.mockRejectedValue(new Error("Database failure"));
    await expect(updateWeekBookingStatus(admin, "2026-11-01", true, true))
      .rejects.toThrow("Database failure");
    expect(db.bookingRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each(["invalid", "2026-11-02", "2026-10-25", "2027-01-03"])(
    "rejects an invalid or out-of-range week: %s", async (week) => {
      await expect(updateWeekBookingStatus(admin, week, true))
        .rejects.toMatchObject({ status: 422 });
      expect(db.systemConfig.upsert).not.toHaveBeenCalled();
    },
  );

  it("rejects requests before release and after re-blocking, even with a free slot", async () => {
    await expect(createBookingRequest(ministry, input)).rejects.toMatchObject({ status: 409 });
    await updateWeekBookingStatus(admin, "2026-11-01", true);
    await updateWeekBookingStatus(admin, "2026-11-01", false);
    await expect(createBookingRequest(ministry, input)).rejects.toMatchObject({ status: 409 });
    expect(db.bookingRequest.create).not.toHaveBeenCalled();
  });

  it("accepts requests once released and checks the week under a transaction lock", async () => {
    await updateWeekBookingStatus(admin, "2026-11-01", true);
    await expect(createBookingRequest(ministry, input)).resolves.toMatchObject({ status: "pending" });
    const [query, key] = db.$queryRaw.mock.calls[0];
    expect(query.join("")).toContain("FOR UPDATE");
    expect(key).toBe("booking_week_open:2026-11-01");
  });

  it("still enforces ministry limits and occupied slots after release", async () => {
    await updateWeekBookingStatus(admin, "2026-11-01", true);
    db.bookingRequest.count.mockResolvedValue(1);
    await expect(createBookingRequest(ministry, input)).rejects.toMatchObject({ status: 409 });
    db.bookingRequest.count.mockResolvedValue(0);
    db.reservedSlot.findMany.mockResolvedValue([{ id: "occupied" }]);
    await expect(createBookingRequest(ministry, input)).rejects.toMatchObject({ message: "Horário ocupado." });
    expect(db.bookingRequest.create).not.toHaveBeenCalled();
  });

  it("keeps direct admin bookings available in a closed week", async () => {
    await expect(createBookingRequest(admin, { ...input, submissionMode: "approved" }))
      .resolves.toMatchObject({ status: "approved", origin: "admin_created" });
  });
});

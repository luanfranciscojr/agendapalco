"use client";

import Image from "next/image";
import {
  Fragment,
  type ReactNode,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { toPng } from "html-to-image";

import {
  formatDatePtBr,
  formatDateFullPtBr,
  formatWeekdayShortPtBr,
  hourLabel,
  slotDateTimeLabel,
} from "@/lib/time";
import type { DashboardData } from "@/lib/types";

type Props = {
  data: DashboardData;
};

async function sendJson(url: string, payload?: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(json?.error || "Falha ao executar a operação.");
  }

  return json;
}

function formatWhatsappInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function StageSchedulerApp({ data }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState(data.currentUser.whatsappPhone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [configValue, setConfigValue] = useState(
    String(data.maxRequestsPerMinistryPerWeek),
  );
  const [pendingDialogRequestId, setPendingDialogRequestId] = useState<string | null>(null);
  const [directBookingSlotKey, setDirectBookingSlotKey] = useState<string | null>(null);
  const [directBookingMinistryId, setDirectBookingMinistryId] = useState(
    data.ministries[0]?.id ?? "",
  );
  const [manageReservationRequestId, setManageReservationRequestId] = useState<string | null>(
    null,
  );
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const weeklyCalendarRef = useRef<HTMLDivElement | null>(null);

  const currentUser = data.currentUser;
  const isAdmin = currentUser.role === "admin";

  const reservationsBySlot = useMemo(
    () =>
      new Map(
        data.reservations.map((reservation) => [reservation.slotKey, reservation]),
      ),
    [data.reservations],
  );

  const activeRequestsForMinistry = useMemo(
    () =>
      currentUser.ministryId
        ? data.requests.filter(
            (request) =>
              request.ministryId === currentUser.ministryId &&
              ["pending", "approved"].includes(request.status),
          )
        : [],
    [currentUser.ministryId, data.requests],
  );

  const ministryRequests = useMemo(
    () =>
      currentUser.ministryId
        ? data.requests.filter((request) => request.ministryId === currentUser.ministryId)
        : [],
    [currentUser.ministryId, data.requests],
  );

  const pendingDialogRequest = useMemo(
    () =>
      pendingDialogRequestId
        ? data.requests.find((request) => request.id === pendingDialogRequestId) ?? null
        : null,
    [data.requests, pendingDialogRequestId],
  );
  const managedReservation = useMemo(
    () =>
      manageReservationRequestId
        ? data.requests.find((request) => request.id === manageReservationRequestId) ?? null
        : null,
    [data.requests, manageReservationRequestId],
  );

  const weeklyAttemptConsumed =
    !isAdmin &&
    activeRequestsForMinistry.length >= data.maxRequestsPerMinistryPerWeek;
  const currentActiveRequest =
    !isAdmin && activeRequestsForMinistry.length > 0
      ? activeRequestsForMinistry[0]
      : null;
  const missingWhatsAppForBooking =
    !isAdmin && !currentUser.whatsappPhone?.trim();

function replaceMinistrySlot(slotKey: string) {
  setSelectedSlots((current) => (current[0] === slotKey ? [] : [slotKey]));
}

  function handleCreateRequest(mode: "ministry" | "admin") {
    startTransition(async () => {
      const submissionSlotKeys =
        mode === "admin" && directBookingSlotKey ? [directBookingSlotKey] : selectedSlots;

      try {
        setFeedback(null);
        if (mode === "ministry") {
          setSelectedSlots([]);
        }

        await sendJson("/api/booking-requests", {
          ministryId:
            mode === "admin" ? directBookingMinistryId : currentUser.ministryId,
          slotKeys: submissionSlotKeys,
          submissionMode: mode === "admin" ? "approved" : "pending",
        });
        setDirectBookingSlotKey(null);
        setFeedback(
          mode === "admin"
            ? "Agendamento salvo com sucesso."
            : "Solicitação enviada para aprovação.",
        );
        router.refresh();
      } catch (error) {
        if (mode === "ministry") {
          setSelectedSlots(submissionSlotKeys);
        }
        setFeedback(error instanceof Error ? error.message : "Falha ao criar agendamento.");
      }
    });
  }

  function handleReviewRequest(requestId: string) {
    startTransition(async () => {
      try {
        setFeedback(null);
        await sendJson(`/api/booking-requests/${requestId}/review`, {
          approvedSlotKeys: pendingDialogRequest?.requestedSlotKeys ?? [],
          reviewNote: reviewNotes[requestId] ?? "",
        });
        setFeedback("Aprovação atualizada.");
        setPendingDialogRequestId(null);
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao aprovar agendamento.");
      }
    });
  }

  function handleConfigSave() {
    startTransition(async () => {
      try {
        setFeedback(null);
        await sendJson(
          "/api/config",
          { maxRequestsPerMinistryPerWeek: Number(configValue) },
          "PATCH",
        );
        setFeedback("Limite semanal atualizado.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao salvar configuração.");
      }
    });
  }

  function handleProfileSave() {
    startTransition(async () => {
      try {
        setFeedback(null);
        await sendJson("/api/profile", { whatsappPhone: whatsAppPhone }, "PATCH");
        setFeedback("WhatsApp atualizado.");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao atualizar WhatsApp.");
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await sendJson("/api/auth/logout");
      router.refresh();
    });
  }

  function handlePasswordSave() {
    startTransition(async () => {
      try {
        setFeedback(null);
        await sendJson(
          "/api/profile/password",
          {
            currentPassword,
            newPassword,
            confirmPassword,
          },
          "PATCH",
        );
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFeedback("Senha atualizada.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Falha ao atualizar senha.");
      }
    });
  }

  function openApprovalDialog(request: DashboardData["requests"][number]) {
    setReviewNotes((current) => ({
      ...current,
      [request.id]: current[request.id] ?? request.reviewNote ?? "",
    }));
    setPendingDialogRequestId(request.id);
  }

  function handleCancelRequest(requestId: string) {
    startTransition(async () => {
      try {
        setFeedback(null);
        await sendJson(`/api/booking-requests/${requestId}/cancel`);
        setManageReservationRequestId(null);
        setPendingDialogRequestId(null);
        setFeedback("Agendamento cancelado.");
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Falha ao cancelar agendamento.",
        );
      }
    });
  }

  async function handleExportWeekImage() {
    if (!weeklyCalendarRef.current) {
      setFeedback("Não foi possível localizar o calendário para exportar.");
      return;
    }

    try {
      setIsExportingImage(true);
      setFeedback(null);

      const dataUrl = await toPng(weeklyCalendarRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f7f1e7",
      });

      const link = document.createElement("a");
      link.download = `agenda-palco-semana-${data.weekStart}.png`;
      link.href = dataUrl;
      link.click();

      setFeedback("Imagem da semana gerada.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Falha ao gerar imagem da semana.",
      );
    } finally {
      setIsExportingImage(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <section className="hero-panel overflow-hidden rounded-[2rem] border border-white/60 px-5 py-5 shadow-[0_30px_80px_rgba(49,42,24,0.12)] sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-[1rem] border border-[var(--line)] bg-white/88 p-2 shadow-[0_12px_24px_rgba(24,54,56,0.08)]">
              <Image
                src="/brand/nibtb.webp"
                alt="Nova Igreja Batista Tabernáculo"
                width={92}
                height={48}
                className="h-auto w-[92px]"
              />
            </div>
            <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              Semana de {formatDateFullPtBr(data.weekStart)}
            </span>
            <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              {isAdmin
                ? `${data.requests.filter((request) => request.status === "pending").length} pendente(s)`
                : `${data.maxRequestsPerMinistryPerWeek} por semana`}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{currentUser.name}</p>
              <p className="truncate text-xs text-[var(--ink-soft)]">
                {isAdmin ? "Coordenação" : currentUser.ministryName}
              </p>
            </div>
            <button type="button" onClick={handleLogout} className="button-secondary">
              Sair
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="WhatsApp">
              <input
                type="tel"
                value={whatsAppPhone}
                onChange={(event) =>
                  setWhatsAppPhone(formatWhatsappInput(event.target.value))
                }
                placeholder="Digite seu WhatsApp"
                className="input-base"
              />
            </Field>
            <button
              type="button"
              disabled={isPending || !whatsAppPhone.trim()}
              onClick={handleProfileSave}
              className="button-primary"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
          {missingWhatsAppForBooking ? (
            <p className="mt-3 text-sm font-semibold text-[var(--warning)]">
              Salve seu WhatsApp antes do primeiro agendamento.
            </p>
          ) : null}
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Senha atual">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Digite a senha atual"
                className="input-base"
              />
            </Field>
            <Field label="Nova senha">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Digite a nova senha"
                className="input-base"
              />
            </Field>
            <Field label="Confirmar senha">
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
                className="input-base"
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={
                isPending ||
                !currentPassword.trim() ||
                !newPassword.trim() ||
                !confirmPassword.trim()
              }
              onClick={handlePasswordSave}
              className="button-primary"
            >
              {isPending ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </div>

        {feedback ? (
          <p className="mt-4 rounded-[1.25rem] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--ink)]">
            {feedback}
          </p>
        ) : null}
      </section>

      <div className={clsx("grid gap-6", isAdmin ? "lg:grid-cols-[0.95fr_1.05fr]" : "lg:grid-cols-[1.1fr_0.9fr]")}>
        {!isAdmin ? (
          <>
            <Panel
              eyebrow="Solicitar horário"
              title="Novo agendamento"
              description="Escolha um horário livre."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <StaticField label="Ministério" value={currentUser.ministryName ?? "-"} />
                <StaticField label="Líder" value={currentUser.name} />
              </div>

              <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">
                      Limite semanal
                    </p>
                    <p className="text-sm text-[var(--ink-soft)]">
                      Máximo: {data.maxRequestsPerMinistryPerWeek} por semana.
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                      weeklyAttemptConsumed
                        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                        : "bg-[var(--ok-soft)] text-[var(--ok)]",
                    )}
                  >
                    {weeklyAttemptConsumed ? "Tentativa usada" : "Liberado"}
                  </span>
                </div>
              </div>

              {missingWhatsAppForBooking ? (
                <div className="rounded-[1.5rem] border border-[var(--warning)] bg-[var(--warning-soft)] px-5 py-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">
                    WhatsApp obrigatório
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--warning)]">
                    Salve o número acima antes de enviar.
                  </p>
                </div>
              ) : null}

              {weeklyAttemptConsumed ? (
                <div className="rounded-[1.5rem] border border-[var(--danger)] bg-[var(--danger-soft)] px-5 py-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--danger)]">
                    Limite semanal atingido
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--danger)]">
                    Nova seleção só será liberada se um agendamento ativo for cancelado ou reprovado.
                  </p>
                  {currentActiveRequest ? (
                    <div className="mt-4 rounded-[1.25rem] border border-[var(--danger)]/25 bg-white/60 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--danger)]">
                        Agendamento ativo
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentActiveRequest.reservedSlotKeys.map((slotKey) => (
                          <span
                            key={slotKey}
                            className="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-semibold tracking-[0.12em] text-[var(--danger)]"
                          >
                            {slotDateTimeLabel(
                              slotKey.slice(0, 10),
                              Number(slotKey.slice(11, 13)),
                            )}
                          </span>
                        ))}
                      </div>
                      {currentActiveRequest.status === "pending" ? (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleCancelRequest(currentActiveRequest.id)}
                            className="rounded-full border border-[var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)]"
                          >
                            {isPending ? "Cancelando..." : "Cancelar agendamento ativo"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <SlotPicker
                title={weeklyAttemptConsumed ? "Calendário da semana" : "Escolha o horário"}
                days={data.days}
                slotHours={data.slotHours}
                reservationsBySlot={reservationsBySlot}
                selectedSlots={selectedSlots}
                disabled={isPending || weeklyAttemptConsumed}
                onToggle={replaceMinistrySlot}
              />

              {!isAdmin && feedback ? (
                <p className="rounded-[1.25rem] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
                  {feedback}
                </p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    isPending ||
                    !selectedSlots.length ||
                    weeklyAttemptConsumed
                  }
                  onClick={() => handleCreateRequest("ministry")}
                  className="button-primary"
                >
                  {isPending ? "Enviando..." : "Enviar para aprovação"}
                </button>
              </div>
            </Panel>

            <Panel
              eyebrow="Seus agendamentos"
              title="Historico"
            >
              <RequestList
                requests={ministryRequests}
                isPending={isPending}
                onCancelRequest={handleCancelRequest}
              />
            </Panel>
          </>
        ) : (
          <>
            <Panel
              eyebrow="Configuração"
              title="Limite semanal do ministério"
              description="Vale só para solicitações do ministério."
            >
              <Field label="Máximo de agendamentos por semana">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={configValue}
                  onChange={(event) => setConfigValue(event.target.value)}
                  className="input-base"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfigSave}
                  className="button-primary"
                >
                  {isPending ? "Salvando..." : "Salvar configuração"}
                </button>
              </div>
            </Panel>
          </>
        )}
      </div>

      <Panel
        eyebrow="Mapa semanal"
        title="Calendário"
      >
        <div className="flex justify-end">
          <button
            type="button"
            disabled={isExportingImage}
            onClick={handleExportWeekImage}
            className="button-primary"
          >
            {isExportingImage ? "Gerando imagem..." : "Gerar imagem da semana"}
          </button>
        </div>
        <div ref={weeklyCalendarRef} className="grid gap-4 rounded-[1.5rem] bg-[var(--panel)] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink-soft)]">
                Agenda do Palco
              </p>
              <p className="mt-2 font-display text-3xl text-[var(--ink)]">
                Semana de {formatDateFullPtBr(data.weekStart)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[var(--ink-soft)]">
                Livre
              </span>
              <span className="rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-1 text-[var(--warning)]">
                Pendente
              </span>
              <span className="rounded-full border border-[var(--ok)] bg-[var(--ok-soft)] px-3 py-1 text-[var(--ok)]">
                Confirmado
              </span>
            </div>
          </div>
          <SlotOverview
            days={data.days}
            slotHours={data.slotHours}
            reservationsBySlot={reservationsBySlot}
            isAdmin={isAdmin}
            onEmptySlotClick={(slotKey) => {
              setDirectBookingSlotKey(slotKey);
            }}
            onReservedSlotClick={(requestId) => {
              if (!isAdmin) return;
              const request = data.requests.find((entry) => entry.id === requestId);
              if (!request) return;
              if (request.status === "pending") {
                openApprovalDialog(request);
                return;
              }
              setManageReservationRequestId(requestId);
            }}
          />
        </div>
      </Panel>

      {pendingDialogRequest ? (
        <ApprovalDialog
          request={pendingDialogRequest}
          reviewNote={reviewNotes[pendingDialogRequest.id] ?? ""}
          isPending={isPending}
          onClose={() => setPendingDialogRequestId(null)}
          onNoteChange={(value) =>
            setReviewNotes((current) => ({
              ...current,
              [pendingDialogRequest.id]: value,
            }))
          }
          onSave={() => handleReviewRequest(pendingDialogRequest.id)}
          onReject={() => {
            startTransition(async () => {
              try {
                setFeedback(null);
                await sendJson(`/api/booking-requests/${pendingDialogRequest.id}/review`, {
                  approvedSlotKeys: [],
                  reviewNote: reviewNotes[pendingDialogRequest.id] ?? "",
                });
                setFeedback("Agendamento reprovado.");
                setPendingDialogRequestId(null);
                router.refresh();
              } catch (error) {
                setFeedback(
                  error instanceof Error ? error.message : "Falha ao reprovar agendamento.",
                );
              }
            });
          }}
        />
      ) : null}

      {directBookingSlotKey ? (
        <DirectBookingDialog
          slotKey={directBookingSlotKey}
          ministries={data.ministries}
          selectedMinistryId={directBookingMinistryId}
          isPending={isPending}
          onClose={() => setDirectBookingSlotKey(null)}
          onSelectMinistry={setDirectBookingMinistryId}
          onSave={() => handleCreateRequest("admin")}
        />
      ) : null}

      {managedReservation ? (
        <ManageReservationDialog
          request={managedReservation}
          isPending={isPending}
          isAdmin={isAdmin}
          onClose={() => setManageReservationRequestId(null)}
          onOpenApproval={() => {
            setManageReservationRequestId(null);
            openApprovalDialog(managedReservation);
          }}
          onCancel={() => handleCancelRequest(managedReservation.id)}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      {children}
    </label>
  );
}

function StaticField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--ink)]">{label}</span>
      <div className="input-base flex items-center bg-[var(--panel)] text-[var(--ink)]">
        {value}
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_50px_rgba(36,31,18,0.08)] backdrop-blur sm:p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl text-[var(--ink)]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
          {description}
        </p>
      ) : null}
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

function SlotPicker({
  title,
  days,
  slotHours,
  reservationsBySlot,
  selectedSlots,
  disabled = false,
  onToggle,
}: {
  title: string;
  days: string[];
  slotHours: number[];
  reservationsBySlot: Map<string, DashboardData["reservations"][number]>;
  selectedSlots: string[];
  disabled?: boolean;
  onToggle: (slotKey: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
          {title}
        </h3>
        <p className="text-sm text-[var(--ink-soft)]">
          18h às 20h
        </p>
      </div>

      <div className="grid gap-3 overflow-x-auto">
        <div className="grid min-w-[820px] grid-cols-[92px_repeat(7,minmax(100px,1fr))] gap-2">
          <div className="sticky left-0 z-20 bg-transparent" />
          {days.map((day) => (
            <div
              key={day}
              className="rounded-2xl bg-[var(--panel)] px-3 py-2 text-center text-sm font-semibold text-[var(--ink)]"
            >
              <span className="block">{formatDatePtBr(day)}</span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-[var(--ink-soft)]">
                {formatWeekdayShortPtBr(day)}
              </span>
            </div>
          ))}
          {slotHours.map((hour) => (
            <Fragment key={hour}>
              <div className="sticky left-0 z-20 flex items-center rounded-2xl bg-[var(--panel)] px-3 py-3 text-sm font-semibold text-[var(--ink)] shadow-[8px_0_18px_rgba(247,241,231,0.95)]">
                {hourLabel(hour)}
              </div>
              {days.map((day) => {
                const slotKey = `${day}T${String(hour).padStart(2, "0")}:00`;
                const reservation = reservationsBySlot.get(slotKey);
                const selected = selectedSlots.includes(slotKey);

                return (
                  <button
                    key={slotKey}
                    type="button"
                    disabled={Boolean(reservation) || disabled}
                    onClick={() => onToggle(slotKey)}
                    className={clsx(
                      "min-h-20 rounded-2xl border px-3 py-2 text-left text-sm transition",
                      reservation?.status === "pending" &&
                        "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
                      reservation &&
                        reservation.status !== "pending" &&
                        "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]",
                      !reservation &&
                        !selected &&
                        "border-[var(--line)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
                      !reservation &&
                        selected &&
                        "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]",
                      disabled &&
                        !reservation &&
                        "cursor-not-allowed opacity-60 hover:border-[var(--line)] hover:bg-white",
                    )}
                  >
                    {reservation ? (
                      <>
                        <span className="block font-semibold">{reservation.ministryName}</span>
                        <span className="mt-1 block text-xs uppercase tracking-[0.16em]">
                          {reservation.status === "pending" ? "Pendente" : "Confirmado"}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold">
                        {selected ? "Selecionado" : "Livre"}
                      </span>
                    )}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlotOverview({
  days,
  slotHours,
  reservationsBySlot,
  isAdmin,
  onEmptySlotClick,
  onReservedSlotClick,
}: {
  days: string[];
  slotHours: number[];
  reservationsBySlot: Map<string, DashboardData["reservations"][number]>;
  isAdmin: boolean;
  onEmptySlotClick: (slotKey: string) => void;
  onReservedSlotClick: (requestId: string) => void;
}) {
  return (
      <div className="grid gap-3 overflow-x-auto">
      <div className="grid min-w-[820px] grid-cols-[92px_repeat(7,minmax(100px,1fr))] gap-2">
        <div className="sticky left-0 z-20 bg-transparent" />
        {days.map((day) => (
          <div
            key={day}
            className="rounded-2xl bg-[var(--panel)] px-3 py-2 text-center text-sm font-semibold text-[var(--ink)]"
          >
            <span className="block">{formatDatePtBr(day)}</span>
            <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-[var(--ink-soft)]">
              {formatWeekdayShortPtBr(day)}
            </span>
          </div>
        ))}
        {slotHours.map((hour) => (
          <Fragment key={hour}>
            <div className="sticky left-0 z-20 flex items-center rounded-2xl bg-[var(--panel)] px-3 py-3 text-sm font-semibold text-[var(--ink)] shadow-[8px_0_18px_rgba(247,241,231,0.95)]">
              {hourLabel(hour)}
            </div>
            {days.map((day) => {
              const slotKey = `${day}T${String(hour).padStart(2, "0")}:00`;
              const reservation = reservationsBySlot.get(slotKey);

              return (
                <button
                  key={`${slotKey}-overview`}
                  type="button"
                  disabled={!isAdmin && !reservation}
                  onClick={() => {
                    if (!reservation && isAdmin) {
                      onEmptySlotClick(slotKey);
                    }
                    if (reservation && isAdmin) {
                      onReservedSlotClick(reservation.requestId);
                    }
                  }}
                  className={clsx(
                    "min-h-20 rounded-2xl border px-3 py-2 text-left text-sm transition",
                    reservation?.status === "pending" &&
                      "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
                    reservation &&
                      reservation.status !== "pending" &&
                      "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]",
                    !reservation &&
                      isAdmin &&
                      "border-dashed border-[var(--accent)] bg-white text-[var(--accent)] hover:-translate-y-0.5 hover:bg-[var(--accent-soft)]",
                    !reservation &&
                      !isAdmin &&
                      "border-[var(--line)] bg-white text-[var(--ink-soft)]",
                  )}
                >
                  {reservation ? (
                    <>
                      <span className="block text-sm font-semibold leading-5">
                        {reservation.ministryName}
                      </span>
                      <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] leading-4">
                        {reservation.status === "pending" ? "Pendente" : "Confirmado"}
                      </span>
                      {isAdmin ? (
                        <span className="mt-1 block text-[11px] leading-4 text-current/80">
                          {reservation.status === "pending"
                            ? "Toque para aprovar"
                            : "Toque para gerenciar"}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-semibold leading-5">
                        {isAdmin ? "Agendar direto" : "Livre"}
                      </span>
                      {isAdmin ? (
                        <span className="mt-1 block text-[11px] leading-4 text-current/80">
                          Toque para abrir
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function RequestList({
  requests,
  isPending = false,
  onCancelRequest,
}: {
  requests: DashboardData["requests"];
  isPending?: boolean;
  onCancelRequest?: (requestId: string) => void;
}) {
  if (!requests.length) {
    return <EmptyState text="Nenhum agendamento nesta semana." />;
  }

  return (
    <div className="grid gap-4">
      {requests.map((request) => (
        <article
          key={request.id}
          className="rounded-[1.5rem] border border-[var(--line)] bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[var(--ink)]">{request.ministryName}</h3>
              <p className="text-sm text-[var(--ink-soft)]">
                por {request.requestedByName}
              </p>
            </div>
            <StatusTag status={request.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {request.requestedSlotKeys.map((slotKey) => (
              <span
                key={slotKey}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold tracking-[0.12em]",
                  request.reservedSlotKeys.includes(slotKey)
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "bg-[var(--panel)] text-[var(--ink-soft)] line-through",
                )}
              >
                {slotDateTimeLabel(slotKey.slice(0, 10), Number(slotKey.slice(11, 13)))}
              </span>
            ))}
          </div>

          {request.reviewNote ? (
            <p className="mt-4 rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-soft)]">
              {request.reviewNote}
            </p>
          ) : null}

          {request.status === "pending" && onCancelRequest ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={() => onCancelRequest(request.id)}
                className="rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
              >
                {isPending ? "Cancelando..." : "Cancelar agendamento"}
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StatusTag({ status }: { status: DashboardData["requests"][number]["status"] }) {
  const className =
    status === "pending"
      ? "status-pill status-pending"
      : status === "rejected" || status === "cancelled"
        ? "status-pill status-rejected"
        : "status-pill status-approved";

  return <span className={className}>{status.replace("_", " ")}</span>;
}

function ManageReservationDialog({
  request,
  isPending,
  isAdmin,
  onClose,
  onOpenApproval,
  onCancel,
}: {
  request: DashboardData["requests"][number];
  isPending: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onOpenApproval: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,18,12,0.5)] px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/60 bg-[rgba(255,249,240,0.98)] p-6 shadow-[0_30px_80px_rgba(24,18,12,0.25)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
              Gerenciar agendamento
            </p>
            <h3 className="mt-2 font-display text-4xl text-[var(--ink)]">
              {request.ministryName}
            </h3>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Solicitado por {request.requestedByName}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">
            Fechar
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {request.requestedSlotKeys.map((slotKey) => (
            <span
              key={slotKey}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold tracking-[0.12em]",
                request.reservedSlotKeys.includes(slotKey)
                  ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                  : "bg-[var(--panel)] text-[var(--ink-soft)] line-through",
              )}
            >
              {slotDateTimeLabel(slotKey.slice(0, 10), Number(slotKey.slice(11, 13)))}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {isAdmin && request.status === "pending" ? (
            <button type="button" onClick={onOpenApproval} className="button-primary">
              Abrir aprovação
            </button>
          ) : (
            <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--ink-soft)]">
              Use o cancelamento para liberar o horário.
            </div>
          )}
          <button
            type="button"
            disabled={isPending || ["rejected", "cancelled"].includes(request.status)}
            onClick={onCancel}
            className="rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] px-5 py-3 text-sm font-semibold text-[var(--danger)]"
          >
            Cancelar agendamento
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--ink-soft)]">
      {text}
    </div>
  );
}

function ApprovalDialog({
  request,
  reviewNote,
  isPending,
  onClose,
  onReject,
  onNoteChange,
  onSave,
}: {
  request: DashboardData["requests"][number];
  reviewNote: string;
  isPending: boolean;
  onClose: () => void;
  onReject: () => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,18,12,0.5)] px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[2rem] border border-white/60 bg-[rgba(255,249,240,0.98)] p-6 shadow-[0_30px_80px_rgba(24,18,12,0.25)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
              Aprovar agendamento
            </p>
            <h3 className="mt-2 font-display text-4xl text-[var(--ink)]">
              {request.ministryName}
            </h3>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Solicitado por {request.requestedByName}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">
            Fechar
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white px-4 py-4 text-sm text-[var(--ink)]">
          {request.requestedSlotKeys.map((slotKey) => (
            <span key={slotKey}>
              {slotDateTimeLabel(slotKey.slice(0, 10), Number(slotKey.slice(11, 13)))}
            </span>
          ))}
        </div>

        <textarea
          value={reviewNote}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Observação"
          
          className="input-base mt-5 min-h-28"
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-soft)]">
            Aprove ou reprove este horário.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={onReject}
              className="rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] px-5 py-3 text-sm font-semibold text-[var(--danger)]"
            >
              Reprovar agendamento
            </button>
            <button type="button" disabled={isPending} onClick={onSave} className="button-primary">
              {isPending ? "Salvando..." : "Aprovar agendamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectBookingDialog({
  slotKey,
  ministries,
  selectedMinistryId,
  isPending,
  onClose,
  onSelectMinistry,
  onSave,
}: {
  slotKey: string;
  ministries: DashboardData["ministries"];
  selectedMinistryId: string;
  isPending: boolean;
  onClose: () => void;
  onSelectMinistry: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,18,12,0.5)] px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/60 bg-[rgba(255,249,240,0.98)] p-6 shadow-[0_30px_80px_rgba(24,18,12,0.25)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--ink-soft)]">
              Agendamento direto
            </p>
            <h3 className="mt-2 font-display text-4xl text-[var(--ink)]">
              {slotDateTimeLabel(slotKey.slice(0, 10), Number(slotKey.slice(11, 13)))}
            </h3>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Escolha o ministério e confirme.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <Field label="Ministério">
            <select
              value={selectedMinistryId}
              onChange={(event) => onSelectMinistry(event.target.value)}
              className="input-base"
            >
              {ministries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-[1.25rem] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-4">
            <p className="font-semibold text-[var(--ink)]">Agendamento direto confirmado</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Será salvo como confirmado.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" disabled={isPending || !selectedMinistryId} onClick={onSave} className="button-primary">
            {isPending ? "Salvando..." : "Salvar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

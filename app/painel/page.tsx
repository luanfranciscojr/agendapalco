import { clsx } from "clsx";

import { getPublicPanelData } from "@/lib/service";
import {
  formatDateFullPtBr,
  formatDatePtBr,
  formatWeekdayShortPtBr,
  hourLabel,
} from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const data = await getPublicPanelData();
  const reservationsBySlot = new Map(
    data.reservations.map((reservation) => [reservation.slotKey, reservation]),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <section className="hero-panel rounded-[2rem] border border-white/60 px-5 py-6 shadow-[0_30px_80px_rgba(49,42,24,0.12)] sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
          Painel público
        </p>
        <h1 className="mt-3 font-display text-4xl text-[var(--ink)] sm:text-5xl">
          Agenda do palco
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
            Semana de {formatDateFullPtBr(data.weekStart)}
          </span>
          <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
            Consulta pública
          </span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_50px_rgba(36,31,18,0.08)] backdrop-blur sm:p-6">
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
          <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-[var(--accent)]">
            Ocupado
          </span>
        </div>

        <div className="mt-5 grid gap-3 overflow-x-auto">
          <div className="grid min-w-[820px] grid-cols-[92px_repeat(7,minmax(100px,1fr))] gap-2">
            <div className="sticky left-0 z-20 bg-transparent" />
            {data.days.map((day) => (
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
            {data.slotHours.map((hour) => (
              <FragmentRow
                key={hour}
                label={hourLabel(hour)}
                cells={data.days.map((day) => {
                  const slotKey = `${day}T${String(hour).padStart(2, "0")}:00`;
                  const reservation = reservationsBySlot.get(slotKey);

                  return (
                    <div
                      key={slotKey}
                      className={clsx(
                        "min-h-20 rounded-2xl border px-3 py-2 text-left text-sm",
                        reservation?.isBlocked &&
                          "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]",
                        reservation?.status === "pending" &&
                          !reservation?.isBlocked &&
                          "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
                        reservation &&
                          !reservation.isBlocked &&
                          reservation.status !== "pending" &&
                          "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]",
                        !reservation && "border-[var(--line)] bg-white text-[var(--ink-soft)]",
                      )}
                    >
                      {reservation ? (
                        <>
                          <span className="block font-semibold">
                            {reservation.isBlocked ? "Ocupado" : reservation.ministryName}
                          </span>
                          <span className="mt-1 block text-xs uppercase tracking-[0.16em]">
                            {reservation.isBlocked
                              ? "Bloqueado"
                              : reservation.status === "pending"
                                ? "Pendente"
                                : "Confirmado"}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold">Livre</span>
                      )}
                    </div>
                  );
                })}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function FragmentRow({
  label,
  cells,
}: {
  label: string;
  cells: React.ReactNode[];
}) {
  return (
    <>
      <div className="sticky left-0 z-20 flex items-center rounded-2xl bg-[var(--panel)] px-3 py-3 text-sm font-semibold text-[var(--ink)] shadow-[8px_0_18px_rgba(247,241,231,0.95)]">
        {label}
      </div>
      {cells}
    </>
  );
}

"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { toPng } from "html-to-image";

import {
  formatDateFullPtBr,
  formatDatePtBr,
  formatWeekdayShortPtBr,
  hourLabel,
} from "@/lib/time";
import type { PublicPanelData } from "@/lib/types";
import { WeekNavigation } from "@/components/week-navigation";

type Props = {
  data: PublicPanelData;
};

export function PublicPanelClient({ data }: Props) {
  const router = useRouter();
  const reservationsBySlot = useMemo(
    () =>
      new Map(
        data.reservations.map((reservation) => [reservation.slotKey, reservation]),
      ),
    [data.reservations],
  );
  const unavailableSlotKeys = useMemo(
    () => new Set(data.unavailableSlotKeys),
    [data.unavailableSlotKeys],
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  function handleWeekChange(weekStart: string) {
    setFeedback(null);
    router.push(`/painel?semana=${weekStart}`);
  }

  async function buildWeekImageFile() {
    if (!exportRef.current) {
      throw new Error("Não foi possível localizar o calendário para exportar.");
    }

    const dataUrl = await toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f7f1e7",
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return new File([blob], `agenda-publica-semana-${data.weekStart}.png`, {
      type: "image/png",
    });
  }

  async function handleExportWeekImage() {
    try {
      setIsExportingImage(true);
      setFeedback(null);
      const imageFile = await buildWeekImageFile();
      const dataUrl = URL.createObjectURL(imageFile);

      const link = document.createElement("a");
      link.download = imageFile.name;
      link.href = dataUrl;
      link.click();
      URL.revokeObjectURL(dataUrl);

      setFeedback("Imagem da semana gerada.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Falha ao gerar imagem da semana.",
      );
    } finally {
      setIsExportingImage(false);
    }
  }

  async function handleShareWeekImage() {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function"
    ) {
      setFeedback("O compartilhamento não está disponível neste aparelho.");
      return;
    }

    try {
      setIsExportingImage(true);
      setFeedback(null);

      const imageFile = await buildWeekImageFile();
      const shareData: ShareData = {
        title: "Agenda do Palco",
        text: `Agenda do palco - semana de ${formatDateFullPtBr(data.weekStart)}`,
        files: [imageFile],
      };

      if (
        typeof navigator.canShare === "function" &&
        !navigator.canShare({ files: [imageFile] })
      ) {
        throw new Error("Este aparelho não aceita compartilhar a imagem diretamente.");
      }

      await navigator.share(shareData);
      setFeedback("Imagem pronta para compartilhamento.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setFeedback("Compartilhamento cancelado.");
        return;
      }

      setFeedback(
        error instanceof Error ? error.message : "Falha ao compartilhar imagem da semana.",
      );
    } finally {
      setIsExportingImage(false);
    }
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <section className="hero-panel rounded-[2rem] border border-white/60 px-5 py-6 shadow-[0_30px_80px_rgba(49,42,24,0.12)] sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Painel público
          </p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink)] sm:text-5xl">
            Agenda do palco
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
              Semana de {formatDateFullPtBr(data.weekStart)}
            </span>
            <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
              Consulta pública
            </span>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_50px_rgba(36,31,18,0.08)] backdrop-blur sm:p-6">
          <WeekNavigation
            previousWeekStart={data.previousWeekStart}
            nextWeekStart={data.nextWeekStart}
            disabled={isExportingImage}
            onNavigate={handleWeekChange}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={isExportingImage}
              onClick={handleShareWeekImage}
              className="button-secondary"
            >
              {isExportingImage ? "Preparando..." : "Compartilhar semana"}
            </button>
            <button
              type="button"
              disabled={isExportingImage}
              onClick={handleExportWeekImage}
              className="button-primary"
            >
              {isExportingImage ? "Gerando imagem..." : "Gerar imagem da semana"}
            </button>
          </div>

          {feedback ? (
            <p className="mt-4 rounded-[1.25rem] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--ink)]">
              {feedback}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
            <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[var(--ink-soft)]">
              Livre
            </span>
            <span className="rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-1 text-[var(--warning)]">
              Pendente
            </span>
            <span className="rounded-full border border-[var(--ok)] bg-[var(--ok-soft)] px-3 py-1 text-[var(--ok)]">
              Confirmado
            </span>
            <span className="rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-1 text-[var(--danger)]">
              Ocupado
            </span>
            <span className="rounded-full border border-[var(--collective)] bg-[var(--collective-soft)] px-3 py-1 text-[var(--collective)]">
              Ensaio coletivo
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
                  <span className="mt-1 block text-[10px] font-semibold tracking-[0.12em] text-[var(--ink-soft)]">
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
                    const unavailable = unavailableSlotKeys.has(slotKey);

                    return (
                      <div
                        key={slotKey}
                        className={clsx(
                          "min-h-20 rounded-2xl border px-3 py-2 text-left text-sm",
                          reservation?.isCollectiveRehearsal &&
                            "border-[var(--collective)] bg-[var(--collective-soft)] text-[var(--collective)]",
                          reservation?.isBlocked &&
                            !reservation.isCollectiveRehearsal &&
                            "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
                          reservation?.status === "pending" &&
                            !reservation?.isBlocked &&
                            "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
                          reservation &&
                            !reservation.isBlocked &&
                            reservation.status !== "pending" &&
                            "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]",
                          !reservation &&
                            (unavailable
                              ? "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-soft)] opacity-65"
                              : "border-[var(--line)] bg-white text-[var(--ink-soft)]"),
                        )}
                      >
                        {reservation ? (
                          <>
                            <span className="block font-semibold">
                              {reservation.isCollectiveRehearsal
                                ? reservation.ministryName
                                : reservation.isBlocked
                                  ? "Ocupado"
                                  : reservation.ministryName}
                            </span>
                            <span className="mt-1 block text-[11px] tracking-[0.04em]">
                              {reservation.isBlocked
                                ? reservation.isCollectiveRehearsal
                                  ? "Ensaio coletivo"
                                  : "Ocupado"
                                : reservation.status === "pending"
                                  ? "Pendente"
                                  : "Confirmado"}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold">
                            {unavailable ? "Encerrado" : "Livre"}
                          </span>
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

      <div className="pointer-events-none fixed -left-[99999px] top-0 opacity-0">
        <div
          ref={exportRef}
          className="w-[1280px] rounded-[32px] bg-[#f7f1e7] p-8 text-[#2f261d]"
        >
          <div className="rounded-[28px] border border-[rgba(120,94,59,0.14)] bg-[rgba(255,249,240,0.96)] p-6 shadow-[0_20px_50px_rgba(49,42,24,0.10)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                  Agenda do Palco
                </p>
                <p className="mt-2 font-display text-4xl text-[var(--ink)]">
                  Semana de {formatDateFullPtBr(data.weekStart)}
                </p>
              </div>
              <div className="flex gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[var(--ink-soft)]">
                  Livre
                </span>
                <span className="rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-1 text-[var(--warning)]">
                  Pendente
                </span>
                <span className="rounded-full border border-[var(--ok)] bg-[var(--ok-soft)] px-3 py-1 text-[var(--ok)]">
                  Confirmado
                </span>
                <span className="rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-1 text-[var(--danger)]">
                  Ocupado
                </span>
                <span className="rounded-full border border-[var(--collective)] bg-[var(--collective-soft)] px-3 py-1 text-[var(--collective)]">
                  Ensaio coletivo
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              <div className="grid grid-cols-[92px_repeat(7,minmax(0,1fr))] gap-2">
                <div />
                {data.days.map((day) => (
                  <div
                    key={`export-${day}`}
                    className="rounded-2xl bg-[var(--panel)] px-3 py-2 text-center text-sm font-semibold text-[var(--ink)]"
                  >
                    <span className="block">{formatDatePtBr(day)}</span>
                    <span className="mt-1 block text-[10px] font-semibold tracking-[0.12em] text-[var(--ink-soft)]">
                      {formatWeekdayShortPtBr(day)}
                    </span>
                  </div>
                ))}

                {data.slotHours.map((hour) => (
                  <Fragment key={`export-row-${hour}`}>
                    <div
                      key={`export-hour-${hour}`}
                      className="flex items-center rounded-2xl bg-[var(--panel)] px-3 py-3 text-sm font-semibold text-[var(--ink)]"
                    >
                      {hourLabel(hour)}
                    </div>
                    {data.days.map((day) => {
                      const slotKey = `${day}T${String(hour).padStart(2, "0")}:00`;
                      const reservation = reservationsBySlot.get(slotKey);
                      const unavailable = unavailableSlotKeys.has(slotKey);

                      return (
                        <div
                          key={`export-${slotKey}`}
                          className={clsx(
                            "min-h-20 rounded-2xl border px-3 py-2 text-left text-sm",
                            reservation?.isCollectiveRehearsal &&
                              "border-[var(--collective)] bg-[var(--collective-soft)] text-[var(--collective)]",
                            reservation?.isBlocked &&
                              !reservation.isCollectiveRehearsal &&
                              "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
                            reservation?.status === "pending" &&
                              !reservation?.isBlocked &&
                              "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]",
                            reservation &&
                              !reservation.isBlocked &&
                              reservation.status !== "pending" &&
                              "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ok)]",
                            !reservation &&
                              (unavailable
                                ? "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-soft)] opacity-65"
                                : "border-[var(--line)] bg-white text-[var(--ink-soft)]"),
                          )}
                        >
                          {reservation ? (
                            <>
                              <span className="block text-sm font-semibold leading-5">
                                {reservation.isCollectiveRehearsal
                                  ? reservation.ministryName
                                  : reservation.isBlocked
                                    ? "Ocupado"
                                    : reservation.ministryName}
                              </span>
                              <span className="mt-1 block text-[11px] tracking-[0.04em] leading-4">
                                {reservation.isBlocked
                                  ? reservation.isCollectiveRehearsal
                                    ? "Ensaio coletivo"
                                    : "Ocupado"
                                  : reservation.status === "pending"
                                    ? "Pendente"
                                    : "Confirmado"}
                              </span>
                            </>
                          ) : (
                            <span className="block text-sm font-semibold leading-5">
                              {unavailable ? "Encerrado" : "Livre"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
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

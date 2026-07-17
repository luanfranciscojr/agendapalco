import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getGeneralUsageReport } from "@/lib/service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    inicio?: string | string[];
    fim?: string | string[];
  }>;
};

function parseDateParam(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export default async function ReportPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;
  const startDate = parseDateParam(params.inicio);
  const endDate = parseDateParam(params.fim);
  const invalidPeriod = Boolean(startDate && endDate && startDate > endDate);
  const report = await getGeneralUsageReport(
    invalidPeriod ? undefined : { startDate, endDate },
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="hero-panel rounded-[2rem] border border-white/60 p-5 shadow-[0_30px_80px_rgba(49,42,24,0.12)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-[1rem] border border-[var(--line)] bg-white/88 p-2">
              <Image
                src="/brand/nibtb.webp"
                alt="Nova Igreja Batista Tabernáculo"
                width={82}
                height={43}
                className="h-auto w-[82px]"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Administração
              </p>
              <h1 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">
                Relatório geral
              </h1>
            </div>
          </div>
          <Link href="/" className="button-secondary">
            Voltar à agenda
          </Link>
        </div>
      </header>

      <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_50px_rgba(36,31,18,0.08)] sm:p-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Data inicial</span>
            <input
              type="date"
              name="inicio"
              defaultValue={startDate}
              className="input-base"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[var(--ink)]">Data final</span>
            <input
              type="date"
              name="fim"
              defaultValue={endDate}
              className="input-base"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="button-primary flex-1 sm:flex-none">
              Filtrar
            </button>
            <Link href="/relatorio" className="button-secondary flex-1 sm:flex-none">
              Limpar
            </Link>
          </div>
        </form>
        {invalidPeriod ? (
          <p className="mt-4 rounded-[1.1rem] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
            A data inicial não pode ser posterior à data final.
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        <ReportMetric value={report.ministryCount} label="Ministérios" />
        <ReportMetric value={report.bookingCount} label="Agendamentos" />
        <ReportMetric value={report.hourCount} label="Horas" />
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_18px_50px_rgba(36,31,18,0.08)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">
              Uso confirmado
            </p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink)]">
              Ministérios no palco
            </h2>
          </div>
          <span className="text-sm font-semibold text-[var(--ink-soft)]">
            {startDate || endDate ? "Período filtrado" : "Todo o histórico"}
          </span>
        </div>

        {report.ministries.length ? (
          <ol className="mt-5 grid gap-2">
            {report.ministries.map((ministry, index) => (
              <li
                key={ministry.ministryId}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] border border-[var(--line)] bg-white px-3 py-3 sm:px-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--panel)] text-xs font-semibold text-[var(--accent-strong)]">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">
                  {ministry.ministryName}
                </span>
                <span className="text-right text-xs font-semibold text-[var(--ink-soft)] sm:text-sm">
                  {ministry.bookingCount} ag. · {ministry.hourCount}h
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-[1.25rem] bg-[var(--panel)] px-4 py-5 text-sm text-[var(--ink-soft)]">
            Nenhum uso confirmado no período.
          </p>
        )}
      </section>
    </main>
  );
}

function ReportMetric({ value, label }: { value: number; label: string }) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel)] px-2 py-5 text-center shadow-[0_14px_35px_rgba(36,31,18,0.06)] sm:px-5">
      <strong className="block font-display text-4xl text-[var(--accent-strong)]">
        {value}
      </strong>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-soft)] sm:text-xs">
        {label}
      </span>
    </article>
  );
}

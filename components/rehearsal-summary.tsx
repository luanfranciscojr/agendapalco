import type { RehearsalReport } from "@/lib/rehearsal-report";
import { formatDateFullPtBr } from "@/lib/time";

export function RehearsalSummary({ report }: { report: RehearsalReport }) {
  return (
    <section aria-labelledby="rehearsal-summary-title" className="min-w-0 rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 sm:p-6">
      <h2 id="rehearsal-summary-title" className="text-xl font-semibold text-[var(--ink)]">
        Ensaios por ministério
      </h2>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        De {formatDateFullPtBr(report.startDate)} até {formatDateFullPtBr(report.endDate)}
      </p>
      <div role="region" aria-label="Contagem de ensaios por ministério" aria-describedby="rehearsal-count-description" tabIndex={0} className="mt-4 max-h-72 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-strong)]">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Ensaios realizados por ministério no período</caption>
          <thead className="sticky top-0 bg-white text-[var(--ink-soft)]">
            <tr className="border-b border-[var(--line)]">
              <th scope="col" className="py-3 pr-4 text-left font-semibold">Ministério</th>
              <th scope="col" className="py-3 pl-4 text-right font-semibold">Ensaios</th>
            </tr>
          </thead>
          <tbody>
            {report.ministries.length ? report.ministries.map((ministry) => (
              <tr key={ministry.ministryId} className="border-b border-[var(--line)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-normal text-[var(--ink)]">{ministry.ministryName}</th>
                <td className="py-2.5 pl-4 text-right tabular-nums text-[var(--ink)]">{ministry.rehearsalCount}</td>
              </tr>
            )) : (
              <tr><td colSpan={2} className="py-4 text-[var(--ink-soft)]">Nenhum ministério cadastrado.</td></tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white">
            <tr className="border-t border-[var(--line)]">
              <th scope="row" className="py-3 pr-4 text-left font-semibold text-[var(--ink)]">Total</th>
              <td className="py-3 pl-4 text-right font-semibold tabular-nums text-[var(--accent-strong)]">{report.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {report.ministries.length > 5 ? (
        <p className="mt-2 text-sm text-[var(--ink-soft)]">Role a tabela para ver os {report.ministries.length} ministérios.</p>
      ) : null}
      <p id="rehearsal-count-description" className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">
        Cada agendamento conta uma vez, com ao menos um horário confirmado já encerrado.
      </p>
    </section>
  );
}

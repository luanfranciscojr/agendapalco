type Props = {
  previousWeekStart: string | null;
  nextWeekStart: string | null;
  disabled?: boolean;
  onNavigate: (weekStart: string) => void;
};

export function WeekNavigation({
  previousWeekStart,
  nextWeekStart,
  disabled = false,
  onNavigate,
}: Props) {
  return (
    <nav
      aria-label="Navegação entre semanas"
      className="flex w-full items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--line)] bg-white/70 p-2"
    >
      <button
        type="button"
        disabled={disabled || !previousWeekStart}
        onClick={() => previousWeekStart && onNavigate(previousWeekStart)}
        className="button-secondary min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
      >
        Semana anterior
      </button>
      <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)] sm:block">
        Navegar na agenda
      </span>
      <button
        type="button"
        disabled={disabled || !nextWeekStart}
        onClick={() => nextWeekStart && onNavigate(nextWeekStart)}
        className="button-primary min-w-0 flex-1 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
      >
        Próxima semana
      </button>
    </nav>
  );
}

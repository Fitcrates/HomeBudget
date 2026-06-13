interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function FilterChip({ label, active, onClick, icon, className = "" }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors duration-300 whitespace-nowrap ${
        active
          ? "border-orange-500 dark:border-indigo-500 bg-orange-100 dark:bg-indigo-500/20 text-orange-700 dark:text-indigo-200"
          : "border-orange-200/50 dark:border-white/10 bg-white/80 dark:bg-white/5 text-orange-900/60 dark:text-white/50 hover:bg-white dark:hover:bg-white/10"
      } ${className}`}
    >
      {icon && <span className="mr-1 inline-flex">{icon}</span>}
      {label}
    </button>
  );
}

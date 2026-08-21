interface CompactTableRow {
  label: string;
  value: React.ReactNode;
}

interface CompactTableProps {
  rows: CompactTableRow[];
  className?: string;
}

export function CompactTable({ rows, className = "" }: CompactTableProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#f2dfcb] dark:border-white/10 bg-[#fff8f2] dark:bg-white/5 transition-colors duration-700 ${className}`}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
            i > 0 ? "border-t border-[#f2dfcb] dark:border-white/10" : ""
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87] dark:text-white/40">
            {row.label}
          </p>
          <div className="text-right text-sm font-semibold tabular-nums text-[#2b180a] dark:text-white">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

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
      className={`overflow-hidden rounded-xl border border-[#f2dfcb] bg-[#fff8f2] ${className}`}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
            i > 0 ? "border-t border-[#f2dfcb]" : ""
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
            {row.label}
          </p>
          <div className="text-right text-sm font-semibold tabular-nums text-[#2b180a]">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

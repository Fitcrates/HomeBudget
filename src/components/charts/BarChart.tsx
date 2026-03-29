interface Bar {
  period: string;
  total: number;
}

interface Props {
  data: Bar[];
  currency: string;
}

export function BarChart({ data, currency }: Props) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.total));
  const fmt = (v: number) =>
    new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
      minimumFractionDigits: 0,
      notation: "compact",
    }).format(v / 100);

  return (
    <div className="space-y-2.5">
      {data.map((bar) => (
        <div key={bar.period} className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider w-16 flex-shrink-0 text-right drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">{bar.period}</span>
          <div className="flex-1 bg-white/40 border border-[#f5e5cf]/60 backdrop-blur-sm rounded-full h-4 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <div
              className="h-full bg-gradient-to-r from-[#de9241] to-[#ca782a] rounded-full transition-all shadow-sm"
              style={{ width: `${(bar.total / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[#3e2815] w-12 flex-shrink-0 text-right drop-shadow-sm">{fmt(bar.total)}</span>
        </div>
      ))}
    </div>
  );
}

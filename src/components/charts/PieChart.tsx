import { DynamicIcon } from "../ui/DynamicIcon";

interface Slice {
  id: string;
  name: string;
  color: string;
  icon: string;
  total: number;
}

interface Props {
  data: Slice[];
  currency: string;
}

export function PieChart({ data, currency }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;

  // Build SVG pie
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 60;
  const innerR = 35;

  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.total / total) * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    return { ...d, start, end: cumAngle, angle };
  });

  function polarToCartesian(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(start, r);
    const e = polarToCartesian(end, r);
    const si = polarToCartesian(start, innerR);
    const ei = polarToCartesian(end, innerR);
    const large = end - start > Math.PI ? 1 : 0;
    return [
      `M ${s.x} ${s.y}`,
      `A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`,
      `L ${ei.x} ${ei.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${si.x} ${si.y}`,
      "Z",
    ].join(" ");
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("pl-PL", { style: "currency", currency: currency || "PLN", minimumFractionDigits: 0 }).format(v / 100);

  // Map category DB colors to nicer, less stark colors if possible, but we don't know them here so just apply an opacity in SVG

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative pointer-events-none drop-shadow-md">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s) => (
            <path key={s.id} d={arcPath(s.start, s.end)} fill={s.color} opacity={0.8} className="stroke-white/60 dark:stroke-black/50 transition-colors duration-700" strokeWidth="2.5" />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fontWeight="bold" className="fill-orange-900/60 dark:fill-white/50 transition-colors duration-700">Łącznie</text>
          <text x={cx} y={cy + 8} textAnchor="middle" fontSize="12" fontWeight="900" className="fill-orange-950 dark:fill-white transition-colors duration-700">
            {fmt(total)}
          </text>
        </svg>
      </div>
      <div className="w-full space-y-2">
        {slices
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
          .map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-inner" style={{ backgroundColor: s.color, opacity: 0.8 }} />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <DynamicIcon name={s.icon} className="flex-shrink-0 w-[14px] h-[14px] text-orange-500 dark:text-indigo-400 transition-colors duration-700" />
                <span className="text-[13px] font-bold text-orange-900 dark:text-white/80 truncate transition-colors duration-700">{s.name}</span>
              </div>
              <span className="text-[13px] font-bold text-orange-950 dark:text-white transition-colors duration-700">{fmt(s.total)}</span>
              <span className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 w-8 text-right transition-colors duration-700">{((s.total / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}

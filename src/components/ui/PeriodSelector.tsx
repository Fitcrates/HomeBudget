import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  customFrom: number | null;
  customTo: number | null;
  onCustomFrom: (v: number | null) => void;
  onCustomTo: (v: number | null) => void;
}

const PERIODS = [
  { key: "week", label: "Tygodniowy" },
  { key: "month", label: "Miesięczny" },
  { key: "quarter", label: "Kwartalny" },
  { key: "year", label: "Roczny" },
];

export function getPeriodRange(
  period: string,
  customFrom: number | null,
  customTo: number | null
): { from: number; to: number } {
  const now = new Date();
  const to = now.getTime();

  if (period === "custom" && customFrom !== null && customTo !== null) {
    return { from: customFrom, to: customTo };
  }

  if (period === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return { from: from.getTime(), to };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.getTime(), to };
  }
  if (period === "quarter") {
    const from = new Date(now);
    from.setMonth(now.getMonth() - 3);
    return { from: from.getTime(), to };
  }
  if (period === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.getTime(), to };
  }

  // default: month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: from.getTime(), to };
}

export function PeriodSelector({ value, onChange, customFrom, customTo, onCustomFrom, onCustomTo }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide px-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-extrabold text-[13px] transition-all focus:outline-none ${
              value === p.key
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-[0_4px_12px_rgba(200,120,50,0.3)]"
                : "text-[#6d4d38] bg-white/40 hover:bg-white/60 border border-white/40 shadow-sm backdrop-blur-sm"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

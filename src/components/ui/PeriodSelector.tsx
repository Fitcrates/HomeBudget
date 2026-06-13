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
            className={`whitespace-nowrap px-4 py-2 rounded-[16px] font-bold text-[13px] transition-all duration-300 focus:outline-none ${
              value === p.key
                ? "bg-gradient-to-r from-orange-500 to-amber-500 dark:from-indigo-500 dark:to-violet-600 text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)] dark:shadow-[0_4px_12px_rgba(99,102,241,0.3)] scale-105"
                : "text-orange-950 dark:text-white/60 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 border border-orange-200/50 dark:border-white/10 shadow-sm dark:shadow-inner backdrop-blur-sm"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

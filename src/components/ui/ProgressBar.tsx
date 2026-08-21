interface ProgressBarProps {
  /** Value 0–100 */
  value: number;
  /** Color mode: auto picks green/yellow/red based on value thresholds */
  color?: "auto" | "green" | "yellow" | "red" | "orange";
  /** Bar height */
  height?: "sm" | "md";
  /** Show percentage label */
  showLabel?: boolean;
  className?: string;
}

const heightMap = { sm: "h-2", md: "h-3.5" } as const;

function resolveColor(value: number, color: ProgressBarProps["color"]) {
  if (color && color !== "auto") {
    const map = {
      green: "bg-gradient-to-r from-[#67c48a] to-[#4aad6f] dark:from-emerald-400 dark:to-emerald-500",
      yellow: "bg-yellow-400 dark:bg-amber-400",
      red: "bg-red-400 dark:bg-red-400",
      orange: "bg-gradient-to-r from-[#de9241] to-[#ca782a] dark:from-indigo-400 dark:to-violet-500",
    } as const;
    return map[color];
  }
  // auto
  if (value >= 100) return "bg-red-400 dark:bg-red-400";
  if (value >= 80) return "bg-yellow-400 dark:bg-amber-400";
  return "bg-[#67c48a] dark:bg-emerald-400";
}

export function ProgressBar({
  value,
  color = "auto",
  height = "sm",
  showLabel = false,
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const barColor = resolveColor(value, color);

  return (
    <div className={className}>
      <div className={`${heightMap[height]} w-full bg-[#f5e5cf] dark:bg-white/10 rounded-full overflow-hidden transition-colors duration-700`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(clampedValue, 2)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-bold text-[#cf833f] dark:text-indigo-300 mt-1 block">
          {clampedValue.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

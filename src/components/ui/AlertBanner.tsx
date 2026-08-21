interface AlertBannerProps {
  variant: "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variantMap = {
  success:
    "bg-[#f0fff4] dark:bg-emerald-500/10 text-green-700 dark:text-emerald-300 border border-green-100 dark:border-emerald-500/25",
  warning:
    "bg-[#fffbeb] dark:bg-amber-500/10 text-[#92610a] dark:text-amber-300 border border-yellow-100 dark:border-amber-500/25",
  error:
    "bg-[#fff5f5] dark:bg-red-500/10 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-500/25",
  info:
    "bg-[#fff8f2] dark:bg-white/5 text-[#8a7262] dark:text-white/60 border border-[#f2dfcb] dark:border-white/10",
} as const;

export function AlertBanner({ variant, icon, children, className = "" }: AlertBannerProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors duration-700 ${variantMap[variant]} ${className}`}
    >
      {icon && <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

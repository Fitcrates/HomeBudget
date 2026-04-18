interface AlertBannerProps {
  variant: "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const variantMap = {
  success: "bg-[#f0fff4] text-green-700 border border-green-100",
  warning: "bg-[#fffbeb] text-[#92610a] border border-yellow-100",
  error: "bg-[#fff5f5] text-red-600 border border-red-100",
  info: "bg-[#fff8f2] text-[#8a7262] border border-[#f2dfcb]",
} as const;

export function AlertBanner({ variant, icon, children, className = "" }: AlertBannerProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${variantMap[variant]} ${className}`}
    >
      {icon && <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

interface StatusBadgeProps {
  variant: "parent" | "partner" | "child" | "warning" | "success" | "info" | "error";
  children: React.ReactNode;
  className?: string;
}

const variantMap = {
  parent:
    "bg-[#fff1df] dark:bg-amber-500/10 text-[#b86a28] dark:text-amber-300 border-[#f3d3b6] dark:border-amber-500/25",
  child:
    "bg-[#eef4ff] dark:bg-indigo-500/15 text-[#3856a8] dark:text-indigo-300 border-[#c8d8ff] dark:border-indigo-500/30",
  partner:
    "bg-[#ebf7ef] dark:bg-emerald-500/10 text-[#46825d] dark:text-emerald-300 border-[#8bc5a0] dark:border-emerald-500/25",
  warning:
    "bg-[#fff3e7] dark:bg-amber-500/10 text-[#b86a28] dark:text-amber-300 border-[#f3d3b6] dark:border-amber-500/25",
  success:
    "bg-[#ecfdf3] dark:bg-emerald-500/10 text-[#2d8d56] dark:text-emerald-300 border-[#bbf7d0] dark:border-emerald-500/25",
  info:
    "bg-[#fff1e1] dark:bg-white/5 text-[#b55b1d] dark:text-white/60 border-[#f2dfcb] dark:border-white/10",
  error:
    "bg-[#fff2ec] dark:bg-red-500/10 text-[#a94d22] dark:text-red-300 border-[#ffc2af] dark:border-red-500/25",
} as const;

export function StatusBadge({ variant, children, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block transition-colors duration-700 ${variantMap[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

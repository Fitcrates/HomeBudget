interface StatusBadgeProps {
  variant: "parent" | "partner" | "child" | "warning" | "success" | "info" | "error";
  children: React.ReactNode;
  className?: string;
}

const variantMap = {
  parent: "bg-[#fff1df] text-[#b86a28] border-[#f3d3b6]",
  child: "bg-[#eef4ff] text-[#3856a8] border-[#c8d8ff]",
  partner: "bg-[#ebf7ef] text-[#46825d] border-[#8bc5a0]",
  warning: "bg-[#fff3e7] text-[#b86a28] border-[#f3d3b6]",
  success: "bg-[#ecfdf3] text-[#2d8d56] border-[#bbf7d0]",
  info: "bg-[#fff1e1] text-[#b55b1d] border-[#f2dfcb]",
  error: "bg-[#fff2ec] text-[#a94d22] border-[#ffc2af]",
} as const;

export function StatusBadge({ variant, children, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block ${variantMap[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

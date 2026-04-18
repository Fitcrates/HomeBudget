import { forwardRef } from "react";

interface ButtonSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: "outline" | "ghost" | "dashed";
}

const variantMap = {
  outline:
    "border border-[#e6c9b0]/50 bg-white/60 backdrop-blur-sm text-[#8a4f2a] hover:border-[#cf833f]/60 hover:bg-white shadow-sm",
  ghost:
    "border border-[#f5e5cf] bg-white/60 text-[#cf833f] hover:bg-white shadow-sm",
  dashed:
    "border-2 border-dashed border-[#d2bcad]/70 bg-white/40 text-[#8a7262] hover:border-[#cf833f]/50 hover:bg-white/60",
} as const;

export const ButtonSecondary = forwardRef<HTMLButtonElement, ButtonSecondaryProps>(
  ({ icon, variant = "ghost", className = "", children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all outline-none disabled:opacity-50 flex items-center justify-center gap-2 ${variantMap[variant]} ${className}`}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  }
);

ButtonSecondary.displayName = "ButtonSecondary";

import { forwardRef } from "react";

interface ButtonSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: "outline" | "ghost" | "dashed";
}

const variantMap = {
  outline:
    "border border-orange-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm text-orange-800 dark:text-white/80 hover:border-orange-500/60 dark:hover:border-indigo-400/60 hover:bg-white dark:hover:bg-white/10 shadow-sm transition-colors duration-700",
  ghost:
    "border border-orange-100 dark:border-white/5 bg-white/60 dark:bg-white/5 text-orange-500 dark:text-indigo-400 hover:bg-white dark:hover:bg-white/10 shadow-sm transition-colors duration-700",
  dashed:
    "border-2 border-dashed border-orange-200/70 dark:border-white/20 bg-white/40 dark:bg-white/5 text-orange-900/60 dark:text-white/50 hover:border-orange-500/50 dark:hover:border-indigo-400/50 hover:bg-white/60 dark:hover:bg-white/10 transition-colors duration-700",
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

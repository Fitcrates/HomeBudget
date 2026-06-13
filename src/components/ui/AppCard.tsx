import { forwardRef } from "react";

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding size */
  padding?: "none" | "sm" | "md" | "lg";
  /** Inner card variant (row inside a main card) */
  variant?: "default" | "inner" | "highlight";
}

const paddingMap = { none: "p-0", sm: "p-3.5", md: "p-5", lg: "p-6" } as const;

const variantMap = {
  default:
    "w-full rounded-[24px] border border-orange-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 shadow-[0_8px_32px_rgba(200,120,60,0.1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-colors duration-700",
  inner:
    "rounded-[20px] border border-orange-200/50 dark:border-white/10 bg-white/70 dark:bg-white/5 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-xl transition-colors duration-700",
  highlight:
    "w-full rounded-[24px] border-2 border-orange-400/40 dark:border-indigo-500/40 bg-white/70 dark:bg-indigo-500/10 shadow-[0_8px_32px_rgba(200,120,60,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_8px_32px_rgba(99,102,241,0.2)] backdrop-blur-2xl transition-colors duration-700",
} as const;

export const AppCard = forwardRef<HTMLDivElement, AppCardProps>(
  ({ padding = "lg", variant = "default", className = "", children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={`${variantMap[variant]} ${paddingMap[padding]} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

AppCard.displayName = "AppCard";

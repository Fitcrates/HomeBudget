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
    "w-full rounded-xl border border-white/50 bg-white/40 shadow-[0_8px_32px_rgba(180,120,80,0.15)] backdrop-blur-xl",
  inner:
    "rounded-xl border border-white/60 bg-white/50 shadow-sm",
  highlight:
    "rounded-xl border-2 border-[#cf833f]/30 bg-white/60 shadow-[0_8px_32px_rgba(200,120,60,0.15)] backdrop-blur-xl",
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

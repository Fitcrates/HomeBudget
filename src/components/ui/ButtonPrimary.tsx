import { forwardRef } from "react";

interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "danger";
  rounded?: "xl" | "full";
}

const sizeMap = {
  sm: "py-2 text-xs",
  md: "py-3 text-[14px]",
  lg: "py-4 text-[15px]",
} as const;

const variantMap = {
  primary: "bg-gradient-to-r from-[#de9241] to-[#ca782a] shadow-[0_4px_16px_rgba(200,120,50,0.3)]",
  danger: "bg-gradient-to-r from-[#e86b58] to-[#d44f43] shadow-[0_4px_16px_rgba(200,60,50,0.3)]",
} as const;

export const ButtonPrimary = forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  (
    {
      loading = false,
      icon,
      size = "md",
      variant = "primary",
      rounded = "full",
      className = "",
      children,
      disabled,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`w-full ${sizeMap[size]} ${variantMap[variant]} text-white rounded-${rounded} font-medium hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
        {...rest}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {icon}
            <span>{children}</span>
          </>
        )}
      </button>
    );
  }
);

ButtonPrimary.displayName = "ButtonPrimary";

import { forwardRef } from "react";

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: "sm" | "md";
}

const sizeMap = {
  sm: "text-sm py-2",
  md: "text-base py-3",
} as const;

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ selectSize = "md", className = "", children, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 outline-none focus:border-[#cf833f] focus:bg-white transition-all text-[#2b180a] font-bold shadow-inner ${sizeMap[selectSize]} ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);

FormSelect.displayName = "FormSelect";

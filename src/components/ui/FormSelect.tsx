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
        className={`w-full bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-white/60 dark:border-white/10 rounded-xl px-4 outline-none focus:border-[#cf833f] dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-white/10 transition-all duration-700 text-[#2b180a] dark:text-white font-bold shadow-inner [&>option]:bg-white dark:[&>option]:bg-[#16161c] [&>option]:text-[#2b180a] dark:[&>option]:text-white ${sizeMap[selectSize]} ${className}`}
        {...rest}
      >
        {children}
      </select>
    );
  }
);

FormSelect.displayName = "FormSelect";

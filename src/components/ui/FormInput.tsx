import { forwardRef } from "react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input size variant */
  inputSize?: "sm" | "md" | "lg";
  /** Show error ring */
  error?: boolean;
}

const sizeMap = {
  sm: "text-sm py-2",
  md: "text-md py-2",
  lg: "text-lg py-3",
} as const;

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ inputSize = "md", error = false, className = "", ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full bg-white/70 dark:bg-white/5 backdrop-blur-sm border rounded-xl px-4 outline-none focus:border-orange-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-white/10 transition-all text-orange-950 dark:text-white font-bold shadow-inner placeholder-orange-900/30 dark:placeholder-white/30 duration-700 ${sizeMap[inputSize]} ${
          error ? "border-red-300 dark:border-red-500/50 focus:border-red-400 dark:focus:border-red-500" : "border-white/60 dark:border-white/10"
        } ${className}`}
        {...rest}
      />
    );
  }
);

FormInput.displayName = "FormInput";

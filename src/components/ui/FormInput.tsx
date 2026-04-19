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
        className={`w-full bg-white/70 backdrop-blur-sm border rounded-xl px-4 outline-none focus:border-[#cf833f] focus:bg-white transition-all text-[#2b180a] font-bold shadow-inner placeholder-[#e0c9b7] ${sizeMap[inputSize]} ${
          error ? "border-red-300 focus:border-red-400" : "border-white/60"
        } ${className}`}
        {...rest}
      />
    );
  }
);

FormInput.displayName = "FormInput";

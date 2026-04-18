interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function FormLabel({ children, className = "", ...rest }: FormLabelProps) {
  return (
    <label
      className={`block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1 ${className}`}
      {...rest}
    >
      {children}
    </label>
  );
}

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export function FormLabel({ children, className = "", ...rest }: FormLabelProps) {
  return (
    <label
      className={`block text-[11px] font-bold text-orange-900/50 dark:text-white/40 uppercase tracking-wider mb-2 ml-1 transition-colors duration-700 ${className}`}
      {...rest}
    >
      {children}
    </label>
  );
}

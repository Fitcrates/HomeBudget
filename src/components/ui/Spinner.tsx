interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-12 w-12" } as const;

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-[#d87635] ${sizeMap[size]}`} />
    </div>
  );
}

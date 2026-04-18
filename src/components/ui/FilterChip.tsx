interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function FilterChip({ label, active, onClick, icon, className = "" }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap ${
        active
          ? "border-[#cf833f] bg-[#fff1e1] text-[#b55b1d]"
          : "border-[#f2dfcb] bg-white/80 text-[#8a7262] hover:bg-white"
      } ${className}`}
    >
      {icon && <span className="mr-1 inline-flex">{icon}</span>}
      {label}
    </button>
  );
}

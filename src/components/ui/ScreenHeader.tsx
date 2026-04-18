interface ScreenHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function ScreenHeader({
  icon,
  title,
  subtitle,
  onBack,
  action,
  className = "",
}: ScreenHeaderProps) {
  return (
    <div className={`pt-2 pb-1 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        {onBack && (
          <button
            onClick={onBack}
            className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none drop-shadow-sm"
          >
            ←
          </button>
        )}
        <span className="drop-shadow-sm [&>svg]:w-8 [&>svg]:h-8 [&>svg]:text-[#c76823]">
          {icon}
        </span>
        <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a] drop-shadow-sm">
          {title}
        </h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {subtitle && (
        <p className="text-xs text-[#8a7262] font-medium ml-10 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

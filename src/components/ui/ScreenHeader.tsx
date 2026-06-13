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
            className="text-2xl text-orange-900/70 dark:text-white/70 font-bold hover:text-orange-950 dark:hover:text-white leading-none drop-shadow-sm transition-colors duration-700"
          >
            ←
          </button>
        )}
        <span className="drop-shadow-sm [&>svg]:w-8 [&>svg]:h-8 [&>svg]:text-orange-500 dark:[&>svg]:text-indigo-400 [&>svg]:transition-colors [&>svg]:duration-700">
          {icon}
        </span>
        <h2 className="text-[26px] font-medium tracking-tight text-orange-950 dark:text-white drop-shadow-sm transition-colors duration-700">
          {title}
        </h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {subtitle && (
        <p className="text-xs text-orange-900/60 dark:text-white/50 font-medium ml-10 mt-1 transition-colors duration-700">{subtitle}</p>
      )}
    </div>
  );
}

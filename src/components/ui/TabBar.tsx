interface Tab<T extends string> {
  key: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: TabBarProps<T>) {
  return (
    <div
      className={`flex bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-orange-200/50 dark:border-white/10 rounded-[18px] p-1.5 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] gap-1 transition-colors duration-700 ${className}`}
    >
      {tabs.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
            value === key
              ? "bg-gradient-to-r from-orange-500 to-amber-500 dark:from-indigo-500 dark:to-violet-600 text-white shadow-md dark:shadow-[0_4px_12px_rgba(99,102,241,0.3)] scale-100"
              : "text-orange-950/60 dark:text-white/50 hover:text-orange-950 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10"
          }`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          <span>{label}</span>
          {badge !== undefined && (
            <span className="bg-orange-600 dark:bg-indigo-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1 font-bold">
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

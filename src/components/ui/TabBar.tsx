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
      className={`flex bg-[#fdf9f1] rounded-xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1 ${className}`}
    >
      {tabs.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            value === key
              ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
              : "text-[#8a7262] hover:text-[#cf833f]"
          }`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          <span>{label}</span>
          {badge !== undefined && (
            <span className="bg-[#b86a28] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full ml-1 font-bold">
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

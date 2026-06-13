import React from "react";
import { Settings, LogOut, Moon, Sun } from "lucide-react";

interface ScreenHeaderProps {
  title: string;
  onSettingsClick?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function ScreenHeader({ title, onSettingsClick, isDark, onToggleTheme }: ScreenHeaderProps) {
  return (
    <header className="relative z-20 px-4 pt-4 pb-2 flex items-center justify-between transition-colors duration-700">
      <h2 className="text-2xl font-bold text-orange-950 dark:text-white transition-colors duration-700" style={{ fontFamily: 'var(--font-heading)' }}>
        {title}
      </h2>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 dark:bg-white/10 border border-orange-200/50 dark:border-white/10 shadow-sm dark:shadow-inner text-orange-600 dark:text-indigo-300 backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label="Przełącz motyw"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 dark:bg-white/10 border border-orange-200/50 dark:border-white/10 shadow-sm dark:shadow-inner text-orange-600 dark:text-indigo-300 backdrop-blur-xl hover:scale-105 active:scale-95 transition-all duration-300"
            aria-label="Ustawienia domu"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

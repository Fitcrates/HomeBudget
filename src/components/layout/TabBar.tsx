import React from "react";
import { Receipt, PiggyBank, Bot } from "lucide-react";
import { DashboardIcon } from "../ui/icons/DashboardIcon";

type Screen = "dashboard" | "expenses" | "add" | "household" | "ocr" | "reviewQueue" | "goals" | "chat";

interface TabBarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function TabBar({ currentScreen, onNavigate }: TabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-4 sm:px-6 z-50 pointer-events-none lg:left-1/2 lg:-translate-x-1/2 lg:max-w-[420px] lg:bottom-4 transition-all duration-700">
      {/* Floating Glassmorphism Container */}
      <nav className="w-full max-w-[380px] mx-auto flex items-center justify-between px-3 py-2.5 pointer-events-auto rounded-[28px] bg-white/70 dark:bg-[#111111]/80 backdrop-blur-2xl border border-orange-200/50 dark:border-white/10 shadow-[0_8px_32px_rgba(200,120,50,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-700">
        
        <NavBtn
          icon={<DashboardIcon className="w-6 h-6" />}
          active={currentScreen === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />
        <NavBtn
          icon={<Receipt className="w-6 h-6" strokeWidth={2.2} />}
          active={currentScreen === "expenses"}
          onClick={() => onNavigate("expenses")}
        />
        
        {/* Floating Add Button */}
        <button
          onClick={() => onNavigate("add")}
          className="relative w-[56px] h-[56px] -mt-8 rounded-full flex flex-col items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 group"
        >
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-orange-400 dark:bg-indigo-500 blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
          
          {/* Button body */}
          <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 dark:from-indigo-500 dark:to-violet-600 shadow-[0_4px_20px_rgba(249,115,22,0.4)] dark:shadow-[0_4px_20px_rgba(99,102,241,0.4)] border-4 border-[#fdf8f2] dark:border-[#0a0a0a] transition-colors duration-700">
            <span className="text-3xl leading-none font-light mb-0.5">+</span>
          </div>
        </button>

        <NavBtn
          icon={<PiggyBank className="w-[24px] h-[24px]" strokeWidth={2.2} />}
          active={currentScreen === "goals"}
          onClick={() => onNavigate("goals")}
        />
        <NavBtn
          icon={<Bot className="w-6 h-6" strokeWidth={2.2} />}
          active={currentScreen === "chat"}
          onClick={() => onNavigate("chat")}
        />

      </nav>
    </div>
  );
}

function NavBtn({
  icon,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-12 h-12 rounded-[18px] transition-all duration-300 outline-none group"
    >
      {/* Active Indicator Background */}
      <div 
        className={`absolute inset-0 rounded-[18px] transition-all duration-300 ${
          active ? "bg-orange-100/60 dark:bg-white/10 scale-100" : "bg-transparent scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-hover:bg-black/5 dark:group-hover:bg-white/5"
        }`} 
      />
      
      {/* Icon Wrapper */}
      <div
        className={`relative transition-all duration-300 ${
          active 
            ? "text-orange-600 dark:text-indigo-300 scale-110 drop-shadow-[0_2px_8px_rgba(234,88,12,0.3)] dark:drop-shadow-[0_2px_8px_rgba(165,180,252,0.4)]" 
            : "text-orange-900/40 dark:text-white/40 scale-100 group-hover:text-orange-900/60 dark:group-hover:text-white/60"
        }`}
      >
        {icon}
      </div>
    </button>
  );
}

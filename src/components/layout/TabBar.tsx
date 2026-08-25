import React, { useLayoutEffect, useRef } from "react";
import { PiggyBank, Bot, Plane } from "lucide-react";
import { DashboardIcon } from "../ui/icons/DashboardIcon";

type Screen = "dashboard" | "trips" | "add" | "household" | "ocr" | "reviewQueue" | "goals" | "chat";

interface TabBarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function TabBar({ currentScreen, onNavigate }: TabBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Ile miejsca zajmuje dolny chrome (pasek + wystajacy FAB + safe-area).
  // Ekrany czytaja to jako --bottom-chrome-h, zamiast zgadywac stala wartosc:
  // na telefonach z gestami safe-area potrafi dodac kilkadziesiat pikseli,
  // przez co zgadniete pb-28 zostawialo martwe pole nad nawigacja.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const fab = fabRef.current;
    if (!nav || !fab) return;

    function publish() {
      const navRect = nav!.getBoundingClientRect();
      const fabRect = fab!.getBoundingClientRect();
      const height = navRect.bottom - Math.min(navRect.top, fabRect.top);
      document.documentElement.style.setProperty("--bottom-chrome-h", `${Math.round(height)}px`);
    }

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    window.addEventListener("resize", publish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, []);

  return (
    /* absolute, nie fixed: fixed kotwiczy sie do layout viewportu, a powloka
       aplikacji ma h-dvh — gdy te dwie wysokosci sie roznily (pasek adresu,
       gesty), nawigacja siadala nizej niz koniec <main> i robila sie dziura. */
    <div className="absolute bottom-0 left-0 w-full z-50 transition-all duration-700">
      {/* Docked Glassmorphism Container */}
      <nav ref={navRef} className="w-full flex items-center justify-between px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] rounded-t-[28px] bg-white/80 dark:bg-[#111111]/90 backdrop-blur-2xl border-t border-orange-200/50 dark:border-white/10 shadow-[0_-8px_32px_rgba(200,120,50,0.1)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)] transition-all duration-700">
        
        <NavBtn
          icon={<DashboardIcon className="w-6 h-6" />}
          active={currentScreen === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />
        <NavBtn
          icon={<Plane className="w-6 h-6" strokeWidth={2.2} />}
          active={currentScreen === "trips"}
          onClick={() => onNavigate("trips")}
        />
        
        {/* Floating Add Button */}
        <button
          ref={fabRef}
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

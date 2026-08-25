import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { DashboardScreen, DashboardTab } from "./screens/DashboardScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { HouseholdScreen } from "./screens/HouseholdScreen";
import { OcrScreen } from "./screens/OcrScreen";
import { EmailInboxScreen } from "./screens/EmailInboxScreen";
import { GoalsScreen } from "./screens/GoalsScreenV2";
import { ChatScreen } from "./screens/ChatScreen";
import { TripsScreen } from "./screens/TripsScreen";
import { BadgeNotificationProvider } from "./providers/BadgeNotificationProvider";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TabBar } from "./layout/TabBar";
import { ScreenHeader } from "./layout/ScreenHeader";
import { applyAppTheme, getInitialDarkMode } from "../lib/theme";

type Screen = "dashboard" | "trips" | "add" | "household" | "ocr" | "reviewQueue" | "goals" | "chat";

type OcrTarget =
  | { type: "expense" }
  | { type: "trip"; tripId: Id<"trips">; tripName?: string };

interface Household {
  _id: Id<"households">;
  name: string;
  currency: string;
  inviteCode: string;
  role: "owner" | "member";
  financialRole?: "parent" | "partner" | "child";
}

interface Props {
  household: Household;
  households: Household[];
  onSwitchHousehold: (id: string) => void;
  initialScreen?: Screen;
  initialTripId?: Id<"trips">;
}

export function MainApp({ household, households, onSwitchHousehold, initialScreen, initialTripId }: Props) {
  const [screen, setScreen] = useState<Screen>(initialScreen ?? "dashboard");
  const [dashboardInitialTab, setDashboardInitialTab] = useState<DashboardTab>("overview");
  const [ocrStorageIds, setOcrStorageIds] = useState<Id<"_storage">[]>([]);
  const [ocrMimeTypes, setOcrMimeTypes] = useState<string[]>([]);
  const [ocrTarget, setOcrTarget] = useState<OcrTarget>({ type: "expense" });
  const [selectedTripAfterOcr, setSelectedTripAfterOcr] = useState<Id<"trips"> | undefined>(initialTripId);
  const syncDefaultCatalog = useMutation(api.categories.syncDefaultCatalog);

  const [isDark, setIsDark] = useState(getInitialDarkMode);

  useEffect(() => {
    applyAppTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    void syncDefaultCatalog({ householdId: household._id }).catch((err) => {
      console.warn("Category catalog sync failed", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household._id]);

  function handleOcrCapture(storageIds: Id<"_storage">[], mimeTypes: string[] = [], target: OcrTarget = { type: "expense" }) {
    setOcrStorageIds(storageIds);
    setOcrMimeTypes(mimeTypes);
    setOcrTarget(target);
    setScreen("ocr");
  }

  function handleNavigate(nextScreen: Screen) {
    if (nextScreen === "dashboard" && screen !== "dashboard") {
      setDashboardInitialTab("overview");
    }
    setScreen(nextScreen);
  }

  const getScreenTitle = (s: Screen) => {
    switch (s) {
      case "dashboard": return "Pulpit";
      case "trips": return "Wyjazdy";
      case "add": return "Dodaj wydatek";
      case "household": return "Twój dom";
      case "ocr": return "Skaner paragonów";
      case "reviewQueue": return "Do zatwierdzenia";
      case "goals": return "Budżet";
      case "chat": return "Asystent AI";
      default: return "Domowe Gniazdo";
    }
  };

  return (
    <BadgeNotificationProvider householdId={household._id}>
      <div className="relative w-full h-dvh flex flex-col bg-[#fcf8f2] dark:bg-[#0a0a0a] overflow-hidden selection:bg-orange-500/30 dark:selection:bg-indigo-500/30 transition-colors duration-700">
        
        {/* ── Animated Background ──────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-400/20 dark:bg-violet-600/15 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse transition-colors duration-700" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-500/15 dark:bg-indigo-600/15 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse transition-colors duration-700" style={{ animationDuration: '10s', animationDelay: '1s' }} />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.05] dark:opacity-[0.15] mix-blend-overlay" />
        </div>

        {/* ── Main App Container ───────────────────────────────── */}
        <div className="relative z-10 w-full max-w-[420px] mx-auto h-full flex flex-col pt-[env(safe-area-inset-top)] lg:my-4 lg:h-[90vh] lg:rounded-[32px] lg:border lg:border-orange-200/50 dark:lg:border-white/10 lg:bg-white/40 dark:lg:bg-white/5 lg:backdrop-blur-3xl lg:shadow-2xl transition-all duration-700">
          
          <ScreenHeader 
            title={getScreenTitle(screen)} 
            onSettingsClick={() => setScreen("household")}
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
          />

          {/* Dol wyliczany z realnej wysokosci nawigacji (--bottom-chrome-h ustawia
              TabBar), nie ze stalego pb-28 — inaczej na telefonach z safe-area
              zostawal pas martwej przestrzeni, a sticky CTA wisialo za wysoko. */}
          <main
            className="flex-1 overflow-y-auto overflow-x-hidden pt-2 px-3 sm:px-4 space-y-5 scrollbar-hide relative z-10"
            style={{ paddingBottom: "calc(var(--bottom-chrome-h, 7rem) + 0.5rem)" }}
          >
            {screen === "dashboard" && (
              <DashboardScreen
                householdId={household._id}
                currency={household.currency}
                initialTab={dashboardInitialTab}
              />
            )}
            {screen === "trips" && (
              <TripsScreen
                householdId={household._id}
                householdCurrency={household.currency}
                initialTripId={selectedTripAfterOcr ?? initialTripId}
                onOcrCapture={handleOcrCapture}
              />
            )}
            {screen === "add" && (
              <AddExpenseScreen
                householdId={household._id}
                currency={household.currency}
                onSuccess={() => {
                  setDashboardInitialTab("history");
                  setScreen("dashboard");
                }}
                onOcrCapture={handleOcrCapture}
              />
            )}
            {screen === "household" && (
              <HouseholdScreen
                household={household}
                households={households}
                onSwitchHousehold={onSwitchHousehold}
                onOpenInbox={() => setScreen("reviewQueue")}
              />
            )}
            {screen === "ocr" && ocrStorageIds.length > 0 && (
              <OcrScreen
                storageIds={ocrStorageIds}
                mimeTypes={ocrMimeTypes}
                householdId={household._id}
                tripTarget={ocrTarget.type === "trip" ? ocrTarget : undefined}
                onDone={() => {
                  if (ocrTarget.type === "trip") {
                    setSelectedTripAfterOcr(ocrTarget.tripId);
                    setScreen("trips");
                    return;
                  }
                  setDashboardInitialTab("history");
                  setScreen("dashboard");
                }}
                onOpenReviewQueue={() => setScreen("reviewQueue")}
              />
            )}
            {screen === "reviewQueue" && (
              <AddExpenseScreen
                householdId={household._id}
                currency={household.currency}
                initialTab="queue"
                onSuccess={() => {
                  setDashboardInitialTab("history");
                  setScreen("dashboard");
                }}
                onOcrCapture={handleOcrCapture}
              />
            )}
            {screen === "goals" && (
              <GoalsScreen householdId={household._id} currency={household.currency} />
            )}
            {screen === "chat" && (
              <ChatScreen householdId={household._id} />
            )}
          </main>
        </div>

        <TabBar currentScreen={screen} onNavigate={handleNavigate} />
      </div>
    </BadgeNotificationProvider>
  );
}

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { HouseholdScreen } from "./screens/HouseholdScreen";
import { OcrScreen } from "./screens/OcrScreen";
import { EmailInboxScreen } from "./screens/EmailInboxScreen";
import { GoalsScreen } from "./screens/GoalsScreenV2";
import { ChatScreen } from "./screens/ChatScreen";
import { BadgeNotificationProvider } from "./providers/BadgeNotificationProvider";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Receipt, PiggyBank, Bot } from "lucide-react";
import { DashboardIcon } from "./ui/icons/DashboardIcon";

type Screen = "dashboard" | "expenses" | "add" | "household" | "ocr" | "reviewQueue" | "goals" | "chat";

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
}

export function MainApp({ household, households, onSwitchHousehold }: Props) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [ocrStorageIds, setOcrStorageIds] = useState<Id<"_storage">[]>([]);
  const [ocrMimeTypes, setOcrMimeTypes] = useState<string[]>([]);
  const syncDefaultCatalog = useMutation(api.categories.syncDefaultCatalog);

  useEffect(() => {
    void syncDefaultCatalog({ householdId: household._id }).catch((err) => {
      console.warn("Category catalog sync failed", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household._id]);

  function handleOcrCapture(storageIds: Id<"_storage">[], mimeTypes: string[] = []) {
    setOcrStorageIds(storageIds);
    setOcrMimeTypes(mimeTypes);
    setScreen("ocr");
  }

  return (
    <BadgeNotificationProvider householdId={household._id}>
      <div
        className="w-full max-w-[420px] h-dvh flex flex-col mx-auto relative font-sans selection:bg-orange-200 pt-[env(safe-area-inset-top)] lg:my-4 lg:h-[90vh]"
        style={{
          background: "linear-gradient(160deg, var(--color-light) 0%, var(--color-app-top) 100%)",
          color: "var(--text-primary)",
          boxShadow: "0 0 60px rgba(160, 100, 50, 0.15)",
          borderRadius: "var(--radius-xl)",
        }}
      >
        {/* ── Top bar ─────────────────────────────────────── */}
        <header className="relative z-20 px-3 sm:px-4 pt-3 pb-2">
          <div className="flex justify-end">
            <button
              onClick={() => setScreen("household")}
              disabled={screen === "household"}
              className="text-xs font-bold rounded-full px-3.5 py-2 transition-all flex items-center gap-1"
              style={{
                background: screen === "household"
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.7)",
                border: `1.5px solid ${screen === "household" ? "var(--border-divider)" : "var(--border-subtle)"}`,
                color: screen === "household" ? "var(--text-faint)" : "var(--accent)",
                cursor: screen === "household" ? "default" : "pointer",
                boxShadow: screen === "household" ? "none" : "var(--shadow-soft)",
              }}
            >
              ⚙️ Dom
            </button>
          </div>
        </header>

        {/* ── Main content area ───────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-28 relative z-10 px-3 sm:px-4 space-y-5 scrollbar-hide">
          {screen === "dashboard" && (
            <DashboardScreen householdId={household._id} currency={household.currency} />
          )}
          {screen === "expenses" && (
            <ExpensesScreen householdId={household._id} currency={household.currency} />
          )}
          {screen === "add" && (
            <AddExpenseScreen
              householdId={household._id}
              currency={household.currency}
              onSuccess={() => setScreen("expenses")}
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
              onDone={() => setScreen("expenses")}
              onOpenReviewQueue={() => setScreen("reviewQueue")}
            />
          )}
          {screen === "reviewQueue" && (
            <AddExpenseScreen
              householdId={household._id}
              currency={household.currency}
              initialTab="queue"
              onSuccess={() => setScreen("expenses")}
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

      {/* ── Bottom navigation ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-[var(--color-light)] via-[var(--color-light)]/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-6 z-50 pointer-events-none lg:left-1/2 lg:-translate-x-1/2 lg:max-w-[420px] lg:bottom-4">
        <nav
          className="w-full mx-auto flex items-center justify-between px-4 py-2 pointer-events-auto"
          style={{
            background: "rgba(255, 252, 245, 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px solid rgba(235, 216, 200, 0.4)",
            borderRadius: "var(--radius-2xl)",
            boxShadow: "0 12px 40px rgba(180, 110, 50, 0.18), 0 0 0 1px rgba(255,255,255,0.3) inset",
          }}
        >
          <NavBtn
            icon={<DashboardIcon className="w-6 h-6" />}
            active={screen === "dashboard"}
            onClick={() => setScreen("dashboard")}
          />
          <NavBtn
            icon={<Receipt className="w-6 h-6" strokeWidth={2.2} />}
            active={screen === "expenses"}
            onClick={() => setScreen("expenses")}
          />
          <button
            onClick={() => setScreen("add")}
            className="w-[58px] h-[58px] -mt-6 rounded-full flex flex-col items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(145deg, var(--accent-light), var(--accent-dark))",
              boxShadow: "0 8px 24px rgba(202, 120, 42, 0.4), 0 0 0 4px var(--color-light)",
            }}
          >
            <span className="text-3xl leading-none font-light mb-0.5">+</span>
          </button>
          <NavBtn
            icon={<PiggyBank className="w-[22px] h-[22px]" strokeWidth={2.2} />}
            active={screen === "goals"}
            onClick={() => setScreen("goals")}
          />
          <NavBtn
            icon={<Bot className="w-6 h-6" strokeWidth={2.2} />}
            active={screen === "chat"}
            onClick={() => setScreen("chat")}
          />
        </nav>
      </div>
    </BadgeNotificationProvider>
  );
}

/* ── Navigation Button ─────────────────────────────────── */
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
      className="relative flex items-center justify-center w-12 h-12 rounded-xl transition-all outline-none"
      style={{
        background: active ? "rgba(250, 235, 205, 0.6)" : "transparent",
        boxShadow: active ? "var(--shadow-soft)" : "none",
        transform: active ? "scale(1.05)" : "scale(1)",
      }}
    >
      <div
        className="transition-all duration-300"
        style={{
          color: "var(--accent)",
          transform: active ? "scale(1.1)" : "scale(1)",
          filter: active
            ? "drop-shadow(0 2px 4px rgba(207,131,63,0.3))"
            : "grayscale(0.3) drop-shadow(0 1px 2px rgba(0,0,0,0.05))",
          opacity: active ? 1 : 0.55,
        }}
      >
        {icon}
      </div>
    </button>
  );
}

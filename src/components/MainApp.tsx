import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { AddExpenseScreen } from "./screens/AddExpenseScreen";
import { HouseholdScreen } from "./screens/HouseholdScreen";
import { OcrScreen } from "./screens/OcrScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { DashboardIcon } from "./ui/icons/DashboardIcon";
import { ExpensesIcon } from "./ui/icons/ExpensesIcon";
import { HomeIcon } from "./ui/icons/HomeIcon";
import { ScannerIcon } from "./ui/icons/ScannerIcon";
import { Star, Bot } from "lucide-react";

type Screen = "dashboard" | "expenses" | "add" | "household" | "ocr" | "goals" | "chat";

interface Household {
  _id: Id<"households">;
  name: string;
  currency: string;
  inviteCode: string;
  role: "owner" | "member";
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
    <>
      {/* Main Container */}
      <div className="w-full max-w-[420px] h-dvh flex flex-col mx-auto relative bg-gradient-to-b from-[#ebae69] via-[#faebcd] to-[#fcf4e4] text-[#2b180a] font-sans selection:bg-orange-200 lg:shadow-2xl lg:rounded-[2rem] lg:my-4 lg:h-[90vh]">
        {/* Screen Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-8 pb-28 relative z-10 px-2 sm:px-4 space-y-6 scrollbar-hide">
          {screen === "dashboard" && (
            <DashboardScreen householdId={household._id} currency={household.currency} onGoToHousehold={() => setScreen("household")} />
          )}
          {screen === "expenses" && (
            <ExpensesScreen householdId={household._id} currency={household.currency} />
          )}
          {screen === "add" && (
            <AddExpenseScreen
              householdId={household._id}
              onSuccess={() => setScreen("expenses")}
              onOcrCapture={handleOcrCapture}
            />
          )}
          {screen === "household" && (
            <HouseholdScreen
              household={household}
              households={households}
              onSwitchHousehold={onSwitchHousehold}
            />
          )}
          {screen === "ocr" && ocrStorageIds.length > 0 && (
            <OcrScreen
              storageIds={ocrStorageIds}
              mimeTypes={ocrMimeTypes}
              householdId={household._id}
              onDone={() => setScreen("expenses")}
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

      {/* Fixed Bottom Nav - Outside main container */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-gradient-to-t from-[#fcf4e4] via-[#fcf4e4]/95 to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-3 z-50 pointer-events-none lg:bottom-4">
        <nav className="w-full max-w-[360px] mx-auto bg-[#fffcf5]/90 backdrop-blur-xl border border-[#ebd8c8]/50 flex items-center justify-between px-3 py-2 shadow-[0_12px_40px_rgba(200,120,60,0.25)] rounded-[2rem] pointer-events-auto">
          <NavBtn icon={<DashboardIcon className="w-6 h-6 text-[#cf833f]" />} active={screen === "dashboard"} onClick={() => setScreen("dashboard")} />
          <NavBtn icon={<ExpensesIcon className="w-6 h-6 text-[#cf833f]" />} active={screen === "expenses"} onClick={() => setScreen("expenses")} />
          <button
            onClick={() => setScreen("add")}
            className="w-[60px] h-[60px] -mt-6 bg-gradient-to-tr from-[#de9241] to-[#ca782a] rounded-full flex flex-col items-center justify-center text-white shadow-[0_8px_20px_rgba(202,120,42,0.4)] border-4 border-[#fff1df] hover:scale-105 transition-transform"
          >
            <span className="text-3xl leading-none font-light mb-1">+</span>
          </button>
          <NavBtn icon={<Star className="w-[22px] h-[22px] text-[#cf833f]" strokeWidth={2.5} />} active={screen === "goals"} onClick={() => setScreen("goals")} />
          <NavBtn icon={<Bot className="w-6 h-6 text-[#cf833f]" />} active={screen === "chat"} onClick={() => setScreen("chat")} />
        </nav>
      </div>
    </>
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
      className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all outline-none ${active
          ? "bg-[#faebcd]/60 shadow-sm scale-105"
          : "opacity-60 hover:opacity-100 hover:bg-[#faebcd]/30"
        }`}
    >
      <div className={`transition-all duration-300 ${active ? "scale-110 drop-shadow-md" : "grayscale opacity-70 drop-shadow-sm"}`}>
        {icon}
      </div>
    </button>
  );
}

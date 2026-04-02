import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import { HouseholdSetup } from "./components/HouseholdSetup";
import { MainApp } from "./components/MainApp";
import { HomeIcon } from "./components/ui/icons/HomeIcon";

export default function App() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden flex flex-col bg-gradient-to-b from-[#f7e6cf] to-[#fcf4e4]">
      <Toaster position="top-center" richColors />
      <Authenticated>
        <div className="w-full mx-auto">
          <AuthenticatedApp />
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="text-center pt-8 mb-6">
              <div className="flex justify-center mb-4">
                <HomeIcon className="w-16 h-16 text-[#c76823]" />
              </div>
              <h1 className="text-3xl font-extrabold text-[#2b180a] tracking-tight drop-shadow-sm">Domowe Gniazdo</h1>
              <p className="text-[#6d4d38] mt-2 font-bold drop-shadow-sm">Zarządzaj budżetem domowym</p>
            </div>
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-[0_8px_32px_rgba(180,120,80,0.15)] overflow-hidden p-6">
              <SignInForm />
            </div>
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}

function AuthenticatedApp() {
  const households = useQuery(api.households.listMine);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

  if (households === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const activeHousehold =
    activeHouseholdId
      ? households.find((h) => h?._id === activeHouseholdId) ?? households[0]
      : households[0];

  if (!activeHousehold) {
    return <HouseholdSetup onCreated={(id) => setActiveHouseholdId(id)} />;
  }

  return (
    <MainApp
      household={activeHousehold as any}
      households={households as any[]}
      onSwitchHousehold={setActiveHouseholdId}
    />
  );
}

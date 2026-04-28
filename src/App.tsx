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
    <div className="min-h-dvh w-full overflow-x-hidden flex flex-col">
      <Toaster position="top-center" richColors />
      <Authenticated>
        <div className="w-full mx-auto">
          <AuthenticatedApp />
        </div>
      </Authenticated>
      <Unauthenticated>
        <AuthScreen />
      </Unauthenticated>
    </div>
  );
}

/* ── Auth / Login Screen ─────────────────────────────────── */
function AuthScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-5 min-h-dvh">
      {/* Decorative background blobs */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute -top-[30%] -right-[20%] w-[60vw] h-[60vw] rounded-full opacity-[0.12]"
          style={{
            background: "radial-gradient(circle, var(--accent-light), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-[20%] -left-[15%] w-[50vw] h-[50vw] rounded-full opacity-[0.08]"
          style={{
            background: "radial-gradient(circle, var(--accent), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* ── Logo & Branding ────────────────────────────── */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="flex justify-center mb-5">
            <div
              className="relative flex items-center justify-center w-20 h-20 rounded-[22px]"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.25))",
                boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.45)",
                backdropFilter: "blur(20px)",
              }}
            >
              <HomeIcon className="w-11 h-11 text-[#c76823]" />
            </div>
          </div>
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Domowe Gniazdo
          </h1>
          <p
            className="mt-2 text-[15px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Zarządzaj budżetem domowym
          </p>
        </div>

        {/* ── Auth Card ──────────────────────────────────── */}
        <div
          className="app-card p-6 animate-fade-in-up stagger-2"
        >
          <SignInForm />
        </div>

        {/* ── Footer note ────────────────────────────────── */}
        <p
          className="text-center mt-6 text-[11px] font-medium animate-fade-in stagger-4"
          style={{ color: "var(--text-faint)" }}
        >
          Twoje dane są bezpieczne i szyfrowane
        </p>
      </div>
    </div>
  );
}

/* ── Authenticated App (household routing) ───────────────── */
function AuthenticatedApp() {
  const households = useQuery(api.households.listMine);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

  if (households === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-dvh">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: "var(--accent)" }}
        />
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

import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { HouseholdSetup } from "./components/HouseholdSetup";
import { MainApp } from "./components/MainApp";
import { HomeIcon } from "./components/ui/icons/HomeIcon";
import { TripsScreen } from "./components/screens/TripsScreen";
import { Id } from "../convex/_generated/dataModel";
import { applyAppTheme, getInitialDarkMode, isDarkModeActive, subscribeToTheme } from "./lib/theme";

function getTripInviteCode() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("trip")?.trim().toUpperCase() || null;
}

function removeTripInviteFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("trip");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  // Toasts are portalled outside the themed tree, so Sonner needs the theme
  // handed to it explicitly — the `dark` class on <html> never reaches it.
  const isDark = useSyncExternalStore(subscribeToTheme, isDarkModeActive, () => false);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden flex flex-col">
      <Toaster position="top-center" richColors theme={isDark ? "dark" : "light"} />
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
  const [isDark, setIsDark] = useState(getInitialDarkMode);

  useEffect(() => {
    applyAppTheme(isDark);
  }, [isDark]);

  return (
    <div className="relative flex-1 flex items-center justify-center min-h-dvh bg-[#fcf8f2] dark:bg-[#0a0a0a] overflow-hidden selection:bg-orange-500/30 dark:selection:bg-indigo-500/30 transition-colors duration-700">
      
      {/* ── Theme Toggle Button ─────────────────────────────── */}
      <button
        onClick={() => setIsDark(!isDark)}
        className="absolute top-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white/60 dark:bg-white/10 border border-orange-200/50 dark:border-white/10 shadow-sm dark:shadow-inner text-orange-600 dark:text-indigo-300 backdrop-blur-xl hover:scale-110 active:scale-95 transition-all duration-300"
        aria-label="Przełącz motyw"
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* ── World-class Animated Background ─────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-400/30 dark:bg-violet-600/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse transition-colors duration-700" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-500/20 dark:bg-indigo-600/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse transition-colors duration-700" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[40%] w-[30vw] h-[30vw] rounded-full bg-rose-400/20 dark:bg-fuchsia-600/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse transition-colors duration-700" style={{ animationDuration: '7s', animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.05] dark:opacity-20 mix-blend-overlay" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 p-6">
        {/* ── Logo & Branding ────────────────────────────── */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="flex justify-center mb-6">
            <div className="relative flex items-center justify-center w-20 h-20 rounded-[28px] bg-white/60 dark:bg-white/5 border border-orange-200/50 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-2xl overflow-hidden group transition-all duration-700">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-400/20 to-amber-400/20 dark:from-violet-500/20 dark:to-fuchsia-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <HomeIcon className="w-10 h-10 text-orange-600 dark:text-white drop-shadow-sm dark:drop-shadow-md transform group-hover:scale-110 transition-all duration-500 ease-out" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[#4a2e1b] dark:text-white mb-2 transition-colors duration-700" style={{ fontFamily: 'var(--font-heading)' }}>
            Domowe Gniazdo
          </h1>
          <p className="text-[15px] font-medium text-[#8a5f42] dark:text-white/60 transition-colors duration-700">
            Inteligentne zarządzanie budżetem
          </p>
        </div>

        {/* ── Auth Card ──────────────────────────────────── */}
        <div className="bg-white/60 dark:bg-white/5 backdrop-blur-3xl rounded-[32px] border border-orange-100 dark:border-white/10 p-8 shadow-[0_8px_40px_rgba(200,120,50,0.08)] dark:shadow-2xl animate-fade-in-up transition-all duration-700" style={{ animationDelay: '0.1s' }}>
          <SignInForm />
        </div>

        {/* ── Footer note ────────────────────────────────── */}
        <p className="text-center mt-8 text-[12px] font-medium text-[#b38e74] dark:text-white/40 animate-fade-in transition-colors duration-700" style={{ animationDelay: '0.3s' }}>
          Twoje dane są w pełni bezpieczne i szyfrowane
        </p>
      </div>
    </div>
  );
}

/* ── Authenticated App (household routing) ───────────────── */
function AuthenticatedApp() {
  const households = useQuery(api.households.listMine);
  const trips = useQuery(api.trips.listMine);
  const joinTrip = useMutation(api.trips.joinByCode);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [joinedTripId, setJoinedTripId] = useState<Id<"trips"> | null>(null);
  const [joiningTrip, setJoiningTrip] = useState(() => Boolean(getTripInviteCode()));
  const inviteHandledRef = useRef(false);

  useEffect(() => {
    const inviteCode = getTripInviteCode();
    if (!inviteCode || inviteHandledRef.current) return;
    inviteHandledRef.current = true;
    setJoiningTrip(true);

    void joinTrip({ code: inviteCode })
      .then((tripId) => {
        setJoinedTripId(tripId);
        removeTripInviteFromUrl();
        toast.success("Dołączono do wyjazdu.");
      })
      .catch((error: any) => {
        toast.error(error?.message || "Nie udało się dołączyć do wyjazdu.");
      })
      .finally(() => setJoiningTrip(false));
  }, [joinTrip]);

  if (households === undefined || trips === undefined || joiningTrip) {
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
    if (joinedTripId || trips.length > 0) {
      return (
        <div className="min-h-dvh bg-[#fcf8f2] px-3 pb-10 pt-[max(1rem,env(safe-area-inset-top))] dark:bg-[#0a0a0a]">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-3 flex justify-end">
              <SignOutButton />
            </div>
            <TripsScreen householdCurrency="PLN" initialTripId={joinedTripId ?? undefined} />
          </div>
        </div>
      );
    }
    return <HouseholdSetup onCreated={(id) => setActiveHouseholdId(id)} />;
  }

  return (
    <MainApp
      household={activeHousehold as any}
      households={households as any[]}
      onSwitchHousehold={setActiveHouseholdId}
      initialScreen={joinedTripId ? "trips" : undefined}
      initialTripId={joinedTripId ?? undefined}
    />
  );
}

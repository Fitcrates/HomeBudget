"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LogIn, UserPlus, X } from "lucide-react";

type AuthMode = "signIn" | "signUp";
type Intent = "create" | "join";

const HOUSEHOLD_INTENT_KEY = "homebudget_household_intent";

const SUBMIT_LABEL: Record<AuthMode, Record<Intent, string>> = {
  signIn: { create: "Zaloguj się",  join: "Zaloguj się"                    },
  signUp: { create: "Utwórz konto", join: "Utwórz konto i przejdź do kodu" },
};

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [tripInviteCode, setTripInviteCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("trip")?.trim().toUpperCase() || "";
  });
  const [mode, setMode]       = useState<AuthMode>("signIn");
  const [intent, setIntent]   = useState<Intent>("create");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const isTripInvite = Boolean(tripInviteCode);
  const isJoining = intent === "join" || isTripInvite;

  function setModeAndIntent(m: AuthMode, i: Intent) {
    setMode(m);
    setIntent(i);
  }

  function dismissTripInvite() {
    const url = new URL(window.location.href);
    url.searchParams.delete("trip");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setTripInviteCode("");
    setModeAndIntent("signIn", "create");
  }

  function validateBeforeSubmit() {
    if (!emailRegex.test(email.trim().toLowerCase())) {
      toast.error("Podaj poprawny adres e-mail."); return false;
    }
    if (password.length < 8) {
      toast.error("Hasło musi mieć co najmniej 8 znaków."); return false;
    }
    if (mode === "signUp" && password !== confirmPassword) {
      toast.error("Hasła nie są zgodne."); return false;
    }
    return true;
  }

  async function handlePasswordAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateBeforeSubmit()) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set("flow", mode);
    formData.set("email", email.trim().toLowerCase());
    formData.set("password", password);

    try {
      if (isTripInvite) sessionStorage.removeItem(HOUSEHOLD_INTENT_KEY);
      else sessionStorage.setItem(HOUSEHOLD_INTENT_KEY, intent);
      await signIn("password", formData);
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("invalid password"))                       toast.error("Nieprawidłowe hasło. Spróbuj ponownie.");
      else if (msg.includes("invalid") && msg.includes("email")) toast.error("Nieprawidłowy e-mail.");
      else if (mode === "signIn")                                 toast.error("Nie udało się zalogować. Sprawdź e-mail i hasło.");
      else                                                        toast.error("Nie udało się utworzyć konta. Spróbuj ponownie.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-6">

      {/* ── Mode selector (segmented control) ───────────────── */}
      {!isJoining && (
        <div className="animate-fade-in">
          <div className="relative flex rounded-2xl p-1.5 bg-white/60 dark:bg-white/5 border border-orange-200/50 dark:border-white/10 backdrop-blur-md transition-colors duration-700">
            {/* Animated indicator */}
            <div
              className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out bg-gradient-to-br from-orange-400/20 to-amber-400/20 dark:from-indigo-500/20 dark:to-fuchsia-500/20 shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-orange-200/50 dark:border-white/5"
              style={{
                width: "calc(50% - 6px)",
                left: mode === "signIn" ? "6px" : "calc(50% + 0px)",
              }}
            />
            {(["signIn", "signUp"] as AuthMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeAndIntent(m, "create")}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                  mode === m 
                    ? "text-orange-950 dark:text-white" 
                    : "text-orange-900/50 dark:text-white/40 hover:text-orange-900/70 dark:hover:text-white/60"
                }`}
              >
                {m === "signIn" ? (
                  <><LogIn className="h-4 w-4" /> Logowanie</>
                ) : (
                  <><UserPlus className="h-4 w-4" /> Rejestracja</>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Join-with-code banner ─────────────────────────── */}
      {isJoining && (
        <div className="relative overflow-hidden rounded-[24px] p-5 animate-scale-in bg-gradient-to-br from-orange-100/80 to-amber-50/80 dark:from-indigo-500/20 dark:to-violet-500/20 border border-orange-200/50 dark:border-white/10 backdrop-blur-xl transition-colors duration-700">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-[0.05] dark:opacity-[0.15] mix-blend-overlay" />
          <button
            type="button"
            onClick={isTripInvite ? dismissTripInvite : () => setModeAndIntent("signIn", "create")}
            className="absolute right-4 top-4 rounded-full p-1.5 text-orange-900/40 dark:text-white/40 transition-all hover:bg-orange-500/10 dark:hover:bg-white/10 hover:text-orange-900 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/10 border border-orange-200/50 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-700">
              <KeyRound className="h-5 w-5 text-orange-500 dark:text-indigo-300" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-orange-950 dark:text-white transition-colors duration-700">
                {isTripInvite ? "Dołączasz do wyjazdu" : "Dołączasz z zaproszenia"}
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-orange-900/70 dark:text-indigo-200/80 transition-colors duration-700">
                {isTripInvite
                  ? mode === "signIn"
                    ? "Zaloguj się, a automatycznie dołączysz do wspólnego rozliczenia."
                    : "Utwórz konto, a automatycznie dołączysz do wspólnego rozliczenia."
                  : mode === "signIn"
                    ? "Zaloguj się, aby wpisać kod i dołączyć do domu."
                    : "Utwórz konto, aby wpisać kod i dołączyć do domu."}
              </p>
              {isTripInvite && (
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-600 dark:text-indigo-300">
                  Kod wyjazdu: {tripInviteCode}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                {(["signIn", "signUp"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModeAndIntent(m, "join")}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-300 border ${
                      mode === m
                        ? "bg-white/80 dark:bg-white/15 border-orange-200/50 dark:border-white/20 text-orange-600 dark:text-white shadow-sm"
                        : "bg-transparent border-transparent text-orange-900/50 dark:text-white/50 hover:bg-white/40 dark:hover:bg-white/5"
                    }`}
                  >
                    {m === "signIn" ? "Mam już konto" : "Nowe konto"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials form ──────────────────────────────── */}
      <form className="flex flex-col gap-4 animate-fade-in-up" onSubmit={handlePasswordAuth} style={{ animationDelay: '0.1s' }}>
        {/* Email */}
        <div className="relative group">
          <input
            className="w-full px-5 py-3.5 rounded-2xl bg-white/60 dark:bg-white/5 border border-orange-200/60 dark:border-white/10 text-orange-950 dark:text-white text-[15px] font-medium placeholder-orange-900/30 dark:placeholder-white/30 outline-none transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-white/10 focus:border-orange-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-orange-500/10 dark:focus:ring-indigo-500/10 shadow-sm dark:shadow-inner"
            id="auth-email"
            type="email"
            name="email"
            placeholder="Twój adres e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div className="relative group">
          <input
            className="w-full px-5 py-3.5 rounded-2xl bg-white/60 dark:bg-white/5 border border-orange-200/60 dark:border-white/10 text-orange-950 dark:text-white text-[15px] font-medium placeholder-orange-900/30 dark:placeholder-white/30 outline-none transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-white/10 focus:border-orange-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-orange-500/10 dark:focus:ring-indigo-500/10 shadow-sm dark:shadow-inner"
            id="auth-password"
            type="password"
            name="password"
            placeholder={mode === "signUp" ? "Ustaw silne hasło (min. 8 znaków)" : "Twoje hasło"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Confirm password (sign up only) */}
        {mode === "signUp" && (
          <div className="relative animate-slide-down">
            <input
              className="w-full px-5 py-3.5 rounded-2xl bg-white/60 dark:bg-white/5 border border-orange-200/60 dark:border-white/10 text-orange-950 dark:text-white text-[15px] font-medium placeholder-orange-900/30 dark:placeholder-white/30 outline-none transition-all duration-300 hover:bg-white/80 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-white/10 focus:border-orange-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-orange-500/10 dark:focus:ring-indigo-500/10 shadow-sm dark:shadow-inner"
              id="auth-confirm-password"
              type="password"
              name="confirmPassword"
              placeholder="Powtórz hasło"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        )}

        {/* Submit */}
        <button
          className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 dark:from-indigo-500 dark:to-violet-600 hover:from-orange-400 hover:to-amber-400 dark:hover:from-indigo-400 dark:hover:to-violet-500 text-white text-[15px] font-bold shadow-[0_0_30px_rgba(249,115,22,0.25)] dark:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] dark:hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          id="auth-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <span>
                {isTripInvite
                  ? mode === "signIn" ? "Zaloguj się i dołącz" : "Utwórz konto i dołącz"
                  : SUBMIT_LABEL[mode][intent]}
              </span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* ── Invite-code entry point ───────────────────────── */}
      {!isJoining && (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-4 my-6 opacity-60 dark:opacity-40">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-orange-900/20 dark:to-white/50" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-900/40 dark:text-white">lub</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-orange-900/20 dark:to-white/50" />
          </div>

          <button
            type="button"
            onClick={() => setModeAndIntent("signUp", "join")}
            className="group w-full flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-orange-200/50 dark:border-white/10 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100/50 dark:bg-indigo-500/20 text-orange-600 dark:text-indigo-300 group-hover:bg-orange-100 dark:group-hover:bg-indigo-500/30 group-hover:scale-110 transition-all duration-300">
                <KeyRound className="h-4.5 w-4.5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-orange-950 dark:text-white group-hover:text-orange-600 dark:group-hover:text-indigo-200 transition-colors">Mam kod zaproszenia</p>
                <p className="text-xs font-medium text-orange-900/60 dark:text-white/40 mt-0.5 transition-colors">Dołącz do istniejącego domu</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-900/30 dark:text-white/30 group-hover:text-orange-500 dark:group-hover:text-white/70 group-hover:translate-x-1 transition-all duration-300" />
          </button>
        </div>
      )}
    </div>
  );
}

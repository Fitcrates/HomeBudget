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
  const [mode, setMode]       = useState<AuthMode>("signIn");
  const [intent, setIntent]   = useState<Intent>("create");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  const isJoining = intent === "join";

  function setModeAndIntent(m: AuthMode, i: Intent) {
    setMode(m);
    setIntent(i);
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
      sessionStorage.setItem(HOUSEHOLD_INTENT_KEY, intent);
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
    <div className="w-full space-y-5">

      {/* ── Mode selector (segmented control) ───────────────── */}
      {!isJoining && (
        <div className="animate-fade-in">
          <div
            className="relative flex rounded-[14px] p-1"
            style={{ background: "rgba(207, 131, 63, 0.08)" }}
          >
            {/* Animated indicator */}
            <div
              className="absolute top-1 bottom-1 rounded-[11px] transition-all duration-300"
              style={{
                width: "calc(50% - 4px)",
                left: mode === "signIn" ? "4px" : "calc(50% + 0px)",
                background: "linear-gradient(135deg, var(--accent-light), var(--accent-dark))",
                boxShadow: "var(--shadow-cta)",
              }}
            />
            {(["signIn", "signUp"] as AuthMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeAndIntent(m, "create")}
                className="relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors duration-200"
                style={{
                  color: mode === m ? "white" : "var(--text-muted)",
                }}
              >
                {m === "signIn" ? (
                  <><LogIn className="h-3.5 w-3.5" /> Logowanie</>
                ) : (
                  <><UserPlus className="h-3.5 w-3.5" /> Rejestracja</>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Join-with-code banner ─────────────────────────── */}
      {isJoining && (
        <div
          className="relative overflow-hidden rounded-[18px] p-4 animate-scale-in"
          style={{
            background: "linear-gradient(135deg, #1a4fa3 0%, #2563eb 50%, #0ea5e9 100%)",
            boxShadow: "0 8px 32px rgba(37, 99, 235, 0.25)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }}
          />
          <button
            type="button"
            onClick={() => setModeAndIntent("signIn", "create")}
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/50 transition-all hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
            >
              <KeyRound className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Dołączasz kodem zaproszenia</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-blue-100/90">
                {mode === "signIn"
                  ? "Zaloguj się poniżej — od razu przejdziesz do wpisania kodu."
                  : "Utwórz konto poniżej — od razu przejdziesz do wpisania kodu."}
              </p>
              <div className="mt-3 flex gap-2">
                {(["signIn", "signUp"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModeAndIntent(m, "join")}
                    className="rounded-xl px-3.5 py-2 text-[12px] font-bold transition-all"
                    style={{
                      background: mode === m ? "white" : "rgba(255,255,255,0.15)",
                      color: mode === m ? "#1a4fa3" : "white",
                      boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                    }}
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
      <form className="flex flex-col gap-3.5 animate-fade-in-up stagger-1" onSubmit={handlePasswordAuth}>
        {/* Email */}
        <div className="relative">
          <input
            className="auth-input-field peer"
            id="auth-email"
            type="email"
            name="email"
            placeholder="Twój e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div className="relative">
          <input
            className="auth-input-field peer"
            id="auth-password"
            type="password"
            name="password"
            placeholder={mode === "signUp" ? "Ustaw hasło (min. 8 znaków)" : "Twoje hasło"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Confirm password (sign up only) */}
        {mode === "signUp" && (
          <div className="relative animate-slide-down">
            <input
              className="auth-input-field peer"
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
          className="auth-button flex items-center justify-center gap-2 stagger-2"
          id="auth-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <span>{SUBMIT_LABEL[mode][intent]}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* ── Invite-code entry point ───────────────────────── */}
      {!isJoining && (
        <>
          <div className="flex items-center gap-3 animate-fade-in stagger-3">
            <div className="flex-1 h-px" style={{ background: "var(--border-divider)" }} />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "var(--text-faint)" }}
            >
              lub
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--border-divider)" }} />
          </div>

          <div
            className="relative overflow-hidden rounded-[18px] p-4 animate-fade-in-up stagger-4"
            style={{
              background: "linear-gradient(135deg, #1a4fa3 0%, #2563eb 50%, #0ea5e9 100%)",
              boxShadow: "0 8px 32px rgba(37, 99, 235, 0.2)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            />
            <div className="relative flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <KeyRound className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Mam kod zaproszenia</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-blue-100/90">
                  Najpierw zaloguj się lub utwórz konto — od razu przejdziesz do wpisania kodu.
                </p>
                <button
                  type="button"
                  id="auth-join-code"
                  onClick={() => setModeAndIntent("signUp", "join")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-[#1a4fa3] transition-all hover:bg-blue-50"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                >
                  <KeyRound className="h-4 w-4" />
                  Chcę dołączyć kodem
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
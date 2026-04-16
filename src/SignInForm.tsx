"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LogIn, UserPlus, X } from "lucide-react";

type AuthMode = "signIn" | "signUp";
type Intent = "create" | "join";

const HOUSEHOLD_INTENT_KEY = "homebudget_household_intent";

const MODES: { mode: AuthMode; intent: Intent; icon: typeof LogIn; label: string }[] = [
  { mode: "signIn", intent: "create", icon: LogIn,    label: "Logowanie"   },
  { mode: "signUp", intent: "create", icon: UserPlus, label: "Rejestracja" },
];

const SUBMIT_LABEL: Record<AuthMode, Record<Intent, string>> = {
  signIn: { create: "Zaloguj się",  join: "Zaloguj się"                    },
  signUp: { create: "Utwórz konto", join: "Utwórz konto i przejdź do kodu" },
};

const HINT: Record<AuthMode, Record<Intent, string>> = {
  signIn: { create: "Masz już konto? Zaloguj się e-mailem i hasłem.", join: "Masz już konto? Zaloguj się, aby wpisać kod zaproszenia." },
  signUp: { create: "Tworzysz konto, a potem założysz nowe domostwo.", join: "Tworzysz konto, aby dołączyć kodem zaproszenia."          },
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
    <div className="w-full space-y-4">

      {/* ── Join-with-code banner (dismissible) ─────────────────── */}
      {isJoining ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a4fa3] via-[#2563eb] to-[#0ea5e9] p-4 shadow-lg shadow-blue-500/20">
          {/* subtle grid texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }}
          />
          <button
            type="button"
            onClick={() => setModeAndIntent("signIn", "create")}
            className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <KeyRound className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Dołączasz kodem zaproszenia</p>
              <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-blue-100">
                {mode === "signIn"
                  ? "Zaloguj się poniżej — od razu przejdziesz do wpisania kodu."
                  : "Utwórz konto poniżej — od razu przejdziesz do wpisania kodu."}
              </p>
              {/* Toggle between signIn / signUp within join flow */}
              <div className="mt-3 flex gap-2">
                {(["signIn", "signUp"] as AuthMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModeAndIntent(m, "join")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                      mode === m
                        ? "bg-white text-[#1a4fa3] shadow-sm"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {m === "signIn" ? "Mam już konto" : "Nowe konto"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Normal mode selector ─────────────────────────────── */
        <div className="rounded-xl border border-[#f2dfcf] bg-white/55 p-3">
          <p className="mb-2 text-[12px] font-bold text-[#8a7262]">Wybierz sposób wejścia</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ mode: m, intent: i, icon: Icon, label }) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeAndIntent(m, i)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                  mode === m
                    ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                    : "border border-[#f2dfcf] bg-white text-[#8a7262]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-medium text-[#8a7262]">{HINT[mode][intent]}</p>
        </div>
      )}

      {/* ── Shared credentials form ──────────────────────────────── */}
      <form className="flex flex-col gap-3" onSubmit={handlePasswordAuth}>
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Twój e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder={mode === "signUp" ? "Ustaw hasło (min. 8 znaków)" : "Twoje hasło"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "signUp" && (
          <input
            className="auth-input-field"
            type="password"
            name="confirmPassword"
            placeholder="Powtórz hasło"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        )}
        <button
          className="auth-button flex items-center justify-center gap-2"
          type="submit"
          disabled={submitting}
        >
          <span>{SUBMIT_LABEL[mode][intent]}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {/* ── Invite-code entry point (only when NOT already joining) ─ */}
      {!isJoining && (
        <>
          <div className="my-1 flex items-center">
            <hr className="grow border-[#ead8c8]" />
            <span className="mx-3 text-xs font-bold uppercase tracking-wider text-[#b89b87]">lub</span>
            <hr className="grow border-[#ead8c8]" />
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a4fa3] via-[#2563eb] to-[#0ea5e9] p-4 shadow-lg shadow-blue-500/20">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <KeyRound className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Mam kod zaproszenia</p>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-blue-100">
                  Najpierw zaloguj się lub utwórz konto — od razu przejdziesz do wpisania kodu.
                </p>
                <button
                  type="button"
                  onClick={() => setModeAndIntent("signUp", "join")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-[#1a4fa3] shadow-sm transition hover:bg-blue-50"
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
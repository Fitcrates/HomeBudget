"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LogIn, UserPlus } from "lucide-react";

type AuthMode = "signIn" | "signUp";

const HOUSEHOLD_INTENT_KEY = "homebudget_household_intent";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [intent, setIntent] = useState<"create" | "join">("create");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);

  function validateBeforeSubmit() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!emailRegex.test(normalizedEmail)) {
      toast.error("Podaj poprawny adres e-mail.");
      return false;
    }

    if (password.length < 8) {
      toast.error("Hasło musi mieć co najmniej 8 znaków.");
      return false;
    }

    if (mode === "signUp" && password !== confirmPassword) {
      toast.error("Hasła nie są zgodne.");
      return false;
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
      if (msg.includes("invalid password")) {
        toast.error("Nieprawidłowe hasło. Spróbuj ponownie.");
      } else if (msg.includes("invalid") && msg.includes("email")) {
        toast.error("Nieprawidłowy e-mail.");
      } else if (mode === "signIn") {
        toast.error("Nie udało się zalogować. Sprawdź e-mail i hasło.");
      } else {
        toast.error("Nie udało się utworzyć konta. Spróbuj ponownie.");
      }
      setSubmitting(false);
    }
  }

  function activateJoinPath() {
    setIntent("join");
    setMode("signUp");
  }

  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl border border-[#f2dfcf] bg-white/55 p-3">
        <p className="mb-2 text-[12px] font-bold text-[#8a7262]">Wybierz sposób wejścia</p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setIntent("create");
              setMode("signIn");
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
              mode === "signIn"
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                : "bg-white text-[#8a7262] border border-[#f2dfcf]"
            }`}
          >
            <LogIn className="h-4 w-4" />
            Logowanie
          </button>

          <button
            type="button"
            onClick={() => {
              setIntent("create");
              setMode("signUp");
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
              mode === "signUp" && intent === "create"
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                : "bg-white text-[#8a7262] border border-[#f2dfcf]"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Rejestracja
          </button>
        </div>

        <p className="mt-2 text-[11px] font-medium text-[#8a7262]">
          {mode === "signIn"
            ? "Masz już konto? Zaloguj się e-mailem i hasłem."
            : intent === "join"
            ? "Tworzysz konto, aby dołączyć kodem zaproszenia."
            : "Tworzysz konto, a potem założysz nowe domostwo."}
        </p>
      </div>

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

        <button className="auth-button flex items-center justify-center gap-2" type="submit" disabled={submitting}>
          <span>
            {mode === "signIn"
              ? "Zaloguj się"
              : intent === "join"
              ? "Utwórz konto i przejdź do kodu"
              : "Utwórz konto"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <div className="my-1 flex items-center justify-center">
        <hr className="my-2 grow border-[#ead8c8]" />
        <span className="mx-3 text-xs font-bold uppercase tracking-wider text-[#b89b87]">lub</span>
        <hr className="my-2 grow border-[#ead8c8]" />
      </div>

      <div className="rounded-xl border border-[#d8e8ff] bg-[#eef6ff] p-3.5">
        <div className="mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#3e6da9]" />
          <p className="text-sm font-bold text-[#2f527f]">Mam kod zaproszenia</p>
        </div>

        <p className="mb-3 text-[12px] font-medium text-[#4d6f98]">
          Aby dołączyć kodem, najpierw utwórz konto e-mail + hasło. Potem od razu przejdziesz do wpisania kodu.
        </p>

        <button
          type="button"
          className="w-full rounded-xl bg-[#3e6da9] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#355f95]"
          onClick={activateJoinPath}
        >
          Chcę dołączyć kodem
        </button>
      </div>
    </div>
  );
}

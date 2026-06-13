import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowRight, Clipboard, Mail, RefreshCw } from "lucide-react";
import { AppCard } from "../ui/AppCard";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ButtonSecondary } from "../ui/ButtonSecondary";
import { Spinner } from "../ui/Spinner";

interface Props {
  householdId: Id<"households">;
  onOpenInbox: () => void;
}

function copyText(value: string, successMessage: string) {
  navigator.clipboard.writeText(value).then(() => toast.success(successMessage));
}

export function EmailSetupCard({ householdId, onOpenInbox }: Props) {
  const setup = useQuery(api.emailTokens.getSetup, { householdId });
  const createInbox = useMutation(api.emailTokens.getOrCreate);
  const rotateInbox = useMutation(api.emailTokens.regenerate);
  const [busy, setBusy] = useState<"create" | "rotate" | null>(null);

  const inbox = setup?.inbox ?? null;

  async function handleCreate() {
    setBusy("create");
    try {
      const address = await createInbox({ householdId });
      toast.success(`Adres gotowy: ${address}`);
    } catch (error: any) {
      toast.error(error.message || "Nie udało się utworzyć adresu.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRotate() {
    if (!confirm("Wygenerować nowy adres? Stary przestanie działać.")) return;

    setBusy("rotate");
    try {
      const address = await rotateInbox({ householdId });
      toast.success(`Nowy adres gotowy: ${address}`);
    } catch (error: any) {
      toast.error(error.message || "Nie udało się odświeżyć adresu.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-600 dark:text-indigo-400 transition-colors duration-700" />
            <h3 className="text-[16px] font-medium text-orange-950 dark:text-white transition-colors duration-700">Forwardowanie rachunków</h3>
          </div>
          <p className="mt-1 text-xs font-medium leading-relaxed text-orange-900/60 dark:text-white/50 transition-colors duration-700">
            Każde domostwo może mieć własny adres do przesyłania dalej rachunków i faktur z maila.
          </p>
        </div>

        {inbox && (
          <button
            type="button"
            onClick={onOpenInbox}
            className="rounded-full bg-orange-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-bold text-orange-700 dark:text-indigo-300 transition-colors duration-700 hover:bg-orange-200 dark:hover:bg-white/20"
          >
            {setup?.pendingCount ?? 0} do sprawdzenia
          </button>
        )}
      </div>

      {!setup ? (
        <Spinner className="py-8" />
      ) : !setup.isResendConfigured ? (
        <div className="mt-4 rounded-2xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 transition-colors duration-700">
          <p className="text-sm font-bold text-red-800 dark:text-red-400 transition-colors duration-700">Skrzynka jeszcze nie jest aktywna</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-red-700 dark:text-red-300 transition-colors duration-700">
            Backend nie ma jeszcze ustawionej domeny odbiorczej dla maili. Gdy konfiguracja będzie gotowa, pojawi się
            tu adres dla tego domostwa.
          </p>
        </div>
      ) : !inbox ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-[16px] border border-white/60 dark:border-white/10 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-neutral-900 dark:to-neutral-800 p-4 transition-colors duration-700">
            <p className="text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700">Jeden adres dla całego domostwa</p>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-orange-900/60 dark:text-white/50 transition-colors duration-700">
              Wystarczy zrobić forward maila z rachunkiem, a aplikacja przygotuje wydatki do zatwierdzenia.
            </p>
          </div>

          <ButtonPrimary
            onClick={handleCreate}
            disabled={busy !== null}
            loading={busy === "create"}
          >
            {busy === "create" ? "Tworzenie adresu..." : "Utwórz adres dla tego domostwa"}
          </ButtonPrimary>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-[16px] border border-orange-200 dark:border-white/10 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-neutral-900 dark:to-neutral-800 p-4 transition-colors duration-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">Adres do forwardowania</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                  Forwarduj tu rachunki i faktury z maila. Gotowe pozycje pojawią się później w kolejce.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyText(inbox.address, "Skopiowano adres skrzynki.")}
                className="rounded-xl border border-orange-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3 text-orange-600 dark:text-indigo-400 transition-colors duration-700 hover:bg-orange-50 dark:hover:bg-white/10"
                aria-label="Kopiuj adres"
              >
                <Clipboard className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-[16px] border border-orange-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 transition-colors duration-700">
              <p className="break-all font-mono text-[13px] font-bold text-orange-900 dark:text-white/80 transition-colors duration-700">{inbox.address}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonSecondary
                onClick={handleRotate}
                disabled={busy !== null}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                className="text-[11px]"
              >
                Zmień adres
              </ButtonSecondary>
              <button
                type="button"
                onClick={onOpenInbox}
                className="inline-flex items-center gap-2 rounded-full bg-orange-100 dark:bg-white/10 px-3 py-2 text-[11px] font-bold text-orange-700 dark:text-indigo-300 transition-colors duration-700 hover:bg-orange-200 dark:hover:bg-white/20"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Otwórz kolejkę maili
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[16px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 transition-colors duration-700">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-900/40 dark:text-white/40 transition-colors duration-700">Co wysyłać</p>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-orange-900 dark:text-white/80 transition-colors duration-700">
                Najlepiej PDF-y z fakturami, potwierdzenia zakupów i zdjęcia rachunków jako załączniki.
              </p>
            </div>

            <div className="rounded-[16px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 transition-colors duration-700">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-900/40 dark:text-white/40 transition-colors duration-700">Co dalej</p>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-orange-900 dark:text-white/80 transition-colors duration-700">
                Aplikacja wyciągnie pozycje i pokaże je w kolejce, gdzie można je poprawić i zapisać.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppCard>
  );
}

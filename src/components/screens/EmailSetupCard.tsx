import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface Props {
  householdId: Id<"households">;
  deploymentUrl: string;
}

export function EmailSetupCard({ householdId, deploymentUrl }: Props) {
  const token = useQuery(api.emailTokens.get, { householdId });
  const getOrCreate = useMutation(api.emailTokens.getOrCreate);
  const regenerate = useMutation(api.emailTokens.regenerate);
  const [creating, setCreating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const webhookUrl = token
    ? `${deploymentUrl}/api/email-ingest?token=${token}`
    : null;

  async function handleCreate() {
    setCreating(true);
    try {
      await getOrCreate({ householdId });
      toast.success("Adres email gotowy!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("Wygenerować nowy token? Stary adres przestanie działać.")) return;
    try {
      await regenerate({ householdId });
      toast.success("Nowy token wygenerowany.");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function copyWebhook() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => toast.success("Skopiowano URL!"));
  }

  // Generate Zapier quick setup URL
  const zapierUrl = webhookUrl 
    ? `https://zapier.com/webintent/create-zap?template=email-to-webhook&webhook_url=${encodeURIComponent(webhookUrl)}`
    : null;

  return (
    <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <span className="text-[22px]">📧</span>
          <h3 className="text-[15px] font-extrabold text-[#2b180a]">Automatyzacja emaili (zaawansowane)</h3>
        </div>
      </div>

      <p className="text-xs text-[#8a7262] font-semibold leading-relaxed">
        Funkcja automatycznego przetwarzania emaili wymaga zaawansowanej konfiguracji technicznej. Zamiast tego, użyj prostszych metod dodawania wydatków:
      </p>

      <div className="space-y-2 mt-4">
        <div className="bg-gradient-to-r from-[#10b981] to-[#059669] text-white rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">📷</span>
          <div className="flex-1">
            <p className="text-xs font-bold">Zrób zdjęcie paragonu</p>
            <p className="text-[10px] opacity-90">AI automatycznie odczyta produkty i ceny</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1">
            <p className="text-xs font-bold">Prześlij PDF faktury</p>
            <p className="text-[10px] opacity-90">Obsługujemy faktury elektroniczne</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white rounded-xl p-3 flex items-center gap-3">
          <span className="text-2xl">✍️</span>
          <div className="flex-1">
            <p className="text-xs font-bold">Wpisz ręcznie</p>
            <p className="text-[10px] opacity-90">Szybkie dodawanie pojedynczych wydatków</p>
          </div>
        </div>
      </div>

      {token === undefined ? (
        <div className="flex justify-center py-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#d87635]" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Technical Info - Collapsed by default */}
          <details className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm">
            <summary className="text-[11px] font-extrabold text-[#6d4d38] cursor-pointer hover:text-[#2b180a]">
              🔧 Dla programistów: Webhook URL (wymaga konfiguracji zewnętrznej)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                  URL webhooka
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-3 py-2.5 overflow-hidden shadow-inner hidden scrollbar-hide">
                    <p className="text-[10px] font-mono text-[#6d4d38] truncate">{webhookUrl}</p>
                  </div>
                  <button
                    onClick={copyWebhook}
                    className="px-3 py-2 bg-white/70 backdrop-blur-sm rounded-xl text-sm font-bold text-[#cf833f] border border-white/60 hover:bg-white transition-all shadow-sm"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="bg-[#fff3cd] border border-[#ffc107] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#856404] mb-1">
                  ⚠️ Wymaga zaawansowanej konfiguracji
                </p>
                <p className="text-[10px] text-[#856404] font-semibold">
                  Musisz skonfigurować usługę email-to-webhook (Mailgun, SendGrid, własny serwer). To rozwiązanie dla programistów i firm, nie dla zwykłych użytkowników.
                </p>
              </div>
            </div>
          </details>

          {/* Recommendation */}
          <div className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white rounded-2xl p-4">
            <p className="text-xs font-extrabold mb-2">💡 Nasza rekomendacja</p>
            <p className="text-[11px] font-semibold opacity-90">
              Zamiast konfigurować emaile, po prostu rób zdjęcia paragonów aparatem w aplikacji. To szybsze, prostsze i działa od razu!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

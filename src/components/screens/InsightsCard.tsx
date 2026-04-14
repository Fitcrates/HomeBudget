import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Bot, Sparkles, Search } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import catLottie from "../../assets/Cat playing animation.lottie?url";

interface Props {
  householdId: Id<"households">;
}

const SEVERITY_STYLES = {
  info: {
    bg: "bg-[#f0f7ff]",
    border: "border-[#bdd9f5]",
    dot: "bg-blue-400",
    badge: "bg-blue-100 text-blue-700",
  },
  warning: {
    bg: "bg-[#fffbeb]",
    border: "border-[#fde68a]",
    dot: "bg-yellow-400",
    badge: "bg-yellow-100 text-yellow-700",
  },
  danger: {
    bg: "bg-[#fff5f5]",
    border: "border-[#fecaca]",
    dot: "bg-red-400",
    badge: "bg-red-100 text-red-700",
  },
};

const TYPE_LABELS: Record<string, string> = {
  prediction: "Prognoza",
  anomaly: "Anomalia",
  saving: "Oszczędności",
  budget_alert: "Budżet",
};

export function InsightsCard({ householdId }: Props) {
  const latest = useQuery(api.insights.getLatest, { householdId });
  const generate = useAction(api.insights.generate);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const startTime = Date.now();
    try {
      await generate({ householdId });
      toast.success("Analiza AI gotowa!");
    } catch (err: any) {
      toast.error(err.message || "Błąd generowania analizy.");
    } finally {
      const elapsed = Date.now() - startTime;
      const minLoadingTime = 2000;
      if (elapsed < minLoadingTime) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsed));
      }
      setLoading(false);
    }
  }

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  const isStale =
    !latest || Date.now() - latest.generatedAt > 24 * 60 * 60 * 1000;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <Bot className="w-6 h-6 text-[#c76823]" />
          <h3 className="text-[15px] font-medium text-[#2b180a]">Analiza AI</h3>
          {latest && (
            <span className="text-[10px] font-bold text-[#b89b87] bg-[#f5e5cf]/60 px-2 py-0.5 rounded-full">
              {new Date(latest.generatedAt).toLocaleDateString("pl-PL")}
            </span>
          )}
        </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              loading
                ? "bg-[#f5e5cf] text-[#b89b87]"
                : isStale
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm hover:scale-[1.02]"
                : "bg-[#f5e5cf] text-[#8a7262] hover:bg-[#eedcc8]"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-b border-[#b89b87]" />
                Analizuję...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>{isStale ? "Analizuj" : "Odśwież"}</span>
              </>
            )}
          </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-6 gap-4">
          <div className="w-28 h-28 relative flex items-center justify-center bg-[#fff8f2] rounded-full shadow-inner border border-[#f2d6bf]">
            <div className="absolute inset-0 border-[4px] border-t-transparent border-[#de9241] rounded-full animate-spin" />
            <div className="absolute inset-2 border-[4px] border-b-transparent border-[#ca782a] rounded-full animate-spin direction-reverse" />
            <div className="w-20 h-20 rounded-full overflow-hidden absolute">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="text-[#8a7262] font-bold text-sm animate-pulse">
            AI analizuje Twoje wydatki...
          </p>
        </div>
      )}

      {!loading && latest === undefined ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="w-24 h-24 relative flex items-center justify-center bg-[#fff8f2] rounded-full shadow-inner border border-[#f2d6bf]">
            <div className="absolute inset-0 border-[3px] border-t-transparent border-[#de9241] rounded-full animate-spin" />
            <div className="absolute inset-1.5 border-[3px] border-b-transparent border-[#ca782a] rounded-full animate-spin direction-reverse" />
            <div className="w-18 h-18 rounded-full overflow-hidden absolute">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="text-[#8a7262] font-bold text-xs animate-pulse">
            Ładowanie analizy...
          </p>
        </div>
      ) : !loading && latest === null ? (
        <div className="text-center py-6">
          <Search className="w-12 h-12 text-[#b89b87] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#8a7262] mb-1">Brak analizy</p>
          <p className="text-xs text-[#b89b87]">
            Kliknij „Analizuj", aby AI przeanalizowało Twoje wydatki
          </p>
        </div>
      ) : !loading && latest ? (
        <div className="space-y-3">
          {latest.insights.map((insight, i) => {
            const styles =
              SEVERITY_STYLES[insight.severity as keyof typeof SEVERITY_STYLES] ??
              SEVERITY_STYLES.info;
            return (
                <div
                  key={i}
                  className={`flex gap-3 p-3.5 rounded-xl border ${styles.bg} ${styles.border} shadow-sm backdrop-blur-sm bg-opacity-80`}
                >
                  <span className="text-[22px] shrink-0 mt-0.5 drop-shadow-sm">{insight.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-medium text-[#2b180a]">{insight.title}</p>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${styles.badge}`}
                    >
                      {TYPE_LABELS[insight.type] ?? insight.type}
                    </span>
                  </div>
                  <p className="text-xs text-[#6d4d38] font-medium leading-snug">
                    {insight.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

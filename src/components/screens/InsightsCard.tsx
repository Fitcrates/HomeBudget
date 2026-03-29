import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

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
    try {
      await generate({ householdId });
      toast.success("Analiza AI gotowa!");
    } catch (err: any) {
      toast.error(err.message || "Błąd generowania analizy.");
    } finally {
      setLoading(false);
    }
  }

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  const isStale =
    !latest || Date.now() - latest.generatedAt > 24 * 60 * 60 * 1000;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <span className="text-[22px]">🤖</span>
          <h3 className="text-[15px] font-extrabold text-[#2b180a]">Analiza AI</h3>
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
            <>✨ {isStale ? "Analizuj" : "Odśwież"}</>
          )}
        </button>
      </div>

      {latest === undefined ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#d87635]" />
        </div>
      ) : latest === null ? (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm font-bold text-[#8a7262] mb-1">Brak analizy</p>
          <p className="text-xs text-[#b89b87]">
            Kliknij „Analizuj", aby AI przeanalizowało Twoje wydatki
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {latest.insights.map((insight, i) => {
            const styles =
              SEVERITY_STYLES[insight.severity as keyof typeof SEVERITY_STYLES] ??
              SEVERITY_STYLES.info;
            return (
                <div
                  key={i}
                  className={`flex gap-3 p-3.5 rounded-2xl border ${styles.bg} ${styles.border} shadow-sm backdrop-blur-sm bg-opacity-80`}
                >
                  <span className="text-[22px] shrink-0 mt-0.5 drop-shadow-sm">{insight.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-extrabold text-[#2b180a]">{insight.title}</p>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${styles.badge}`}
                    >
                      {TYPE_LABELS[insight.type] ?? insight.type}
                    </span>
                  </div>
                  <p className="text-xs text-[#6d4d38] font-semibold leading-snug">
                    {insight.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

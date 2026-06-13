import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import catLottie from "../../assets/Cat playing animation.lottie?url";
import { formatAmount } from "../../lib/format";
import { DynamicIcon } from "../ui/DynamicIcon";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

type Severity = "info" | "warning" | "danger";

type InsightRow = {
  type: string;
  title: string;
  body: string;
  emoji: string;
  severity: Severity;
};

type LatestInsights = {
  generatedAt: number;
  insights: InsightRow[];
} | null;

type WhatIfOverview = {
  currentMonthSpent: number;
  projectedMonthSpent: number;
  previousMonthSpent: number;
  subscriptionProjectedMonthly: number;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    icon: string;
    color: string;
    currentMonthSpent: number;
    projectedMonthSpent: number;
    isSubscriptionCategory: boolean;
  }>;
  suggestedScenarios: Array<{
    id: string;
    label: string;
    type: "reduce_category";
    categoryId: string;
    categoryName: string;
    reductionPct: number;
    monthlyImpact: number;
    projectedMonthSpent: number;
  }>;
};

const INSIGHT_CARD_STYLES = {
  info: {
    shell: "border-orange-200/90 dark:border-white/10 bg-white/45 dark:bg-white/5 transition-colors duration-700",
    iconWrap: "border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 transition-colors duration-700",
    icon: "text-orange-600 dark:text-indigo-400 transition-colors duration-700",
    panel: "border-orange-200 dark:border-white/10 bg-orange-50/80 dark:bg-white/5 transition-colors duration-700",
    badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 transition-colors duration-700",
  },
  warning: {
    shell: "border-amber-300/90 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 transition-colors duration-700",
    iconWrap: "border-amber-300 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/20 transition-colors duration-700",
    icon: "text-amber-600 dark:text-amber-400 transition-colors duration-700",
    panel: "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 transition-colors duration-700",
    badge: "bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 transition-colors duration-700",
  },
  danger: {
    shell: "border-red-300/90 dark:border-red-500/30 bg-red-50/75 dark:bg-red-500/10 transition-colors duration-700",
    iconWrap: "border-red-300 dark:border-red-500/30 bg-red-100 dark:bg-red-500/20 transition-colors duration-700",
    icon: "text-red-600 dark:text-red-400 transition-colors duration-700",
    panel: "border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 transition-colors duration-700",
    badge: "bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-300 transition-colors duration-700",
  },
} satisfies Record<
  Severity,
  { shell: string; iconWrap: string; icon: string; panel: string; badge: string }
>;

const TYPE_LABELS: Record<string, string> = {
  prediction: "Prognoza",
  anomaly: "Anomalia",
  saving: "Oszczędności",
  budget_alert: "Budżet",
  what_if: "Co jeśli",
};

function getTypeLabel(type: string) {
  if (type === "prediction") return "Prognoza";
  if (type === "anomaly") return "Anomalia";
  if (type === "saving") return "Oszczędności";
  if (type === "budget_alert") return "Budżet";
  if (type === "what_if") return "Co jeśli";
  return TYPE_LABELS[type] ?? type;
}

export function InsightsCard({ householdId, currency }: Props) {
  const latest = useQuery(api.insights.getLatest, { householdId }) as LatestInsights | undefined;
  const whatIf = useQuery(api.insights.getWhatIfOverview, { householdId }) as WhatIfOverview | undefined;
  const generate = useAction(api.insights.generate);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [reductionPct, setReductionPct] = useState(20);
  const [extraSubscriptionAmount, setExtraSubscriptionAmount] = useState("");

  useEffect(() => {
    if (!selectedCategoryId && whatIf?.categories?.length) {
      setSelectedCategoryId(whatIf.categories[0].categoryId);
    }
  }, [whatIf, selectedCategoryId]);

  async function handleGenerate() {
    setLoading(true);
    const startTime = Date.now();
    try {
      await generate({ householdId });
      toast.success("Analiza gotowa!");
    } catch (err: any) {
      toast.error(err.message || "Nie udało się wygenerować analizy.");
    } finally {
      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1800;
      if (elapsed < minLoadingTime) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsed));
      }
      setLoading(false);
    }
  }

  const selectedCategory = useMemo(
    () => whatIf?.categories.find((category) => category.categoryId === selectedCategoryId) ?? null,
    [selectedCategoryId, whatIf]
  );

  const scenarioPreview = useMemo(() => {
    if (!whatIf) return null;
    const extraMonthlyCost = Math.max(
      0,
      Math.round(Number.parseFloat(extraSubscriptionAmount.replace(",", ".")) * 100) || 0
    );
    const categorySavings = selectedCategory
      ? Math.round(selectedCategory.projectedMonthSpent * (reductionPct / 100))
      : 0;
    const baselineProjection = whatIf.projectedMonthSpent;
    const nextProjection = Math.max(0, baselineProjection - categorySavings + extraMonthlyCost);

    return {
      extraMonthlyCost,
      categorySavings,
      baselineProjection,
      nextProjection,
      delta: nextProjection - baselineProjection,
    };
  }, [extraSubscriptionAmount, reductionPct, selectedCategory, whatIf]);

  const cardClass =
    "rounded-[16px] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/5 pt-6 pb-6 p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)] dark:shadow-none backdrop-blur-xl transition-colors duration-700";

  const isStale = !latest || Date.now() - latest.generatedAt > 24 * 60 * 60 * 1000;

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <Bot className="h-6 w-6 text-orange-600 dark:text-indigo-400 transition-colors duration-700" />
          <h3 className="text-[15px] font-medium text-orange-950 dark:text-white transition-colors duration-700">Analiza i scenariusze</h3>
          {latest && (
            <span className="rounded-full bg-orange-100/60 dark:bg-white/10 px-2 py-0.5 text-[10px] font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">
              {new Date(latest.generatedAt).toLocaleDateString("pl-PL")}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-700 ${
            loading
              ? "bg-orange-100 dark:bg-white/10 text-orange-900/40 dark:text-white/40"
              : isStale
                ? "bg-gradient-to-r from-orange-400 to-orange-600 dark:from-indigo-500 dark:to-violet-600 text-white shadow-sm hover:scale-[1.02]"
                : "bg-orange-100 dark:bg-white/10 text-orange-900/60 dark:text-white/50 hover:bg-orange-200 dark:hover:bg-white/20"
          }`}
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-b border-orange-900/40 dark:border-white/40" />
              Analizuję...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              <span>{isStale ? "Analizuj" : "Odśwież"}</span>
            </>
          )}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-6">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 shadow-inner transition-colors duration-700">
            <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-orange-500 dark:border-indigo-500 border-t-transparent" />
            <div className="direction-reverse absolute inset-2 animate-spin rounded-full border-[4px] border-orange-600 dark:border-violet-600 border-b-transparent" />
            <div className="absolute h-20 w-20 overflow-hidden rounded-full">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="text-sm font-bold text-orange-900/60 dark:text-white/50 animate-pulse transition-colors duration-700">Analiza przelicza Twoje dane...</p>
        </div>
      )}

      {!loading && latest === undefined ? (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 shadow-inner transition-colors duration-700">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-orange-500 dark:border-indigo-500 border-t-transparent" />
            <div className="direction-reverse absolute inset-1.5 animate-spin rounded-full border-[3px] border-orange-600 dark:border-violet-600 border-b-transparent" />
            <div className="absolute h-18 w-18 overflow-hidden rounded-full">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="text-xs font-bold text-orange-900/60 dark:text-white/50 animate-pulse transition-colors duration-700">Ładowanie analizy...</p>
        </div>
      ) : !loading && latest === null ? (
        <div className="py-6 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-orange-900/40 dark:text-white/40 transition-colors duration-700" />
          <p className="mb-1 text-sm font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">Brak analizy</p>
          <p className="text-xs text-orange-900/40 dark:text-white/40 transition-colors duration-700">Kliknij „Analizuj”, aby wygenerować pierwsze wnioski.</p>
        </div>
      ) : !loading && latest ? (
        <div className="space-y-3">
          {latest.insights.map((insight, index) => {
            const styles = INSIGHT_CARD_STYLES[insight.severity] ?? INSIGHT_CARD_STYLES.info;
            return (
              <div
                key={`${insight.type}-${index}`}
                className={`overflow-hidden rounded-xl border p-3.5 shadow-[0_4px_24px_rgba(180,120,80,0.1)] backdrop-blur-xl ${styles.shell}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-inner ${styles.iconWrap}`}>
                    <DynamicIcon name={insight.emoji} className={`h-5 w-5 ${styles.icon}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-orange-950 dark:text-white transition-colors duration-700">{insight.title}</p>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles.badge}`}
                    >
                      {getTypeLabel(insight.type)}
                    </span>
                    </div>
                    <span
                      className={`mt-3 block rounded-xl border px-3 py-2.5 text-xs font-medium leading-snug text-orange-900 dark:text-white/80 ${styles.panel}`}
                    >
                      {insight.body}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {whatIf && (
        <div className="mt-5  ">
          <div className="mb-3 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-orange-600 dark:text-indigo-400 transition-colors duration-700" />
            <h4 className="text-sm font-semibold text-orange-950 dark:text-white transition-colors duration-700">Symulacje oszczędności</h4>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 transition-colors duration-700">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">Prognoza miesiąca</p>
              <p className="text-right text-sm font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                {formatAmount(whatIf.projectedMonthSpent, currency)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-orange-200 dark:border-white/10 px-3 py-2.5 transition-colors duration-700">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">Ten miesiąc do dziś</p>
              <p className="text-right text-sm font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                {formatAmount(whatIf.currentMonthSpent, currency)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-orange-200 dark:border-white/10 px-3 py-2.5 transition-colors duration-700">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">Subskrypcje</p>
              <p className="text-right text-sm font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                {formatAmount(whatIf.subscriptionProjectedMonthly, currency)}
              </p>
            </div>
          </div>

          {whatIf.suggestedScenarios.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {whatIf.suggestedScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(scenario.categoryId);
                    setReductionPct(scenario.reductionPct);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors duration-700 ${
                    selectedCategoryId === scenario.categoryId && reductionPct === scenario.reductionPct
                      ? "border-orange-500 dark:border-indigo-400 bg-orange-100 dark:bg-indigo-500/20 text-orange-700 dark:text-indigo-300"
                      : "border-orange-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-orange-900/60 dark:text-white/50 hover:bg-white dark:hover:bg-white/10"
                  }`}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          )}

          {whatIf.categories.length > 0 && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                  Kategoria do symulacji
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {whatIf.categories.map((category) => (
                    <button
                      key={category.categoryId}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.categoryId)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors duration-700 ${
                        selectedCategoryId === category.categoryId
                          ? "border-orange-500 dark:border-indigo-400 bg-orange-100 dark:bg-indigo-500/20 text-orange-700 dark:text-indigo-300"
                          : "border-orange-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-orange-900/60 dark:text-white/50 hover:bg-white dark:hover:bg-white/10"
                      }`}
                    >
                      {category.categoryName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[16px] border border-orange-200 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4 transition-colors duration-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-orange-950 dark:text-white transition-colors duration-700">
                      {selectedCategory ? selectedCategory.categoryName : "Wybierz kategorię"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                      Obecna projekcja tej kategorii:{" "}
                      {formatAmount(selectedCategory?.projectedMonthSpent ?? 0, currency)}
                    </p>
                  </div>
                  <div className="rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1.5 text-xs font-bold tabular-nums text-orange-700 dark:text-orange-300 transition-colors duration-700">
                    -{reductionPct}%
                  </div>
                </div>

                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={reductionPct}
                  onChange={(event) => setReductionPct(Number(event.target.value))}
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-orange-200 dark:bg-white/10 accent-orange-500 dark:accent-indigo-400 transition-colors duration-700"
                />

                <div className="mt-4">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                    Dodaj nową subskrypcję ({currency} / miesiąc)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraSubscriptionAmount}
                    onChange={(event) => setExtraSubscriptionAmount(event.target.value)}
                    placeholder="np. 29.99"
                    className="mt-2 w-full rounded-[16px] border border-orange-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm font-bold text-orange-950 dark:text-white outline-none focus:border-orange-500 dark:focus:border-indigo-400 transition-colors duration-700"
                  />
                </div>
              </div>
            </div>
          )}

          {scenarioPreview && (
            <div className="mt-4  p-1.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                    Wynik scenariusza
                  </p>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                    {formatAmount(scenarioPreview.nextProjection, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                    względem bazowej prognozy {formatAmount(scenarioPreview.baselineProjection, currency)}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold tabular-nums transition-colors duration-700 ${
                    scenarioPreview.delta <= 0
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                  }`}
                >
                  {scenarioPreview.delta <= 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {scenarioPreview.delta <= 0 ? "-" : "+"}
                  {formatAmount(Math.abs(scenarioPreview.delta), currency)}
                </div>
              </div>

         <div className="mt-4 overflow-hidden rounded-[16px] border border-orange-200 dark:border-white/10 bg-white/75 dark:bg-white/5 transition-colors duration-700"> 
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                    Cięcie kategorii
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                    {formatAmount(scenarioPreview.categorySavings, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-orange-900/60 dark:text-white/50 transition-colors duration-700">potencjalnie mniej w miesiącu</p>
                </div>
                <div className="border-t border-orange-200 dark:border-white/10 px-3 py-2.5 transition-colors duration-700">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                    Nowa subskrypcja
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-orange-950 dark:text-white transition-colors duration-700">
                    {formatAmount(scenarioPreview.extraMonthlyCost, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-orange-900/60 dark:text-white/50 transition-colors duration-700">dodatkowy koszt miesięczny</p>
                </div>
              </div> 
            </div> 
          )}
        </div>
      )}
    </div>
  );
}

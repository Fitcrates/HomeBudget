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
    shell: "border-[#f2dfcb]/90 bg-white/45",
    iconWrap: "border-[#f2dfcb] bg-[#fff8f2]",
    icon: "text-[#cf833f]",
    panel: "border-[#f2dfcb] bg-[#fff8f2]/80",
    badge: "bg-[#fff1e1] text-[#b55b1d]",
  },
  warning: {
    shell: "border-[#f3d2a4]/90 bg-[#fff8ee]/70",
    iconWrap: "border-[#f3d2a4] bg-[#fff1dd]",
    icon: "text-[#ca782a]",
    panel: "border-[#f3d2a4] bg-[#fff5e8]",
    badge: "bg-[#ffe7c7] text-[#b55b1d]",
  },
  danger: {
    shell: "border-[#f1c6c0]/90 bg-[#fff7f5]/75",
    iconWrap: "border-[#f1c6c0] bg-[#fff1ee]",
    icon: "text-[#d1632a]",
    panel: "border-[#f1c6c0] bg-[#fff4f1]",
    badge: "bg-[#ffe3dc] text-[#c55353]",
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

const shellClass =
  "rounded-xl border border-white/50 bg-white/40 p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)] backdrop-blur-xl";

export function InsightsOverviewCard({ householdId }: Pick<Props, "householdId">) {
  const latest = useQuery(api.insights.getLatest, { householdId }) as LatestInsights | undefined;
  const generate = useAction(api.insights.generate);
  const [loading, setLoading] = useState(false);
  const isStale = !latest || Date.now() - latest.generatedAt > 24 * 60 * 60 * 1000;

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

  return (
    <div className={shellClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <Bot className="h-6 w-6 text-[#c76823]" />
          <h3 className="text-[15px] font-medium text-[#2b180a]">Analiza wydatków</h3>
          {latest && (
            <span className="rounded-full bg-[#f5e5cf]/60 px-2 py-0.5 text-[10px] font-bold text-[#b89b87]">
              {new Date(latest.generatedAt).toLocaleDateString("pl-PL")}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
            loading
              ? "bg-[#f5e5cf] text-[#b89b87]"
              : isStale
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm hover:scale-[1.02]"
                : "bg-[#f5e5cf] text-[#8a7262] hover:bg-[#eedcc8]"
          }`}
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-b border-[#b89b87]" />
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
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[#f2d6bf] bg-[#fff8f2] shadow-inner">
            <div className="absolute inset-0 animate-spin rounded-full border-[4px] border-[#de9241] border-t-transparent" />
            <div className="direction-reverse absolute inset-2 animate-spin rounded-full border-[4px] border-[#ca782a] border-b-transparent" />
            <div className="absolute h-20 w-20 overflow-hidden rounded-full">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="animate-pulse text-sm font-bold text-[#8a7262]">Analiza przelicza Twoje dane...</p>
        </div>
      )}

      {!loading && latest === undefined && (
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#f2d6bf] bg-[#fff8f2] shadow-inner">
            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#de9241] border-t-transparent" />
            <div className="direction-reverse absolute inset-1.5 animate-spin rounded-full border-[3px] border-[#ca782a] border-b-transparent" />
            <div className="absolute h-18 w-18 overflow-hidden rounded-full">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="animate-pulse text-xs font-bold text-[#8a7262]">Ładowanie analizy...</p>
        </div>
      )}

      {!loading && latest === null && (
        <div className="py-6 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-[#b89b87]" />
          <p className="mb-1 text-sm font-bold text-[#8a7262]">Brak analizy</p>
          <p className="text-xs text-[#b89b87]">Kliknij „Analizuj”, aby wygenerować pierwsze wnioski.</p>
        </div>
      )}

      {!loading && latest && (
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
                      <p className="text-sm font-medium text-[#2b180a]">{insight.title}</p>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${styles.badge}`}
                      >
                        {getTypeLabel(insight.type)}
                      </span>
                    </div>
                    <span
                      className={`mt-3 block rounded-xl border px-3 py-2.5 text-xs font-medium leading-snug text-[#6d4d38] ${styles.panel}`}
                    >
                      {insight.body}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InsightsScenariosCard({ householdId, currency }: Props) {
  const whatIf = useQuery(api.insights.getWhatIfOverview, { householdId }) as WhatIfOverview | undefined;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [reductionPct, setReductionPct] = useState(20);
  const [extraSubscriptionAmount, setExtraSubscriptionAmount] = useState("");

  useEffect(() => {
    if (!selectedCategoryId && whatIf?.categories?.length) {
      setSelectedCategoryId(whatIf.categories[0].categoryId);
    }
  }, [whatIf, selectedCategoryId]);

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

  return (
    <div className={shellClass}>
      <div className="mb-4 flex items-center gap-2 drop-shadow-sm">
        <WandSparkles className="h-6 w-6 text-[#c76823]" />
        <h3 className="text-[15px] font-medium text-[#2b180a]">Symulacje budżetu</h3>
      </div>

      {whatIf === undefined ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#d87635]" />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#f2dfcb] bg-[#fff8f2]">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">Prognoza miesiąca</p>
              <p className="text-right text-sm font-semibold tabular-nums text-[#2b180a]">
                {formatAmount(whatIf.projectedMonthSpent, currency)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#f2dfcb] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">Ten miesiąc do dziś</p>
              <p className="text-right text-sm font-semibold tabular-nums text-[#2b180a]">
                {formatAmount(whatIf.currentMonthSpent, currency)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[#f2dfcb] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">Subskrypcje</p>
              <p className="text-right text-sm font-semibold tabular-nums text-[#2b180a]">
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
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    selectedCategoryId === scenario.categoryId && reductionPct === scenario.reductionPct
                      ? "border-[#cf833f] bg-[#fff1e1] text-[#b55b1d]"
                      : "border-[#f2dfcb] bg-white/80 text-[#8a7262] hover:bg-white"
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
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
                  Kategoria do symulacji
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {whatIf.categories.map((category) => (
                    <button
                      key={category.categoryId}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.categoryId)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        selectedCategoryId === category.categoryId
                          ? "border-[#cf833f] bg-[#fff1e1] text-[#b55b1d]"
                          : "border-[#f2dfcb] bg-white/80 text-[#8a7262] hover:bg-white"
                      }`}
                    >
                      {category.categoryName}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#f2dfcb] bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#2b180a]">
                      {selectedCategory ? selectedCategory.categoryName : "Wybierz kategorię"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#8a7262]">
                      Obecna projekcja tej kategorii:{" "}
                      {formatAmount(selectedCategory?.projectedMonthSpent ?? 0, currency)}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#fff1e1] px-3 py-1.5 text-xs font-bold tabular-nums text-[#b55b1d]">
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
                  className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#f2dfcb]"
                />

                <div className="mt-4">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
                    Dodaj nową subskrypcję ({currency} / miesiąc)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraSubscriptionAmount}
                    onChange={(event) => setExtraSubscriptionAmount(event.target.value)}
                    placeholder="np. 29.99"
                    className="mt-2 w-full rounded-xl border border-[#f2dfcb] bg-white px-3 py-2 text-sm font-bold text-[#2b180a] outline-none focus:border-[#cf833f]"
                  />
                </div>
              </div>
            </div>
          )}

          {scenarioPreview && (
            <div className="mt-4 p-1.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
                    Wynik scenariusza
                  </p>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-[#2b180a]">
                    {formatAmount(scenarioPreview.nextProjection, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#8a7262]">
                    względem bazowej prognozy {formatAmount(scenarioPreview.baselineProjection, currency)}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold tabular-nums ${
                    scenarioPreview.delta <= 0
                      ? "bg-[#ecfdf3] text-[#2d8d56]"
                      : "bg-[#fff1f1] text-[#c55353]"
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

              <div className="mt-4 overflow-hidden rounded-xl border border-[#f2dfcb] bg-white/75">
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
                    Cięcie kategorii
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[#2b180a]">
                    {formatAmount(scenarioPreview.categorySavings, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#8a7262]">potencjalnie mniej w miesiącu</p>
                </div>
                <div className="border-t border-[#f2dfcb] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b89b87]">
                    Nowa subskrypcja
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[#2b180a]">
                    {formatAmount(scenarioPreview.extraMonthlyCost, currency)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#8a7262]">dodatkowy koszt miesięczny</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

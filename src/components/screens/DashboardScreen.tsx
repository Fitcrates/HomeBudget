import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { PieChart } from "../charts/PieChart";
import { BarChart } from "../charts/BarChart";
import { formatAmount } from "../../lib/format";
import { InsightsCard } from "./InsightsCard";
import { BudgetAlertsCard } from "./BudgetAlertsCard";
import { BudgetSettingsScreen } from "./BudgetSettingsScreen";
import { IncomeMonitorCard } from "./IncomeMonitorCard";
import { HomeIcon } from "../ui/icons/HomeIcon";
import { ExpensesIcon } from "../ui/icons/ExpensesIcon";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import catLottie from "../../assets/Cat playing animation.lottie?url";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

export function DashboardScreen({ householdId, currency }: Props) {
  const [period, setPeriod] = useState<string>("month");
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  const { from, to } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  // Always compute current month range for income monitor
  const now = new Date();
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthTo = now.getTime();

  const summary = useQuery(api.analytics.summary, { householdId, dateFrom: from, dateTo: to });
  const monthlySummary = useQuery(api.analytics.summary, {
    householdId,
    dateFrom: monthFrom,
    dateTo: monthTo,
  });
  const byCategory = useQuery(api.analytics.totalsPerCategory, { householdId, dateFrom: from, dateTo: to });
  const byPeriod = useQuery(api.analytics.totalsPerPeriod, {
    householdId,
    dateFrom: from,
    dateTo: to,
    granularity: period === "day" ? "day" : period === "week" ? "week" : "month",
  });

  const isLoading = summary === undefined || byCategory === undefined || byPeriod === undefined;

  const cardClass = "bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  if (showBudgetSettings) {
    return (
      <BudgetSettingsScreen
        householdId={householdId}
        currency={currency}
        onBack={() => setShowBudgetSettings(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <HomeIcon className="w-9 h-9 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Cześć, Rodzinko!</h2>
        </div>
        <h3 className="text-[1.2rem] font-bold text-[#3e2815] mb-5 ml-1 drop-shadow-sm">Dashboard</h3>
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-32 h-32 relative flex items-center justify-center bg-[#fff8f2] rounded-full shadow-inner border border-[#f2d6bf]">
            <div className="absolute inset-0 border-[4px] border-t-transparent border-[#de9241] rounded-full animate-spin" />
            <div className="absolute inset-2 border-[4px] border-b-transparent border-[#ca782a] rounded-full animate-spin direction-reverse" />
            <div className="w-24 h-24 rounded-full overflow-hidden absolute">
              <DotLottieReact src={catLottie} loop autoplay />
            </div>
          </div>
          <p className="text-[#8a7262] font-bold text-sm animate-pulse">
            Ładowanie danych...
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary pill */}
          {summary && summary.count > 0 && (
            <div className="flex items-center justify-between bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl px-5 py-4 shadow-[0_8px_24px_rgba(180,120,80,0.1)]">
              <div>
                <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider">Łącznie wydano</p>
                <p className="text-xl font-extrabold text-[#2b180a]">{formatAmount(summary.total, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider">Transakcji</p>
                <p className="text-xl font-extrabold text-[#2b180a]">{summary.count}</p>
              </div>
            </div>
          )}

          {/* Pie Chart Card */}
          {byCategory.length > 0 && (
            <div className={cardClass}>
              <PieChart data={byCategory} currency={currency} />
            </div>
          )}

          {/* Bar Chart Card */}
          {byPeriod.length > 0 && (
            <div className={cardClass}>
              <h3 className="text-sm font-bold text-[#3e2815] mb-4">Wydatki w czasie</h3>
              <BarChart data={byPeriod} currency={currency} />
            </div>
          )}

          {/* Income Monitor — always shows current month */}
          <IncomeMonitorCard
            householdId={householdId}
            currency={currency}
            spentThisMonth={monthlySummary?.total ?? 0}
          />

          {/* Budget Alerts */}
          <BudgetAlertsCard
            householdId={householdId}
            currency={currency}
            dateFrom={from}
            dateTo={to}
            onManageBudgets={() => setShowBudgetSettings(true)}
          />

          {/* AI Insights */}
          <InsightsCard householdId={householdId} />

          {byCategory.length === 0 && (
            <div className={`${cardClass} text-center py-10 opacity-80 backdrop-blur-xl border border-white/50 bg-white/40`}>
              <ExpensesIcon className="w-16 h-16 mx-auto mb-4 text-[#d8c5bc]" />
              <p className="text-[#8a7262] font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">Brak wydatków w tym okresie</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

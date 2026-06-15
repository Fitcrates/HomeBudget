import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { PieChart } from "../charts/PieChart";
import { BarChart } from "../charts/BarChart";
import { formatAmount } from "../../lib/format";
import { InsightsOverviewCard, InsightsScenariosCard } from "./DashboardInsightsPanels";
import { BudgetAlertsCard } from "./BudgetAlertsCardV2";
import { IncomeMonitorCard } from "./IncomeMonitorCard";
import { Receipt, BarChart3, History, WandSparkles } from "lucide-react";
import { AppCard } from "../ui/AppCard";
import { TabBar } from "../ui/TabBar";
import { CatLoader } from "../ui/CatLoader";
import { ExpensesScreen } from "./ExpensesScreen";

interface Props {
  householdId: Id<"households">;
  currency: string;
  initialTab?: DashboardTab;
}

export type DashboardTab = "overview" | "simulations" | "history";

export function DashboardScreen({ householdId, currency, initialTab = "overview" }: Props) {
  const [period, setPeriod] = useState<string>("month");
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  const { from, to } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const now = new Date();
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();

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

  const DASHBOARD_TABS = [
    { key: "overview" as const, label: "Przegląd", icon: BarChart3 },
    { key: "simulations" as const, label: "Symulacje", icon: WandSparkles },
    { key: "history" as const, label: "Historia", icon: History },
  ];

  return (
    <div className="space-y-6">

      <TabBar tabs={DASHBOARD_TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab !== "history" && (
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />
      )}

      {activeTab === "history" ? (
        <ExpensesScreen householdId={householdId} currency={currency} embedded />
      ) : isLoading ? (
        <CatLoader message="Ładowanie danych..." size="lg" />
      ) : (
        activeTab === "overview" ? (
          <div className="space-y-6">
            {(summary?.count > 0 || byCategory.length > 0 || byPeriod.length > 0) && (
              <AppCard>
                {summary && summary.count > 0 && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 uppercase tracking-wider transition-colors duration-700">Łącznie wydano</p>
                      <p className="text-xl font-bold text-orange-950 dark:text-white transition-colors duration-700">{formatAmount(summary.total, currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 uppercase tracking-wider transition-colors duration-700">Transakcji</p>
                      <p className="text-xl font-bold text-orange-950 dark:text-white transition-colors duration-700">{summary.count}</p>
                    </div>
                  </div>
                )}

                {summary?.count > 0 && byCategory.length > 0 && <div className="border-t border-orange-200/50 dark:border-white/10 my-1 transition-colors duration-700" />}

                {byCategory.length > 0 && <PieChart data={byCategory} currency={currency} />}

                {byCategory.length > 0 && byPeriod.length > 0 && <div className="border-t border-orange-200/50 dark:border-white/10 my-1 transition-colors duration-700" />}

                {byPeriod.length > 0 && (
                  <>
                    <h3 className="text-sm font-bold mt-2 text-orange-950 dark:text-white mb-4 transition-colors duration-700">Wydatki w czasie</h3>
                    <BarChart data={byPeriod} currency={currency} />
                  </>
                )}
              </AppCard>
            )}

            <IncomeMonitorCard
              householdId={householdId}
              currency={currency}
              spentThisMonth={monthlySummary?.total ?? 0}
            />

            <BudgetAlertsCard
              householdId={householdId}
              currency={currency}
              dateFrom={from}
              dateTo={to}
            />

            <InsightsOverviewCard householdId={householdId} />

            {byCategory.length === 0 && (
              <AppCard className="text-center py-10 opacity-80">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-orange-300 dark:text-white/20 transition-colors duration-700" strokeWidth={2} />
                <p className="text-orange-900/60 dark:text-white/50 font-bold transition-colors duration-700">Brak wydatków w tym okresie</p>
              </AppCard>
            )}
          </div>
        ) : (
          <InsightsScenariosCard householdId={householdId} currency={currency} />
        )
      )}
    </div>
  );
}

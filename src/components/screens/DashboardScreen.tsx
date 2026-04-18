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
import { HomeIcon } from "../ui/icons/HomeIcon";
import { ExpensesIcon } from "../ui/icons/ExpensesIcon";
import { BarChart3, WandSparkles } from "lucide-react";
import { AppCard } from "../ui/AppCard";
import { TabBar } from "../ui/TabBar";
import { CatLoader } from "../ui/CatLoader";
import { ScreenHeader } from "../ui/ScreenHeader";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

type DashboardTab = "overview" | "simulations";

export function DashboardScreen({ householdId, currency }: Props) {
  const [period, setPeriod] = useState<string>("month");
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

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
  ];

  return (
    <div className="space-y-6">
      <ScreenHeader
        icon={<HomeIcon className="w-9 h-9" />}
        title="Cześć, Rodzinko!"
        subtitle="Dashboard"
      />

      <PeriodSelector
        value={period}
        onChange={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
      />

      <TabBar tabs={DASHBOARD_TABS} value={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <CatLoader message="Ładowanie danych..." size="lg" />
      ) : (
        activeTab === "overview" ? (
          <div className="space-y-6">
            {(summary?.count > 0 || byCategory.length > 0 || byPeriod.length > 0) && (
              <AppCard>
                {summary && summary.count > 0 && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider">Łącznie wydano</p>
                      <p className="text-xl font-medium text-[#2b180a]">{formatAmount(summary.total, currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider">Transakcji</p>
                      <p className="text-xl font-medium text-[#2b180a]">{summary.count}</p>
                    </div>
                  </div>
                )}

                {summary?.count > 0 && byCategory.length > 0 && <div className="border-t border-[#e8d5c4]/60 my-1" />}

                {byCategory.length > 0 && <PieChart data={byCategory} currency={currency} />}

                {byCategory.length > 0 && byPeriod.length > 0 && <div className="border-t border-[#e8d5c4]/60 my-1" />}

                {byPeriod.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium mt-2 text-[#3e2815] mb-4">Wydatki w czasie</h3>
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
                <ExpensesIcon className="w-16 h-16 mx-auto mb-4 text-[#d8c5bc]" />
                <p className="text-[#8a7262] font-bold">Brak wydatków w tym okresie</p>
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

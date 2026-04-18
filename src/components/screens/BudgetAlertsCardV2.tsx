import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { DynamicIcon } from "../ui/DynamicIcon";
import { Target, AlertTriangle, CheckCircle, Users } from "lucide-react";
import { ProgressBar } from "../ui/ProgressBar";

interface Props {
  householdId: Id<"households">;
  currency: string;
  dateFrom: number;
  dateTo: number;
}

export function BudgetAlertsCard({ householdId, currency, dateFrom, dateTo }: Props) {
  const budgets = useQuery(api.budgets.listForHousehold, { householdId });
  const byCategory = useQuery(api.analytics.totalsPerCategory, {
    householdId,
    dateFrom,
    dateTo,
  });
  const memberBudgetOverview = useQuery(api.analytics.memberBudgetOverview, { householdId });

  if (budgets === undefined || byCategory === undefined || memberBudgetOverview === undefined) {
    return null;
  }

  const spendingByCategoryId: Record<string, number> = {};
  for (const category of byCategory) {
    spendingByCategoryId[category.id] = category.total;
  }

  const categoryAlerts = budgets
    .map((budget) => {
      const spent = spendingByCategoryId[budget.categoryId] ?? 0;
      const pct = budget.limitAmount > 0 ? (spent / budget.limitAmount) * 100 : 0;
      const remaining = budget.limitAmount - spent;
      return { ...budget, spent, pct, remaining };
    })
    .sort((a, b) => b.pct - a.pct);

  const personalAlerts = memberBudgetOverview
    .filter((member) => member.personalBudget)
    .sort((a, b) => (b.personalBudgetPct ?? 0) - (a.personalBudgetPct ?? 0));

  if (categoryAlerts.length === 0 && personalAlerts.length === 0) {
    return (
      <div className="app-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 drop-shadow-sm">
            <Target className="w-6 h-6 text-[#c76823]" />
            <h3 className="text-[15px] font-medium text-[#2b180a]">Budżety</h3>
          </div>
        </div>
        <p className="text-xs text-[#b89b87] font-medium text-center py-3">
          Brak ustawionych limitów. Dodaj budżety kategorii lub limity osobiste w sekcji Zarządzanie Domem.
        </p>
      </div>
    );
  }

  return (
    <div className="app-card">
      {categoryAlerts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 drop-shadow-sm">
              <Target className="w-6 h-6 text-[#c76823]" />
              <h3 className="text-[15px] font-medium text-[#2b180a]">Budżety kategorii</h3>
            </div>
          </div>

          {categoryAlerts.map((alert) => {
            const isOver = alert.pct >= 100;
            const isWarning = alert.pct >= 80 && !isOver;
            const statusIcon = isOver ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : isWarning ? (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            );

            return (
              <BudgetRow
                key={alert._id}
                categoryId={alert.categoryId}
                householdId={householdId}
                spent={alert.spent}
                limit={alert.limitAmount}
                pct={Math.min(alert.pct, 100)}
                barColor={isOver ? "bg-red-400" : isWarning ? "bg-yellow-400" : "bg-[#67c48a]"}
                statusEmoji={statusIcon}
                statusText={
                  isOver
                    ? `Przekroczono o ${formatAmount(Math.abs(alert.remaining), currency)}`
                    : `Zostało ${formatAmount(Math.max(alert.remaining, 0), currency)}`
                }
                currency={currency}
              />
            );
          })}
        </div>
      )}

      {personalAlerts.length > 0 && (
        <div className={categoryAlerts.length > 0 ? "mt-6 space-y-4" : "space-y-4"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 drop-shadow-sm">
              <Users className="w-6 h-6 text-[#c76823]" />
              <h3 className="text-[15px] font-medium text-[#2b180a]">Budżety per osoba</h3>
            </div>
          </div>

          {personalAlerts.map((member) => {
            const pct = Math.min(member.personalBudgetPct ?? 0, 100);
            const isOver = member.isOverBudget;
            const isWarning = (member.personalBudgetPct ?? 0) >= 80 && !isOver;

            return (
              <div key={member.userId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#3e2815]">{member.displayName}</span>
                    <span className="text-[10px] font-bold text-[#8a7262]">
                      {member.personalBudget?.period === "month" ? "miesięczny" : "tygodniowy"}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      isOver ? "text-red-500" : isWarning ? "text-yellow-600" : "text-[#46825d]"
                    }`}
                  >
                    {isOver
                      ? `Przekroczono o ${formatAmount(Math.abs(member.personalBudgetRemaining ?? 0), currency)}`
                      : `Zostało ${formatAmount(Math.max(member.personalBudgetRemaining ?? 0, 0), currency)}`}
                  </span>
                </div>

                <ProgressBar value={pct} />


                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-bold text-[#b89b87]">
                    {formatAmount(member.personalBudgetSpent ?? 0, currency)}
                  </span>
                  <span className="text-[10px] font-bold text-[#b89b87]">
                    {formatAmount(member.personalBudget?.limitAmount ?? 0, currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetRow({
  categoryId,
  householdId,
  spent,
  limit,
  pct,
  barColor,
  statusEmoji,
  statusText,
  currency,
}: {
  categoryId: Id<"categories">;
  householdId: Id<"households">;
  spent: number;
  limit: number;
  pct: number;
  barColor: string;
  statusEmoji: React.ReactNode;
  statusText: string;
  currency: string;
}) {
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const category = categories?.find((item) => item._id === categoryId);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <DynamicIcon name={category?.icon ?? "Package"} className="w-[18px] h-[18px] text-[#cf833f]" />
          <span className="text-xs font-bold text-[#3e2815]">{category?.name ?? "..."}</span>
        </div>
        <div className="flex items-center gap-1">
          {statusEmoji}
          <span className="text-[10px] font-bold text-[#8a7262]">{statusText}</span>
        </div>
      </div>
      <div className="h-2 w-full bg-[#f5e5cf] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-bold text-[#b89b87]">{formatAmount(spent, currency)}</span>
        <span className="text-[10px] font-bold text-[#b89b87]">{formatAmount(limit, currency)}</span>
      </div>
    </div>
  );
}

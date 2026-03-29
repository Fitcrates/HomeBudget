import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { DynamicIcon } from "../ui/DynamicIcon";

interface Props {
  householdId: Id<"households">;
  currency: string;
  dateFrom: number;
  dateTo: number;
  onManageBudgets: () => void;
}

export function BudgetAlertsCard({
  householdId,
  currency,
  dateFrom,
  dateTo,
  onManageBudgets,
}: Props) {
  const budgets = useQuery(api.budgets.listForHousehold, { householdId });
  const byCategory = useQuery(api.analytics.totalsPerCategory, {
    householdId,
    dateFrom,
    dateTo,
  });

  if (budgets === undefined || byCategory === undefined) return null;
  if (budgets.length === 0) {
    return (
      <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 drop-shadow-sm">
            <span className="text-[22px]">🎯</span>
            <h3 className="text-[15px] font-extrabold text-[#2b180a]">Budżety kategorii</h3>
          </div>
          <button
            onClick={onManageBudgets}
            className="text-xs font-bold text-[#cf833f] hover:underline"
          >
            Ustaw limity →
          </button>
        </div>
        <p className="text-xs text-[#b89b87] font-semibold text-center py-3">
          Brak ustawionych limitów. Kliknij „Ustaw limity", aby dodać budżety.
        </p>
      </div>
    );
  }

  const spendingByCategoryId: Record<string, number> = {};
  for (const c of byCategory) {
    spendingByCategoryId[c.id] = c.total;
  }

  const alerts = budgets.map((b) => {
    const spent = spendingByCategoryId[b.categoryId] ?? 0;
    const pct = b.limitAmount > 0 ? (spent / b.limitAmount) * 100 : 0;
    const remaining = b.limitAmount - spent;
    return { ...b, spent, pct, remaining };
  });

  alerts.sort((a, b) => b.pct - a.pct);

  return (
    <div className="bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <span className="text-[22px]">🎯</span>
          <h3 className="text-[15px] font-extrabold text-[#2b180a]">Budżety kategorii</h3>
        </div>
        <button
          onClick={onManageBudgets}
          className="text-xs font-bold text-[#cf833f] hover:underline"
        >
          Zarządzaj →
        </button>
      </div>

      <div className="space-y-4">
        {alerts.map((a) => {
          const isOver = a.pct >= 100;
          const isWarning = a.pct >= 80 && !isOver;

          const barColor = isOver
            ? "bg-red-400"
            : isWarning
            ? "bg-yellow-400"
            : "bg-[#67c48a]";

          const statusEmoji = isOver ? "🚨" : isWarning ? "⚠️" : "✅";
          const statusText = isOver
            ? `Przekroczono o ${formatAmount(Math.abs(a.remaining), currency)}`
            : isWarning
            ? `Zostało ${formatAmount(a.remaining, currency)}`
            : `Zostało ${formatAmount(a.remaining, currency)}`;

          return (
            <BudgetRow
              key={a._id}
              categoryId={a.categoryId}
              householdId={householdId}
              spent={a.spent}
              limit={a.limitAmount}
              pct={Math.min(a.pct, 100)}
              barColor={barColor}
              statusEmoji={statusEmoji}
              statusText={statusText}
              currency={currency}
            />
          );
        })}
      </div>
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
  statusEmoji: string;
  statusText: string;
  currency: string;
}) {
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const cat = categories?.find((c) => c._id === categoryId);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <DynamicIcon name={cat?.icon ?? "Package"} className="w-[18px] h-[18px] text-[#cf833f]" />
          <span className="text-xs font-bold text-[#3e2815]">{cat?.name ?? "..."}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs">{statusEmoji}</span>
          <span className="text-[10px] font-bold text-[#8a7262]">{statusText}</span>
        </div>
      </div>
      <div className="h-2 w-full bg-[#f5e5cf] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-bold text-[#b89b87]">
          {formatAmount(spent, currency)}
        </span>
        <span className="text-[10px] font-bold text-[#b89b87]">
          {formatAmount(limit, currency)}
        </span>
      </div>
    </div>
  );
}

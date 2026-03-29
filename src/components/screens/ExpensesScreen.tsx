import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { ExpensesIcon } from "../ui/icons/ExpensesIcon";
import { CalendarIcon } from "../ui/icons/CalendarIcon";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

export function ExpensesScreen({ householdId, currency }: Props) {
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<Id<"categories"> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { from, to } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const expenses = useQuery(api.expenses.list, {
    householdId,
    dateFrom: from,
    dateTo: to,
    categoryId: filterCategoryId ?? undefined,
  });

  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const removeExpense = useMutation(api.expenses.remove);

  async function handleDelete(expenseId: Id<"expenses">) {
    if (!confirm("Usunąć ten wydatek?")) return;
    try {
      await removeExpense({ expenseId });
      toast.success("Wydatek usunięty");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  // Consistent category pill colors
  const getPillColor = (catName: string) => {
    const map: Record<string, string> = {
      Jedzenie: "bg-[#719873] text-white",
      Rozrywka: "bg-[#cf9e83] text-white",
      Samochód: "bg-[#d48c6a] text-white",
      Dom: "bg-[#9da781] text-white",
    };
    return map[catName] || "bg-[#bba394] text-white";
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-6">
          <ExpensesIcon className="w-10 h-10 text-[#c76823]" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a]">Wszystkie Wydatki</h2>
        </div>
        
        {/* Date Indicator mimicking reference */}
        <div className="bg-[#fdf9f1] rounded-[1.5rem] py-3.5 px-6 shadow-[0_4px_24px_rgba(180,120,80,0.15)] flex items-center justify-center gap-3 w-full mb-6 border border-[#ebd8c8]/30">
          <CalendarIcon className="w-5 h-5 text-[#c76823]" />
          <span className="text-[#3e2815] font-extrabold text-[14px]">
            {new Date(from).toLocaleDateString("pl-PL")} - {new Date(to).toLocaleDateString("pl-PL")}
          </span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2.5 overflow-x-auto pb-4 pt-1 scrollbar-hide px-1">
        <FilterChip
          label="Wszystkie"
          active={!filterCategoryId}
          onClick={() => setFilterCategoryId(null)}
        />
        {categories?.map((cat) => (
          <FilterChip
            key={cat._id}
            label={cat.name}
            active={filterCategoryId === cat._id}
            onClick={() => setFilterCategoryId(cat._id)}
          />
        ))}
      </div>

      {/* Expenses List */}
      {expenses === undefined ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-[#fdf9f1] rounded-[2rem] p-8 text-center shadow-[0_4px_24px_rgba(180,120,80,0.15)]">
          <ExpensesIcon className="w-16 h-16 mx-auto mb-4 text-[#d8c5bc]" />
          <p className="text-[#8a7262] font-bold">Brak wydatków w tym okresie</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => {
            const catName = (expense.category as any)?.name || "Inne";
            const isExpanded = expandedId === expense._id;
            return (
              <div
                key={expense._id}
                onClick={() => setExpandedId(isExpanded ? null : expense._id)}
                className={`bg-[#fdf9f1] rounded-[24px] shadow-[0_4px_20px_rgba(180,120,80,0.12)] cursor-pointer overflow-hidden transition-all ${isExpanded ? 'scale-[1.02] shadow-[0_8px_30px_rgba(180,120,80,0.2)]' : 'hover:scale-[1.01]'}`}
              >
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-[16px] font-bold text-[#2b180a] leading-tight">
                      {expense.description || (expense.subcategory as any)?.name} 
                      <span className="whitespace-nowrap"> - {formatAmount(expense.amount, "PLN")}</span>
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center w-full">
                    <span className={`text-[11px] font-bold px-3 py-1.5 rounded-xl ${getPillColor(catName)}`}>
                      {catName}
                    </span>
                    <span className="text-sm font-semibold text-[#8a7262]">
                      {new Date(expense.date).toLocaleDateString("pl-PL", { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#ebd8c8]/50 pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    {expense.ocrRawText && (
                      <div className="bg-[#fffdf9] rounded-2xl p-4 border border-[#ebd8c8]">
                        <p className="text-xs font-bold text-[#8a7262] mb-2 uppercase tracking-wider">Tekst z paragonu</p>
                        <p className="text-xs text-[#4a3b32] font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                          {expense.ocrRawText}
                        </p>
                      </div>
                    )}
                    {expense.receiptUrl && (
                      <img
                         src={expense.receiptUrl}
                        alt="Paragon"
                        className="w-full rounded-2xl object-cover max-h-56 border border-white/50 shadow-sm"
                      />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(expense._id); }}
                      className="w-full py-3.5 text-sm text-[#e65a5a] font-bold bg-[#fffdf9] hover:bg-[#ffeaea] rounded-xl transition-colors border border-[#ffd2d2]"
                    >
                      Usuń wydatek
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-2 rounded-full font-extrabold text-[12px] transition-all focus:outline-none whitespace-nowrap shadow-sm ${
        active
          ? "bg-[#cf833f] text-white"
          : "bg-[#fdf9f1] text-[#6d4d38] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

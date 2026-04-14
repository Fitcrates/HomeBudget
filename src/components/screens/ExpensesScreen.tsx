import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { ExpensesIcon } from "../ui/icons/ExpensesIcon";
import { CalendarIcon } from "../ui/icons/CalendarIcon";
import { Search, X } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";

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
  const [pendingDeleteId, setPendingDeleteId] = useState<Id<"expenses"> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    try {
      await removeExpense({ expenseId });
      toast.success("Wydatek usunięty");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredExpenses = useMemo(() => {
    if (!expenses) return expenses;
    if (!normalizedSearch) return expenses;

    return expenses.filter((expense) => {
      const description = (expense.description || "").toLowerCase();
      const subcategory = ((expense.subcategory as any)?.name || "").toLowerCase();
      const category = ((expense.category as any)?.name || "").toLowerCase();
      return (
        description.includes(normalizedSearch) ||
        subcategory.includes(normalizedSearch) ||
        category.includes(normalizedSearch)
      );
    });
  }, [expenses, normalizedSearch]);

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
        <div className="mb-6 flex items-center gap-2">
          <ExpensesIcon className="h-10 w-10 text-[#c76823]" />
          <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a]">Wszystkie wydatki</h2>
        </div>

        <div className="mb-4 rounded-xl border border-[#ebd8c8]/30 bg-[#fdf9f1] px-4 py-3 shadow-[0_4px_24px_rgba(180,120,80,0.15)]">
          <PeriodSelector
            value={period}
            onChange={(value) => {
              setPeriod(value);
              setExpandedId(null);
            }}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
          />

          <div className="mt-2 flex items-center justify-center gap-3 rounded-xl border border-[#ebd8c8]/40 bg-white/60 px-4 py-2.5">
            <CalendarIcon className="h-5 w-5 text-[#c76823]" />
            <span className="text-[13px] font-medium text-[#3e2815]">
              {new Date(from).toLocaleDateString("pl-PL")} - {new Date(to).toLocaleDateString("pl-PL")}
            </span>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b89b87]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Szukaj po nazwie, kategorii lub podkategorii"
            className="w-full rounded-xl border border-[#ebd8c8]/50 bg-white/70 py-2.5 pl-10 pr-4 text-sm font-medium text-[#2b180a] shadow-sm outline-none transition-colors focus:border-[#cf833f]"
          />
          {searchTerm.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#b89b87] transition-colors hover:bg-[#fff0e8] hover:text-[#cf833f]"
              aria-label="Wyczyść wyszukiwanie"
              title="Wyczyść"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-1 pb-4 pt-1">
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

      {filteredExpenses === undefined ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#d87635]" />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="rounded-xl bg-[#fdf9f1] p-8 text-center shadow-[0_4px_24px_rgba(180,120,80,0.15)]">
          <ExpensesIcon className="mx-auto mb-4 h-16 w-16 text-[#d8c5bc]" />
          <p className="font-bold text-[#8a7262]">
            {normalizedSearch ? "Brak wyników dla tej frazy" : "Brak wydatków w tym okresie"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => {
            const catName = (expense.category as any)?.name || "Inne";
            const isExpanded = expandedId === expense._id;
            return (
              <div
                key={expense._id}
                onClick={() => setExpandedId(isExpanded ? null : expense._id)}
                className={`cursor-pointer overflow-hidden rounded-xl bg-[#fdf9f1] shadow-[0_4px_20px_rgba(180,120,80,0.12)] transition-all ${
                  isExpanded ? "scale-[1.02] shadow-[0_8px_30px_rgba(180,120,80,0.2)]" : "hover:scale-[1.01]"
                }`}
              >
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-[16px] font-bold leading-tight text-[#2b180a]">
                      {expense.description || (expense.subcategory as any)?.name}
                      <span className="whitespace-nowrap"> - {formatAmount(expense.amount, currency)}</span>
                    </p>
                  </div>

                  <div className="flex w-full items-center justify-between">
                    <span className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${getPillColor(catName)}`}>
                      {catName}
                    </span>
                    <span className="text-sm font-medium text-[#8a7262]">
                      {new Date(expense.date).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-[#ebd8c8]/50 px-5 pb-5 pt-4">
                    {expense.ocrRawText && (
                      <div className="rounded-xl border border-[#ebd8c8] bg-[#fffdf9] p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#8a7262]">Tekst z paragonu</p>
                        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#4a3b32]">
                          {expense.ocrRawText}
                        </p>
                      </div>
                    )}
                    {expense.receiptUrl && (
                      <img
                        src={expense.receiptUrl}
                        alt="Paragon"
                        className="max-h-56 w-full rounded-xl border border-white/50 object-cover shadow-sm"
                      />
                    )}
                    <div className="flex justify-end">
                      <IconTrashButton
                        onClick={() => setPendingDeleteId(expense._id)}
                        title="Usuń wydatek"
                        className="border border-[#ffd2d2] bg-[#fffdf9] text-[#e65a5a] hover:bg-[#ffeaea] hover:text-[#d44f43]"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Usunąć wydatek?"
        description="Ta operacja usunie wydatek z historii."
        confirmLabel="Usuń"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          void handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
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
      className={`whitespace-nowrap rounded-full px-4 py-2 text-[12px] font-medium shadow-sm transition-all focus:outline-none ${
        active ? "bg-[#cf833f] text-white" : "bg-[#fdf9f1] text-[#6d4d38] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

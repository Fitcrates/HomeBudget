import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { ExpensesIcon } from "../ui/icons/ExpensesIcon";
import { CalendarIcon } from "../ui/icons/CalendarIcon";
import { ChevronDown, Search, X } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { FilterChip } from "../ui/FilterChip";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";
import { AppCard } from "../ui/AppCard";

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
      <ScreenHeader
        icon={<ExpensesIcon className="h-9 w-9 text-[#c76823]" />}
        title="Wszystkie wydatki"
      />

        <div className="app-card space-y-4">
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

          <div className="flex items-center justify-center gap-3 rounded-xl border border-[#ebd8c8]/40 bg-white/60 px-4 py-2.5">
            <CalendarIcon className="h-5 w-5 text-[#c76823]" />
            <span className="text-[13px] font-medium text-[#3e2815]">
              {new Date(from).toLocaleDateString("pl-PL")} - {new Date(to).toLocaleDateString("pl-PL")}
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b89b87]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Szukaj po nazwie, kategorii lub podkategorii"
            className="app-input w-full py-2.5 pl-10 pr-4"
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
        <Spinner className="py-12" />
      ) : filteredExpenses.length === 0 ? (
        <AppCard padding="md" className="text-center">
          <ExpensesIcon className="mx-auto mb-4 h-16 w-16 text-[#d8c5bc]" />
          <p className="font-bold text-[#8a7262]">
            {normalizedSearch ? "Brak wyników dla tej frazy" : "Brak wydatków w tym okresie"}
          </p>
        </AppCard>
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => {
            const catName = (expense.category as any)?.name || "Inne";
            const isExpanded = expandedId === expense._id;
            return (
              <div
                key={expense._id}
                onClick={() => setExpandedId(isExpanded ? null : expense._id)}
                className={`app-card cursor-pointer overflow-hidden p-0 transition-all ${
                  isExpanded
                    ? "scale-[1.02] border-[#efd1af] shadow-md"
                    : "hover:scale-[1.01]"
                }`}
              >
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold leading-tight text-[#2b180a]">
                        {expense.description || (expense.subcategory as any)?.name}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[#cf833f]">
                        {formatAmount(expense.amount, currency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#ead7c6] bg-white/75 px-2.5 py-1.5 text-[#8a7262]">
                      <span className="text-xs font-bold">
                        {new Date(expense.date).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180 text-[#cf833f]" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between">
                    <span className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${getPillColor(catName)}`}>
                      {catName}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b89b87]">
                      {isExpanded ? "Zwiń" : "Rozwiń"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-[#ebd8c8]/50 bg-white/45 px-5 pb-5 pt-4">
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

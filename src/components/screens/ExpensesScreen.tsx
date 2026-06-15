import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { PeriodSelector, getPeriodRange } from "../ui/PeriodSelector";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { Receipt, Calendar, ChevronDown, Search, X } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { FilterChip } from "../ui/FilterChip";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";
import { AppCard } from "../ui/AppCard";

interface Props {
  householdId: Id<"households">;
  currency: string;
  embedded?: boolean;
}

export function ExpensesScreen({ householdId, currency, embedded = false }: Props) {
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
      Jedzenie: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      Rozrywka: "bg-fuchsia-500/20 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
      Samochód: "bg-blue-500/20 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      Dom: "bg-orange-500/20 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    };
    return map[catName] || "bg-zinc-500/20 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300";
  };

  return (
    <div className="space-y-5 pb-8">
      {!embedded && (
        <ScreenHeader
          icon={<Receipt className="h-9 w-9 text-orange-600 dark:text-indigo-400" strokeWidth={2.5} />}
          title="Wszystkie wydatki"
        />
      )}

        <AppCard className="space-y-4">
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

          <div className="flex items-center justify-center gap-3 rounded-[16px] border border-orange-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-2.5 transition-colors duration-700">
            <Calendar className="h-5 w-5 text-orange-600 dark:text-indigo-400 transition-colors duration-700" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-orange-950 dark:text-white transition-colors duration-700">
              {new Date(from).toLocaleDateString("pl-PL")} - {new Date(to).toLocaleDateString("pl-PL")}
            </span>
          </div>
        </AppCard>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-900/60 dark:text-white/40 transition-colors duration-700" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Szukaj po nazwie, kategorii lub podkategorii"
            className="w-full py-2.5 pl-10 pr-4 rounded-full border border-orange-200/50 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl text-sm font-bold text-orange-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 dark:focus:ring-indigo-500/50 transition-colors duration-700"
          />
          {searchTerm.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-orange-900/60 dark:text-white/50 transition-colors hover:bg-orange-200 dark:hover:bg-white/10 hover:text-orange-950 dark:hover:text-white"
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
          <Receipt className="mx-auto mb-4 h-16 w-16 text-orange-900/20 dark:text-white/20 transition-colors duration-700" strokeWidth={2} />
          <p className="font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
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
                className={`bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-orange-200/50 dark:border-white/10 rounded-[24px] cursor-pointer overflow-hidden p-0 transition-all duration-300 ${
                  isExpanded
                    ? "scale-[1.02] border-orange-400 dark:border-indigo-500 shadow-md dark:shadow-indigo-500/20"
                    : "hover:scale-[1.01]"
                }`}
              >
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold leading-tight text-orange-950 dark:text-white transition-colors duration-700">
                        {expense.description || (expense.subcategory as any)?.name}
                      </p>
                      <p className="mt-1 text-[15px] font-bold text-orange-600 dark:text-indigo-400 transition-colors duration-700">
                        {formatAmount(expense.amount, currency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 rounded-full border border-orange-200/50 dark:border-white/10 bg-white/75 dark:bg-white/10 px-2.5 py-1.5 text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                      <span className="text-xs font-bold">
                        {new Date(expense.date).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180 text-orange-600 dark:text-indigo-400" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between">
                    <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors duration-700 ${getPillColor(catName)}`}>
                      {catName}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                      {isExpanded ? "Zwiń" : "Rozwiń"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border-t border-orange-200/50 dark:border-white/10 bg-white/45 dark:bg-white/5 px-5 pb-5 pt-4 transition-colors duration-700">
                    {expense.ocrRawText && (
                      <div className="rounded-xl border border-orange-200/50 dark:border-white/10 bg-orange-50 dark:bg-white/5 p-4 transition-colors duration-700">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-900/60 dark:text-white/50 transition-colors duration-700">Tekst z paragonu</p>
                        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-orange-950 dark:text-white/80 transition-colors duration-700">
                          {expense.ocrRawText}
                        </p>
                      </div>
                    )}
                    {expense.receiptUrl && (
                      <img
                        src={expense.receiptUrl}
                        alt="Paragon"
                        className="max-h-56 w-full rounded-[16px] border border-orange-200/50 dark:border-white/10 object-cover shadow-sm transition-colors duration-700"
                      />
                    )}
                    <div className="flex justify-end">
                      <IconTrashButton
                        onClick={() => setPendingDeleteId(expense._id)}
                        title="Usuń wydatek"
                        className="border border-red-200 dark:border-rose-500/20 bg-red-50 dark:bg-rose-500/10 text-red-600 dark:text-rose-400 hover:bg-red-100 dark:hover:bg-rose-500/20 hover:text-red-700 dark:hover:text-rose-300 transition-colors duration-700"
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

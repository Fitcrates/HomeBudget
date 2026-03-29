import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { DynamicIcon } from "../ui/DynamicIcon";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatAmount } from "../../lib/format";

interface Props {
  householdId: Id<"households">;
  currency: string;
  onBack: () => void;
}

export function BudgetSettingsScreen({ householdId, currency, onBack }: Props) {
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const budgets = useQuery(api.budgets.listForHousehold, { householdId });
  const upsertBudget = useMutation(api.budgets.upsert);
  const removeBudget = useMutation(api.budgets.remove);

  const [editingCatId, setEditingCatId] = useState<Id<"categories"> | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPeriod, setEditPeriod] = useState<"month" | "week">("month");
  const [saving, setSaving] = useState(false);

  const budgetMap = new Map(budgets?.map((b) => [b.categoryId, b]) ?? []);

  function startEdit(catId: Id<"categories">) {
    const existing = budgetMap.get(catId);
    setEditingCatId(catId);
    setEditAmount(existing ? (existing.limitAmount / 100).toFixed(2) : "");
    setEditPeriod(existing?.period ?? "month");
  }

  async function handleSave() {
    if (!editingCatId) return;
    const amount = parseFloat(editAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Podaj prawidłową kwotę.");
      return;
    }
    setSaving(true);
    try {
      await upsertBudget({
        householdId,
        categoryId: editingCatId,
        limitAmount: Math.round(amount * 100),
        period: editPeriod,
      });
      toast.success("Budżet zapisany!");
      setEditingCatId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(catId: Id<"categories">) {
    try {
      await removeBudget({ householdId, categoryId: catId });
      toast.success("Limit usunięty.");
      if (editingCatId === catId) setEditingCatId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";
  const inputStyle =
    "w-full text-sm bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white text-[#2b180a] font-bold shadow-inner transition-all";

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onBack}
            className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none drop-shadow-sm"
          >
            ←
          </button>
          <span className="text-[26px] drop-shadow-sm">🎯</span>
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">
            Limity budżetu
          </h2>
        </div>
        <p className="text-xs text-[#8a7262] font-semibold ml-10 mt-1">
          Ustaw sugerowane limity wydatków dla każdej kategorii
        </p>
      </div>

      {categories === undefined || budgets === undefined ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
        </div>
      ) : (
        <div className={`${cardClass} space-y-3`}>
          {categories.map((cat) => {
            const existing = budgetMap.get(cat._id);
            const isEditing = editingCatId === cat._id;

            return (
              <div key={cat._id}>
                <div
                  className={`rounded-2xl transition-all shadow-sm ${
                    isEditing
                      ? "border-[2px] border-orange-400 bg-white/80 backdrop-blur-md p-4"
                      : "border border-white/60 bg-white/50 hover:bg-white/70 backdrop-blur-sm p-3.5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <DynamicIcon name={cat.icon} className="w-6 h-6 text-[#cf833f]" />
                      <div>
                        <p className="text-sm font-bold text-[#2b180a]">{cat.name}</p>
                        {existing && !isEditing && (
                          <p className="text-[10px] font-bold text-[#cf833f]">
                            {formatAmount(existing.limitAmount, currency)} /{" "}
                            {existing.period === "month" ? "miesiąc" : "tydzień"}
                          </p>
                        )}
                        {!existing && !isEditing && (
                          <p className="text-[10px] font-bold text-[#c0a898]">Brak limitu</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {existing && !isEditing && (
                        <button
                          onClick={() => handleRemove(cat._id)}
                          className="text-xs text-red-400 hover:text-red-500 font-bold px-2 py-1"
                        >
                          Usuń
                        </button>
                      )}
                      <button
                        onClick={() => (isEditing ? setEditingCatId(null) : startEdit(cat._id))}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm ${
                          isEditing
                            ? "bg-white/60 text-[#8a7262] hover:bg-white border border-[#ebd8c8]/50"
                            : existing
                            ? "bg-white/60 text-[#cf833f] hover:bg-white border border-white/60"
                            : "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-[0_2px_8px_rgba(200,120,50,0.3)] hover:scale-105"
                        }`}
                      >
                        {isEditing ? "Anuluj" : existing ? "Edytuj" : "Ustaw"}
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                          Limit kwotowy ({currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="np. 1500.00"
                          className={inputStyle}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                          Okres
                        </label>
                        <div className="flex gap-2">
                          {(["month", "week"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setEditPeriod(p)}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                editPeriod === p
                                  ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                                  : "bg-white border border-[#f5e5cf] text-[#8a7262]"
                              }`}
                            >
                              {p === "month" ? "📅 Miesięczny" : "📆 Tygodniowy"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleSave}
                        disabled={saving || !editAmount}
                        className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-extrabold text-[14px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        {saving ? "Zapisywanie..." : "💾 Zapisz limit"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { DynamicIcon } from "../ui/DynamicIcon";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatAmount } from "../../lib/format";
import { Target, Calendar, Save, Users, TrendingUp, ShieldAlert } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";

interface Props {
  householdId: Id<"households">;
  currency: string;
  onBack: () => void;
}

type BudgetMode = "categories" | "people";

export function BudgetSettingsScreen({ householdId, currency, onBack }: Props) {
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const budgets = useQuery(api.budgets.listForHousehold, { householdId });
  const personBudgets = useQuery(api.budgets.listPersonBudgets, { householdId });
  const memberBudgetOverview = useQuery(api.analytics.memberBudgetOverview, { householdId });
  const myMembership = useQuery(api.households.getMyMembership, { householdId });

  const upsertBudget = useMutation(api.budgets.upsert);
  const removeBudget = useMutation(api.budgets.remove);
  const upsertPersonBudget = useMutation(api.budgets.upsertPersonBudget);
  const removePersonBudget = useMutation(api.budgets.removePersonBudget);

  const [mode, setMode] = useState<BudgetMode>("categories");
  const [editingCatId, setEditingCatId] = useState<Id<"categories"> | null>(null);
  const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
  const [pendingDeleteCatId, setPendingDeleteCatId] = useState<Id<"categories"> | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<Id<"users"> | null>(null);
  const [categoryEditAmount, setCategoryEditAmount] = useState("");
  const [categoryEditPeriod, setCategoryEditPeriod] = useState<"month" | "week">("month");
  const [personEditAmount, setPersonEditAmount] = useState("");
  const [personEditPeriod, setPersonEditPeriod] = useState<"month" | "week">("month");
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingPerson, setSavingPerson] = useState(false);

  const canManageCategoryBudgets =
    myMembership?.role === "owner" ||
    myMembership?.financialRole === "parent" ||
    myMembership?.financialRole === "partner";
  const canManagePersonBudgets =
    myMembership?.role === "owner" || myMembership?.financialRole === "parent";

  const budgetMap = new Map(budgets?.map((budget) => [budget.categoryId, budget]) ?? []);
  const personBudgetMap = new Map(personBudgets?.map((budget) => [budget.userId, budget]) ?? []);

  function startEditCategory(catId: Id<"categories">) {
    const existing = budgetMap.get(catId);
    setEditingCatId(catId);
    setCategoryEditAmount(existing ? (existing.limitAmount / 100).toFixed(2) : "");
    setCategoryEditPeriod(existing?.period ?? "month");
  }

  function startEditPerson(targetUserId: Id<"users">) {
    const existing = personBudgetMap.get(targetUserId);
    setEditingUserId(targetUserId);
    setPersonEditAmount(existing ? (existing.limitAmount / 100).toFixed(2) : "");
    setPersonEditPeriod(existing?.period ?? "month");
  }

  async function handleSaveCategory() {
    if (!editingCatId) return;
    const amount = parseFloat(categoryEditAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Podaj prawidłową kwotę.");
      return;
    }

    setSavingCategory(true);
    try {
      await upsertBudget({
        householdId,
        categoryId: editingCatId,
        limitAmount: Math.round(amount * 100),
        period: categoryEditPeriod,
      });
      toast.success("Budżet kategorii został zapisany.");
      setEditingCatId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleSavePersonBudget() {
    if (!editingUserId) return;
    const amount = parseFloat(personEditAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Podaj prawidłową kwotę.");
      return;
    }

    setSavingPerson(true);
    try {
      await upsertPersonBudget({
        householdId,
        targetUserId: editingUserId,
        limitAmount: Math.round(amount * 100),
        period: personEditPeriod,
      });
      toast.success("Budżet osobisty został zapisany.");
      setEditingUserId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPerson(false);
    }
  }

  async function handleRemoveCategoryBudget(catId: Id<"categories">) {
    try {
      await removeBudget({ householdId, categoryId: catId });
      toast.success("Limit kategorii został usunięty.");
      if (editingCatId === catId) setEditingCatId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRemovePersonBudget(userId: Id<"users">) {
    try {
      await removePersonBudget({ householdId, targetUserId: userId });
      toast.success("Budżet osobisty został usunięty.");
      if (editingUserId === userId) setEditingUserId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function financialRoleLabel(role?: "parent" | "partner" | "child") {
    switch (role) {
      case "parent":
        return "Rodzic";
      case "child":
        return "Dziecko";
      default:
        return "Partner";
    }
  }

  function financialRoleBadge(role?: "parent" | "partner" | "child") {
    switch (role) {
      case "parent":
        return "bg-[#fff1df] text-[#b86a28] border-[#f3d3b6]";
      case "child":
        return "bg-[#eef4ff] text-[#3856a8] border-[#c8d8ff]";
      default:
        return "bg-[#ebf7ef] text-[#46825d] border-[#8bc5a0]";
    }
  }

  const cardClass = "app-card";
  const inputStyle =
    "w-full text-sm bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white text-[#2b180a] font-bold shadow-inner transition-all";

  const overBudgetCount = memberBudgetOverview?.filter((member) => member.isOverBudget).length ?? 0;
  const activePersonBudgets = memberBudgetOverview?.filter((member) => member.personalBudget).length ?? 0;
  const highestSpender = memberBudgetOverview?.[0] ?? null;

  if (
    categories === undefined ||
    budgets === undefined ||
    personBudgets === undefined ||
    memberBudgetOverview === undefined ||
    myMembership === undefined
  ) {
    return (
      <div className="space-y-6 pb-6">
        <div className="pt-2 pb-1">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={onBack}
              className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none drop-shadow-sm"
            >
              ←
            </button>
            <Target className="w-8 h-8 text-[#c76823] drop-shadow-sm" />
            <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a] drop-shadow-sm">
              Budżety i limity
            </h2>
          </div>
        </div>

        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onBack}
            className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none drop-shadow-sm"
          >
            ←
          </button>
          <Target className="w-8 h-8 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a] drop-shadow-sm">
            Budżety i limity
          </h2>
        </div>
        <p className="text-xs text-[#8a7262] font-medium ml-10 mt-1">
          Zarządzaj limitami kategorii oraz budżetami per osoba.
        </p>
      </div>

      <div className="flex bg-[#fdf9f1] rounded-xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1">
        {(
          [
            { key: "categories", label: "Kategorie", icon: Target },
            { key: "people", label: "Osoby", icon: Users },
          ] as { key: BudgetMode; label: string; icon: any }[]
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === key
                ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                : "text-[#8a7262] hover:text-[#cf833f]"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {mode === "people" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/50 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#cf833f] mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Najwięcej wydaje</span>
            </div>
            <p className="text-sm font-bold text-[#2b180a] truncate">{highestSpender?.displayName ?? "-"}</p>
            <p className="text-xs font-bold text-[#8a7262]">
              {highestSpender ? formatAmount(highestSpender.monthlySpent, currency) : "-"}
            </p>
          </div>

          <div className="rounded-xl border border-white/50 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#cf833f] mb-2">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Przekroczone</span>
            </div>
            <p className="text-lg font-bold text-[#2b180a]">{overBudgetCount}</p>
            <p className="text-xs font-bold text-[#8a7262]">osób ponad limit</p>
          </div>

          <div className="rounded-xl border border-white/50 bg-white/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#cf833f] mb-2">
              <Users className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Aktywne limity</span>
            </div>
            <p className="text-lg font-bold text-[#2b180a]">{activePersonBudgets}</p>
            <p className="text-xs font-bold text-[#8a7262]">budżetów osobistych</p>
          </div>
        </div>
      )}

      {mode === "categories" ? (
        <div className={`${cardClass} space-y-3`}>
          {categories.map((cat) => {
            const existing = budgetMap.get(cat._id);
            const isEditing = editingCatId === cat._id;

            return (
              <div key={cat._id} className="rounded-xl border border-white/60 bg-white/50 p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <DynamicIcon name={cat.icon} className="w-6 h-6 text-[#cf833f]" />
                    <div>
                      <p className="text-sm font-bold text-[#2b180a]">{cat.name}</p>
                      {existing ? (
                        <p className="text-[10px] font-bold text-[#cf833f]">
                          {formatAmount(existing.limitAmount, currency)} / {existing.period === "month" ? "miesiąc" : "tydzień"}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-[#c0a898]">Brak limitu</p>
                      )}
                    </div>
                  </div>

                  {canManageCategoryBudgets ? (
                    <div className="flex items-center gap-2">
                      {existing && !isEditing && (
                        <IconTrashButton
                          onClick={() => setPendingDeleteCatId(cat._id)}
                          title="Usuń limit"
                          className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-500"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingCatId(null) : startEditCategory(cat._id))}
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
                  ) : (
                    <span className="text-[11px] font-bold text-[#b89b87]">Tylko rodzic/partner</span>
                  )}
                </div>

                {isEditing && canManageCategoryBudgets && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                        Limit kwotowy ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={categoryEditAmount}
                        onChange={(e) => setCategoryEditAmount(e.target.value)}
                        placeholder="np. 1500.00"
                        className={inputStyle}
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-2">
                      {(["month", "week"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setCategoryEditPeriod(period)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            categoryEditPeriod === period
                              ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                              : "bg-white border border-[#f5e5cf] text-[#8a7262]"
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{period === "month" ? "Miesięczny" : "Tygodniowy"}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      disabled={savingCategory || !categoryEditAmount}
                      className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[14px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingCategory ? "Zapisywanie..." : "Zapisz limit kategorii"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${cardClass} space-y-3`}>
          {memberBudgetOverview.map((member) => {
            const existing = personBudgetMap.get(member.userId);
            const isEditing = editingUserId === member.userId;

            return (
              <div key={member.userId} className="rounded-xl border border-white/60 bg-white/50 p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#2b180a] truncate">{member.displayName}</p>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${financialRoleBadge(member.financialRole)}`}>
                        {financialRoleLabel(member.financialRole)}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-[#8a7262]">
                      Wydał(a) w tym miesiącu {formatAmount(member.monthlySpent, currency)}
                    </p>
                    {existing ? (
                      <p className="text-[10px] font-bold text-[#cf833f]">
                        Limit {formatAmount(existing.limitAmount, currency)} / {existing.period === "month" ? "miesiąc" : "tydzień"}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-[#c0a898]">Brak budżetu osobistego</p>
                    )}
                  </div>

                  {canManagePersonBudgets ? (
                    <div className="flex items-center gap-2">
                      {existing && !isEditing && (
                        <IconTrashButton
                          onClick={() => setPendingDeleteUserId(member.userId)}
                          title="Usuń budżet osobisty"
                          className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-500"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingUserId(null) : startEditPerson(member.userId))}
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
                  ) : (
                    <span className="text-[11px] font-bold text-[#b89b87]">Tylko rodzic</span>
                  )}
                </div>

                {member.personalBudget && member.personalBudgetSpent !== null && (
                  <div className="mt-3 space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#f5e5cf]">
                      <div
                        className={`h-full rounded-full ${
                          member.isOverBudget
                            ? "bg-red-400"
                            : (member.personalBudgetPct ?? 0) >= 80
                              ? "bg-yellow-400"
                              : "bg-[#67c48a]"
                        }`}
                        style={{ width: `${Math.min(member.personalBudgetPct ?? 0, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-[#8a7262]">
                      <span>Wydano {formatAmount(member.personalBudgetSpent ?? 0, currency)}</span>
                      <span>
                        {member.personalBudgetRemaining !== null && member.personalBudgetRemaining >= 0
                          ? `Zostało ${formatAmount(member.personalBudgetRemaining, currency)}`
                          : `Ponad limit o ${formatAmount(Math.abs(member.personalBudgetRemaining ?? 0), currency)}`}
                      </span>
                    </div>
                  </div>
                )}

                {isEditing && canManagePersonBudgets && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                        Limit osobisty ({currency})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={personEditAmount}
                        onChange={(e) => setPersonEditAmount(e.target.value)}
                        placeholder="np. 300.00"
                        className={inputStyle}
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-2">
                      {(["month", "week"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setPersonEditPeriod(period)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            personEditPeriod === period
                              ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                              : "bg-white border border-[#f5e5cf] text-[#8a7262]"
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          <span>{period === "month" ? "Miesięczny" : "Tygodniowy"}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleSavePersonBudget}
                      disabled={savingPerson || !personEditAmount}
                      className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[14px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingPerson ? "Zapisywanie..." : "Zapisz budżet osobisty"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteCatId)}
        title="Usunąć limit budżetu kategorii?"
        description="Kategoria wróci do stanu bez ustawionego limitu."
        confirmLabel="Usuń"
        onCancel={() => setPendingDeleteCatId(null)}
        onConfirm={() => {
          if (!pendingDeleteCatId) return;
          void handleRemoveCategoryBudget(pendingDeleteCatId);
          setPendingDeleteCatId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteUserId)}
        title="Usunąć budżet osobisty?"
        description="Ta osoba straci przypisany limit wydatków."
        confirmLabel="Usuń"
        onCancel={() => setPendingDeleteUserId(null)}
        onConfirm={() => {
          if (!pendingDeleteUserId) return;
          void handleRemovePersonBudget(pendingDeleteUserId);
          setPendingDeleteUserId(null);
        }}
      />
    </div>
  );
}

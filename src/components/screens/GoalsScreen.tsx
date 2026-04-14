import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Target, Plus, Star, X } from "lucide-react";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { DynamicIcon } from "../ui/DynamicIcon";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

export function GoalsScreen({ householdId, currency }: Props) {
  const goals = useQuery(api.goals.listForHousehold, { householdId });
  const [showAdd, setShowAdd] = useState(false);

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-xl p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  return (
    <div className="space-y-6 pb-6">
      <div className="pt-2 pb-1">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-9 w-9 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a] drop-shadow-sm">Skarbonki</h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="ml-1 text-[1.1rem] font-bold text-[#3e2815] drop-shadow-sm sm:text-[1.2rem]">
            Cele oszczędnościowe
          </h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#cf833f] px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 sm:w-auto sm:hover:scale-105"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Zamknij" : "Nowy cel"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="animate-in fade-in slide-in-from-top-4">
          <AddGoalCard householdId={householdId} onClose={() => setShowAdd(false)} currency={currency} />
        </div>
      )}

      {goals === undefined ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#d87635]" />
        </div>
      ) : goals.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-center py-10 text-center opacity-90`}>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#f5e5cf] bg-[#fcf4e4] shadow-sm">
            <Star className="h-8 w-8 text-[#ca782a]" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-[#3e2815]">Brak celów</h3>
          <p className="text-sm font-bold text-[#8a7262]">
            Dodaj swój pierwszy cel oszczędnościowy, np. na wakacje lub samochód.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard key={goal._id} goal={goal} currency={currency} householdId={householdId} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddGoalCard({ householdId, onClose, currency }: { householdId: Id<"households">; onClose: () => void; currency: string }) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [icon, setIcon] = useState("Target");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const createGoal = useMutation(api.goals.create);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Wpisz nazwę celu");
    const amount = parseFloat(targetAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return toast.error("Błędna kwota celu");

    setSaving(true);
    try {
      await createGoal({
        householdId,
        name: name.trim(),
        targetAmount: Math.round(amount * 100),
        icon,
        deadline: deadline ? new Date(deadline).getTime() : undefined,
      });
      toast.success("Cel utworzony!");
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const icons = ["Target", "Plane", "Car", "Home", "Heart", "Briefcase", "Gift", "Coffee"];

  return (
    <div className="rounded-xl border-2 border-[#cf833f]/30 bg-white/60 p-5 shadow-[0_8px_32px_rgba(200,120,60,0.15)] backdrop-blur-xl">
      <h3 className="mb-4 text-center text-[15px] font-medium text-[#2b180a]">Nowy cel oszczędnościowy</h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="ml-1 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">Nazwa</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Wakacje w Hiszpanii"
            className="w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-[#2b180a] shadow-inner outline-none focus:border-[#cf833f]"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="ml-1 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">Cel ({currency})</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-[#2b180a] shadow-inner outline-none focus:border-[#cf833f]"
              required
            />
          </div>
          <div>
            <label className="ml-1 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">Do kiedy? (opcj.)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-[#2b180a] shadow-inner outline-none focus:border-[#cf833f]"
            />
          </div>
        </div>

        <div>
          <label className="ml-1 mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">Ikona</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {icons.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={`shrink-0 rounded-xl p-3 transition-all ${
                  icon === ic
                    ? "scale-105 bg-[#cf833f] text-white shadow-md"
                    : "border border-[#f5e5cf] bg-white/50 text-[#8a7262] hover:bg-white"
                }`}
              >
                <DynamicIcon name={ic} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name || !targetAmount}
          className="w-full rounded-xl bg-gradient-to-r from-[#de9241] to-[#ca782a] py-3 text-[14px] font-medium text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 hover:scale-[1.02]"
        >
          {saving ? "Tworzenie..." : "Utwórz cel"}
        </button>
      </form>
    </div>
  );
}

function GoalCard({
  goal,
  currency,
  householdId,
}: {
  goal: {
    _id: Id<"goals">;
    name: string;
    targetAmount: number;
    currentAmount: number;
    icon: string;
    deadline?: number;
  };
  currency: string;
  householdId: Id<"households">;
}) {
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const addFunds = useMutation(api.goals.addFunds);
  const removeGoal = useMutation(api.goals.remove);

  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const isCompleted = pct >= 100;

  async function handleAddFunds(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(amountToAdd.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return toast.error("Błędna kwota");

    setAdding(true);
    try {
      await addFunds({
        householdId,
        goalId: goal._id,
        amount: Math.round(amount * 100),
      });
      toast.success("Środki dodane do celu!");
      setShowAddFunds(false);
      setAmountToAdd("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    try {
      await removeGoal({ householdId, goalId: goal._id });
      toast.success("Cel usunięty");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#f5e5cf]/80 bg-white/40 p-4 shadow-[0_4px_24px_rgba(180,120,80,0.1)] backdrop-blur-xl sm:p-5">
      {isCompleted && (
        <div className="absolute right-0 top-0 z-10 rounded-bl-xl bg-[#4aad6f] px-3 py-1 text-[9px] font-medium uppercase tracking-wider text-white shadow-sm">
          Osiągnięto
        </div>
      )}

      <IconTrashButton
        onClick={() => setShowDeleteModal(true)}
        title="Usuń cel"
        className="absolute right-2 top-2 z-30 h-8 w-8 bg-white/80 shadow-sm pointer-events-auto"
      />

      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-inner sm:h-14 sm:w-14 ${
            isCompleted ? "border-[#4aad6f] bg-[#dcfce7]" : "border-[#cf833f]/30 bg-[#fcf4e4]"
          }`}
        >
          <DynamicIcon name={goal.icon} className={`h-6 w-6 sm:h-7 sm:w-7 ${isCompleted ? "text-[#4aad6f]" : "text-[#cf833f]"}`} />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <h4 className="truncate text-[14px] font-medium text-[#2b180a] sm:text-[15px]">{goal.name}</h4>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <span className={`text-[16px] font-bold leading-none sm:text-[17px] ${isCompleted ? "text-[#4aad6f]" : "text-[#2b180a]"}`}>
              {formatAmount(goal.currentAmount, currency)}
            </span>
            <span className="text-[11px] font-bold leading-none text-[#b89b87]">z {formatAmount(goal.targetAmount, currency)}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-[#f5e5cf] shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isCompleted ? "bg-gradient-to-r from-[#67c48a] to-[#4aad6f]" : "bg-gradient-to-r from-[#de9241] to-[#ca782a]"
            }`}
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
          <span className="text-[11px] font-bold text-[#cf833f]">{pct.toFixed(1)}%</span>
          {!isCompleted && goal.deadline && (
            <span className="text-[10px] font-bold text-[#b89b87]">Cel do: {new Date(goal.deadline).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {!isCompleted && !showAddFunds && (
        <button
          onClick={() => setShowAddFunds(true)}
          className="mt-4 w-full rounded-xl border border-[#f5e5cf] bg-white/60 py-2 text-xs font-medium text-[#cf833f] shadow-sm transition-all hover:bg-white"
        >
          Odkładasz z bieżącej wypłaty? Wpłać do skarbonki
        </button>
      )}

      {showAddFunds && (
        <form onSubmit={handleAddFunds} className="mt-4 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amountToAdd}
            onChange={(e) => setAmountToAdd(e.target.value)}
            placeholder="Kwota wpłaty"
            className="w-full rounded-xl border border-[#f5e5cf] bg-white px-3 py-2 text-sm font-bold text-[#2b180a] outline-none focus:border-[#cf833f]"
            autoFocus
          />
          <button
            type="submit"
            disabled={adding || !amountToAdd}
            className="rounded-xl bg-[#cf833f] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {adding ? "Wpłacanie..." : "Wpłać"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddFunds(false);
              setAmountToAdd("");
            }}
            className="rounded-xl border border-[#f5e5cf] bg-white px-3 py-2 text-sm font-medium text-[#b89b87] shadow-sm transition-colors hover:text-[#2b180a]"
          >
            Anuluj
          </button>
        </form>
      )}

      <ConfirmDialog
        open={showDeleteModal}
        title="Usunąć ten cel?"
        description="Odłożone środki na liczniku znikną z aplikacji."
        confirmLabel="Usuń"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={() => {
          void handleDelete();
          setShowDeleteModal(false);
        }}
      />
    </div>
  );
}

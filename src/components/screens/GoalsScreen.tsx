import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Target, Plus, Star, Plane, Car, Home, TrendingUp, X } from "lucide-react";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { DynamicIcon } from "../ui/DynamicIcon";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

export function GoalsScreen({ householdId, currency }: Props) {
  const goals = useQuery(api.goals.listForHousehold, { householdId });
  const [showAdd, setShowAdd] = useState(false);

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-9 h-9 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Skarbonki</h2>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-[1.2rem] font-bold text-[#3e2815] ml-1 drop-shadow-sm">Cele oszczędnościowe</h3>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#cf833f] text-white rounded-full text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-transform"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? "Zamknij" : "Nowy Cel"}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
        </div>
      ) : goals.length === 0 ? (
        <div className={`${cardClass} flex flex-col items-center text-center py-10 opacity-90`}>
          <div className="w-16 h-16 bg-[#fcf4e4] rounded-full flex items-center justify-center mb-4 border border-[#f5e5cf] shadow-sm">
            <Star className="w-8 h-8 text-[#ca782a]" />
          </div>
          <h3 className="text-[#3e2815] font-extrabold text-lg mb-2">Brak celów</h3>
          <p className="text-[#8a7262] font-bold text-sm">
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
    <div className="bg-white/60 backdrop-blur-xl border-2 border-[#cf833f]/30 rounded-[2rem] p-5 shadow-[0_8px_32px_rgba(200,120,60,0.15)]">
      <h3 className="text-[15px] font-extrabold text-[#2b180a] mb-4 text-center">Nowy cel oszczędnościowy</h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">Nazwa</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Wakacje w Hiszpanii"
            className="w-full text-sm bg-white/70 border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] font-bold text-[#2b180a] shadow-inner"
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">Cel ({currency})</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-sm bg-white/70 border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] font-bold text-[#2b180a] shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">Do kiedy? (Opcj.)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full text-sm bg-white/70 border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] font-bold text-[#2b180a] shadow-inner"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">Ikona</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {icons.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={`p-3 rounded-2xl flex-shrink-0 transition-all ${
                  icon === ic ? "bg-[#cf833f] text-white shadow-md scale-105" : "bg-white/50 text-[#8a7262] hover:bg-white border border-[#f5e5cf]"
                }`}
              >
                <DynamicIcon name={ic} className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !name || !targetAmount}
          className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-xl font-extrabold text-[14px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? "Tworzenie..." : "Utwórz cel"}
        </button>
      </form>
    </div>
  );
}

function GoalCard({ goal, currency, householdId }: { 
  goal: { 
    _id: Id<"goals">; 
    name: string; 
    targetAmount: number; 
    currentAmount: number; 
    icon: string; 
    deadline?: number 
  }; 
  currency: string; 
  householdId: Id<"households"> 
}) {
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState("");
  const [adding, setAdding] = useState(false);
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
    if (!confirm("Na pewno usunąć ten cel? Odłożone środki na liczniku w aplikacji znikną (Twoje prawdziwe konto oczywiście pozostaje bez zmian).")) return;
    try {
      await removeGoal({ householdId, goalId: goal._id });
      toast.success("Cel usunięty");
    } catch(e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="bg-white/40 backdrop-blur-xl border border-[#f5e5cf]/80 rounded-[2rem] p-5 shadow-[0_4px_24px_rgba(180,120,80,0.1)] relative overflow-hidden group">
      {isCompleted && (
        <div className="absolute top-0 right-0 bg-[#4aad6f] text-white text-[9px] font-extrabold px-3 py-1 rounded-bl-xl z-10 shadow-sm uppercase tracking-wider">
          Osiągnięto! 🎉
        </div>
      )}

      {/* Action menu - hover only on desktop, always visible on touch... simplify by just small icon */}
      <button onClick={handleDelete} className="absolute top-3 right-3 p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner border-2 ${isCompleted ? "bg-[#dcfce7] border-[#4aad6f]" : "bg-[#fcf4e4] border-[#cf833f]/30"}`}>
          <DynamicIcon name={goal.icon} className={`w-7 h-7 ${isCompleted ? "text-[#4aad6f]" : "text-[#cf833f]"}`} />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="text-[15px] font-extrabold text-[#2b180a] truncate">{goal.name}</h4>
          <div className="flex items-end justify-between mt-1">
            <span className={`text-[17px] font-bold leading-none ${isCompleted ? "text-[#4aad6f]" : "text-[#2b180a]"}`}>
              {formatAmount(goal.currentAmount, currency)}
            </span>
            <span className="text-[11px] font-bold text-[#b89b87] leading-none mb-[2px]">
              z {formatAmount(goal.targetAmount, currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 relative z-10">
        <div className="h-3.5 w-full bg-[#f5e5cf] rounded-full overflow-hidden shadow-inner relative">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? "bg-gradient-to-r from-[#67c48a] to-[#4aad6f]" : "bg-gradient-to-r from-[#de9241] to-[#ca782a]"}`}
            style={{ width: `${Math.max(5, pct)}%` }} // min 5% so bar is visible slightly
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[11px] font-bold text-[#cf833f]">{pct.toFixed(1)}%</span>
          {!isCompleted && goal.deadline && (
            <span className="text-[10px] font-bold text-[#b89b87]">
              Cel do: {new Date(goal.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Inline Add Funds */}
      {!isCompleted && !showAddFunds && (
        <button
          onClick={() => setShowAddFunds(true)}
          className="mt-4 w-full py-2 bg-white/60 hover:bg-white text-[#cf833f] border border-[#f5e5cf] rounded-xl text-xs font-extrabold shadow-sm transition-all"
        >
          Odkładasz z bieżącej wypłaty? Wpłać do skarbonki →
        </button>
      )}

      {showAddFunds && (
        <form onSubmit={handleAddFunds} className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amountToAdd}
            onChange={(e) => setAmountToAdd(e.target.value)}
            placeholder="Kwota wpłaty"
            className="flex-1 text-sm bg-white border border-[#f5e5cf] rounded-xl px-3 py-2 outline-none focus:border-[#cf833f] font-bold text-[#2b180a]"
            autoFocus
          />
          <button
            type="submit"
            disabled={adding || !amountToAdd}
            className="px-4 py-2 bg-[#cf833f] text-white rounded-xl text-sm font-extrabold disabled:opacity-50 transition-colors shadow-sm"
          >
            {adding ? "Wpłacanie..." : "Wpłać"}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddFunds(false); setAmountToAdd(""); }}
            className="px-3 py-2 bg-white text-[#b89b87] border border-[#f5e5cf] hover:text-[#2b180a] rounded-xl text-sm font-extrabold transition-colors shadow-sm"
          >
            Anuluj
          </button>
        </form>
      )}
    </div>
  );
}

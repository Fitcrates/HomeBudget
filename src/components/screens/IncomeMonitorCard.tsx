import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { DollarSign, Zap, Check, Save } from "lucide-react";

interface Props {
  householdId: Id<"households">;
  currency: string;
  spentThisMonth: number;
}

export function IncomeMonitorCard({ householdId, currency, spentThisMonth }: Props) {
  const income = useQuery(api.income.get, { householdId });
  const upsertIncome = useMutation(api.income.upsert);
  const removeIncome = useMutation(api.income.remove);

  const [editing, setEditing] = useState(false);
  const [inputAmount, setInputAmount] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setInputAmount(income ? (income.monthlyAmount / 100).toFixed(2) : "");
    setEditing(true);
  }

  async function handleSave() {
    const amount = parseFloat(inputAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Podaj prawidłową kwotę dochodu.");
      return;
    }
    setSaving(true);
    try {
      await upsertIncome({
        householdId,
        monthlyAmount: Math.round(amount * 100),
      });
      toast.success("Dochód zapisany!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Usunąć ustawiony dochód?")) return;
    try {
      await removeIncome({ householdId });
      toast.success("Dochód usunięty.");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const cardClass =
    "bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  // Loading state
  if (income === undefined) {
    return (
      <div className={cardClass}>
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#d87635]" />
        </div>
      </div>
    );
  }

  // No income set yet
  if (!income && !editing) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 drop-shadow-sm">
            <DollarSign className="w-6 h-6 text-[#c76823]" />
            <h3 className="text-[15px] font-extrabold text-[#2b180a]">Dochód miesięczny</h3>
          </div>
          <button
            onClick={startEdit}
            className="text-xs font-bold text-[#cf833f] hover:underline"
          >
            Ustaw →
          </button>
        </div>
        <p className="text-xs text-[#b89b87] font-semibold text-center py-2">
          Ustaw miesięczny dochód, aby śledzić budżet w czasie rzeczywistym.
        </p>
      </div>
    );
  }

  const monthly = income?.monthlyAmount ?? 0;
  const remaining = monthly - spentThisMonth;
  const pct = monthly > 0 ? Math.min((spentThisMonth / monthly) * 100, 100) : 0;
  const isOver = spentThisMonth > monthly;
  const isWarning = pct >= 80 && !isOver;

  // Days in current month for daily burn rate
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedSpend = monthly > 0 ? (monthly / daysInMonth) * dayOfMonth : 0;
  const isAheadOfPace = spentThisMonth > expectedSpend;

  const barColor = isOver
    ? "bg-gradient-to-r from-red-400 to-red-500"
    : isWarning
    ? "bg-gradient-to-r from-yellow-400 to-orange-400"
    : "bg-gradient-to-r from-[#67c48a] to-[#4aad6f]";

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 drop-shadow-sm">
          <DollarSign className="w-6 h-6 text-[#c76823]" />
          <h3 className="text-[15px] font-extrabold text-[#2b180a]">Dochód miesięczny</h3>
        </div>
        <div className="flex items-center gap-2">
          {income && (
            <button
              onClick={handleRemove}
              className="text-[10px] font-bold text-red-400 hover:text-red-500"
            >
              Usuń
            </button>
          )}
          <button
            onClick={editing ? () => setEditing(false) : startEdit}
            className="text-xs font-bold text-[#cf833f] hover:underline"
          >
            {editing ? "Anuluj" : "Edytuj"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
              Miesięczny dochód netto ({currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="np. 8000.00"
              className="w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white transition-all text-[#2b180a] font-bold shadow-inner"
              autoFocus
            />
            <p className="text-[10px] text-[#b89b87] font-semibold mt-1 ml-1">
              Łączny dochód netto całego gospodarstwa domowego
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !inputAmount}
            className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-extrabold text-[14px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Zapisywanie..." : "Zapisz dochód"}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main numbers */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider mb-0.5">
                Wydano w tym miesiącu
              </p>
              <p className={`text-2xl font-extrabold ${isOver ? "text-red-500" : "text-[#2b180a]"}`}>
                {formatAmount(spentThisMonth, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#b89b87] uppercase tracking-wider mb-0.5">
                Dochód
              </p>
              <p className="text-lg font-extrabold text-[#6d4d38]">
                {formatAmount(monthly, currency)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-3 w-full bg-[#f5e5cf] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-bold text-[#b89b87]">
                {pct.toFixed(0)}% wykorzystano
              </span>
              <span
                className={`text-[10px] font-bold ${
                  isOver ? "text-red-500" : "text-[#67c48a]"
                }`}
              >
                {isOver
                  ? `Przekroczono o ${formatAmount(Math.abs(remaining), currency)}`
                  : `Pozostało ${formatAmount(remaining, currency)}`}
              </span>
            </div>
          </div>

          {/* Pace indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
              isAheadOfPace
                ? "bg-[#fff5f5] text-red-600 border border-red-100"
                : "bg-[#f0fff4] text-green-700 border border-green-100"
            }`}
          >
            {isAheadOfPace ? <Zap className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            <span>
              {isAheadOfPace
                ? `Wydajesz szybciej niż planowano — oczekiwano ${formatAmount(Math.round(expectedSpend), currency)} na dzień ${dayOfMonth}.`
                : `Tempo wydatków jest w normie — oczekiwano ${formatAmount(Math.round(expectedSpend), currency)} na dzień ${dayOfMonth}.`}
            </span>
          </div>

          {/* Savings projection */}
          {!isOver && monthly > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#fffbeb] text-[#92610a] border border-yellow-100">
              <DollarSign className="w-4 h-4" />
              <span>
                Prognoza oszczędności:{" "}
                <span className="text-[#cf833f]">
                  {formatAmount(Math.max(0, monthly - Math.round((spentThisMonth / dayOfMonth) * daysInMonth)), currency)}
                </span>{" "}
                do końca miesiąca
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

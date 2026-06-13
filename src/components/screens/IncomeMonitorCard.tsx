import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import { DollarSign, Zap, Check, Save } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { AppCard } from "../ui/AppCard";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ProgressBar } from "../ui/ProgressBar";
import { AlertBanner } from "../ui/AlertBanner";
import { Spinner } from "../ui/Spinner";

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
  const [showRemoveModal, setShowRemoveModal] = useState(false);
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
    try {
      await removeIncome({ householdId });
      toast.success("Dochód usunięty.");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const cardHeader = (
    <div className="flex items-center gap-2 drop-shadow-sm">
      <DollarSign className="w-6 h-6 text-orange-600 dark:text-indigo-400 transition-colors duration-700" />
      <h3 className="text-[15px] font-bold text-orange-950 dark:text-white transition-colors duration-700">Dochód miesięczny</h3>
    </div>
  );

  // Loading state
  if (income === undefined) {
    return (
      <AppCard>
        <Spinner size="sm" className="py-4" />
      </AppCard>
    );
  }

  // No income set yet
  if (!income && !editing) {
    return (
      <AppCard>
        <div className="flex items-center justify-between mb-3">
          {cardHeader}
          <button
            onClick={startEdit}
            className="text-xs font-bold text-orange-500 dark:text-indigo-400 hover:underline transition-colors duration-700"
          >
            Ustaw →
          </button>
        </div>
        <p className="text-xs text-orange-900/60 dark:text-white/50 font-medium text-center py-2 transition-colors duration-700">
          Ustaw miesięczny dochód, aby śledzić budżet w czasie rzeczywistym.
        </p>
      </AppCard>
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
    : "bg-gradient-to-r from-emerald-500 to-emerald-600";

  return (
    <AppCard>
      <div className="flex items-center justify-between mb-4">
        {cardHeader}
        <div className="flex items-center gap-2">
          {income && (
            <IconTrashButton
              onClick={() => setShowRemoveModal(true)}
              title="Usuń dochód"
              className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-500"
            />
          )}
          <button
            onClick={editing ? () => setEditing(false) : startEdit}
            className="text-xs font-bold text-orange-500 dark:text-indigo-400 hover:underline transition-colors duration-700"
          >
            {editing ? "Anuluj" : "Edytuj"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <FormLabel>
              Miesięczny dochód netto ({currency})
            </FormLabel>
            <FormInput
              type="number"
              min="0"
              step="0.01"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="np. 8000.00"
              autoFocus
            />
            <p className="text-[10px] text-orange-900/60 dark:text-white/50 font-medium mt-1 ml-1 transition-colors duration-700">
              Łączny dochód netto całego gospodarstwa domowego
            </p>
          </div>
          <ButtonPrimary
            onClick={handleSave}
            loading={saving}
            disabled={!inputAmount}
            icon={<Save className="w-4 h-4" />}
          >
            {saving ? "Zapisywanie..." : "Zapisz dochód"}
          </ButtonPrimary>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main numbers */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 uppercase tracking-wider mb-0.5 transition-colors duration-700">
                Wydano w tym miesiącu
              </p>
              <p className={`text-2xl font-bold transition-colors duration-700 ${isOver ? "text-red-500 dark:text-rose-400" : "text-orange-950 dark:text-white"}`}>
                {formatAmount(spentThisMonth, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 uppercase tracking-wider mb-0.5 transition-colors duration-700">
                Dochód
              </p>
              <p className="text-lg font-bold text-orange-900 dark:text-white/80 transition-colors duration-700">
                {formatAmount(monthly, currency)}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar value={pct} height="md" />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
              {pct.toFixed(0)}% wykorzystano
            </span>
            <span
              className={`text-[10px] font-bold transition-colors duration-700 ${
                isOver ? "text-red-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isOver
                ? `Przekroczono o ${formatAmount(Math.abs(remaining), currency)}`
                : `Pozostało ${formatAmount(remaining, currency)}`}
            </span>
          </div>

          {/* Pace indicator */}
          <AlertBanner
            variant={isAheadOfPace ? "error" : "success"}
            icon={isAheadOfPace ? <Zap className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          >
            {isAheadOfPace
              ? `Wydajesz szybciej niż planowano — oczekiwano ${formatAmount(Math.round(expectedSpend), currency)} na dzień ${dayOfMonth}.`
              : `Tempo wydatków jest w normie — oczekiwano ${formatAmount(Math.round(expectedSpend), currency)} na dzień ${dayOfMonth}.`}
          </AlertBanner>

          {/* Savings projection */}
          {!isOver && monthly > 0 && (
            <AlertBanner
              variant="warning"
              icon={<DollarSign className="w-4 h-4" />}
            >
              Prognoza oszczędności:{" "}
              <span className="text-orange-500 dark:text-indigo-400 font-bold transition-colors duration-700">
                {formatAmount(Math.max(0, monthly - Math.round((spentThisMonth / dayOfMonth) * daysInMonth)), currency)}
              </span>{" "}
              do końca miesiąca
            </AlertBanner>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showRemoveModal}
        title="Usunąć ustawiony dochód?"
        description="Po usunięciu karta wróci do trybu konfiguracji dochodu."
        confirmLabel="Usuń"
        onCancel={() => setShowRemoveModal(false)}
        onConfirm={() => {
          void handleRemove();
          setShowRemoveModal(false);
        }}
      />
    </AppCard>
  );
}

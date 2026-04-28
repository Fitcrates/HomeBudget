import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "../../lib/format";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DynamicIcon } from "../ui/DynamicIcon";
import { IconTrashButton } from "../ui/IconTrashButton";
import { AppCard } from "../ui/AppCard";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";
import { ProgressBar } from "../ui/ProgressBar";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { ButtonPrimary } from "../ui/ButtonPrimary";

interface Props {
  householdId: Id<"households">;
  currency: string;
}

type GoalActionPlanItem = {
  kind: string;
  title: string;
  body: string;
  amount: number;
  period: "day" | "week" | "month";
  monthlyImpact: number;
  daysFaster: number | null;
  projectedCompletionDate: number | null;
  sourceCategoryName: string | null;
  reductionPct: number | null;
};

type GoalViewModel = {
  _id: Id<"goals">;
  name: string;
  targetAmount: number;
  currentAmount: number;
  icon: string;
  deadline?: number;
  remainingAmount: number;
  progressPct: number;
  pace: {
    status: "completed" | "idle" | "behind" | "ahead" | "on_track";
    last30DaysAmount: number;
    averageDailyAmount: number;
    averageWeeklyAmount: number;
    projectedMonthlyAmount: number;
    projectedCompletionDate: number | null;
    trendPct: number;
  };
  plan: {
    mode: "deadline" | "smart";
    deadlineDaysLeft: number | null;
    targetDailyAmount: number;
    targetWeeklyAmount: number;
    targetMonthlyAmount: number;
    isBehind: boolean;
  };
  recentContributions: Array<{
    _id: string;
    amount: number;
    createdAt: number;
  }>;
  actionPlan: GoalActionPlanItem[];
};

function formatShortDate(timestamp: number | null | undefined) {
  if (!timestamp) return "brak prognozy";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestamp));
}

function periodLabel(period: GoalActionPlanItem["period"]) {
  if (period === "day") return "dziennie";
  if (period === "week") return "tygodniowo";
  return "miesięcznie";
}

function getPaceMeta(goal: GoalViewModel) {
  switch (goal.pace.status) {
    case "completed":
      return {
        badge: "Cel osiągnięty",
        tone: "text-[#4aad6f]",
        bg: "bg-[#dcfce7] border-[#86efac]",
        copy: "Skarbonka jest już pełna. Możesz zostawić ją w historii albo założyć kolejny cel.",
      };
    case "ahead":
      return {
        badge: "Wyprzedzasz plan",
        tone: "text-[#2d8d56]",
        bg: "bg-[#ecfdf3] border-[#bbf7d0]",
        copy: "Obecne tempo wygląda lepiej niż plan potrzebny do terminu. Wystarczy utrzymać rytm.",
      };
    case "behind":
      return {
        badge: "Tempo za wolne",
        tone: "text-[#d1632a]",
        bg: "bg-[#fff7ed] border-[#fed7aa]",
        copy: "Przy obecnym tempie warto podbić odkładanie albo odciążyć jedną kategorię wydatków.",
      };
    case "idle":
      return {
        badge: "Brak wpłat w 30 dniach",
        tone: "text-[#8a7262]",
        bg: "bg-white/60 border-[#f2d6bf]",
        copy: "Ten cel jeszcze nie złapał rytmu. Zacznij od małej, powtarzalnej kwoty i zobacz efekt po miesiącu.",
      };
    default:
      return {
        badge: "Tempo stabilne",
        tone: "text-[#8a5a2d]",
        bg: "bg-[#fdf6ec] border-[#f2d6bf]",
        copy: "Cel idzie do przodu w regularnym tempie. Największy zysk da teraz konsekwencja.",
      };
  }
}

export function GoalsScreen({ householdId, currency }: Props) {
  const goals = useQuery(api.goals.listForHousehold, { householdId }) as GoalViewModel[] | undefined;
  const [showAdd, setShowAdd] = useState(false);

  const summary = useMemo(() => {
    if (!goals || goals.length === 0) return null;

    const activeGoals = goals.filter((goal) => goal.progressPct < 100);
    return {
      remainingTotal: activeGoals.reduce((total, goal) => total + goal.remainingAmount, 0),
      monthlyPace: activeGoals.reduce((total, goal) => total + goal.pace.projectedMonthlyAmount, 0),
      activePlans: activeGoals.length,
    };
  }, [goals]);

  return (
    <div className="space-y-6 pb-6">
      <ScreenHeader
        icon={<Target />}
        title="Skarbonki"
        subtitle="Cele oszczędnościowe"
        action={
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#cf833f] px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 hover:scale-105"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Zamknij" : "Nowy cel"}
          </button>
        }
      />

      {showAdd && (
        <div className="animate-in fade-in slide-in-from-top-4">
          <AddGoalCard householdId={householdId} onClose={() => setShowAdd(false)} currency={currency} />
        </div>
      )}

      {summary && (
        <AppCard padding="md" className="flex divide-x divide-[#f2d6bf]">
          {[
            { label: "Do odłożenia", value: formatAmount(summary.remainingTotal, currency) },
            { label: "Tempo 30 dni", value: formatAmount(summary.monthlyPace, currency), sub: "na wszystkich skarbonkach" },
            { label: "Aktywne cele", value: summary.activePlans },
          ].map(({ label, value, sub }) => (
            <div key={label} className="flex-1 px-2 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-tight text-[#b89b87] min-h-[28px]">{label}</p>
              <div className="mt-auto">
                <p className="text-lg font-semibold text-[#2b180a]">{value}</p>
                {sub && <p className="mt-1 text-[10px] leading-tight font-medium text-[#8a7262]">{sub}</p>}
              </div>
            </div>
          ))}
        </AppCard>
      )}

      {goals === undefined ? (
        <Spinner className="py-12" />
      ) : goals.length === 0 ? (
        <AppCard padding="md" className="flex flex-col items-center py-10 text-center opacity-90">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#f5e5cf] bg-[#fcf4e4] shadow-sm">
            <PiggyBank className="h-8 w-8 text-[#ca782a]" strokeWidth={2.5} />
          </div>
          <h3 className="mb-2 text-lg font-medium text-[#3e2815]">Brak celów</h3>
          <p className="text-sm font-bold text-[#8a7262]">
            Dodaj swój pierwszy cel oszczędnościowy, np. na wakacje lub samochód.
          </p>
        </AppCard>
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

function AddGoalCard({
  householdId,
  onClose,
  currency,
}: {
  householdId: Id<"households">;
  onClose: () => void;
  currency: string;
}) {
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
          <label className="mb-1.5 ml-1 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">
            Nazwa
          </label>
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
            <label className="mb-1.5 ml-1 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">
              Cel ({currency})
            </label>
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
            <label className="mb-1.5 ml-1 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">
              Do kiedy? (opc.)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-[#2b180a] shadow-inner outline-none focus:border-[#cf833f]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 ml-1 block text-[11px] font-bold uppercase tracking-wider text-[#b89b87]">
            Ikona
          </label>
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
  goal: GoalViewModel;
  currency: string;
  householdId: Id<"households">;
}) {
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const addFunds = useMutation(api.goals.addFunds);
  const removeGoal = useMutation(api.goals.remove);

  const pct = Math.min(goal.progressPct || (goal.currentAmount / goal.targetAmount) * 100, 100);
  const isCompleted = pct >= 100;
  const paceMeta = getPaceMeta(goal);

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
    <div className="group relative overflow-hidden rounded-xl border border-[#f5e5cf]/80 bg-white/40 p-3.5 shadow-[0_4px_24px_rgba(180,120,80,0.1)] backdrop-blur-xl sm:p-4">
      {isCompleted && (
        <div className="absolute right-0 top-0 z-10 rounded-bl-xl bg-[#4aad6f] px-3 py-1 text-[9px] font-medium uppercase tracking-wider text-white shadow-sm">
          Osiągnięto
        </div>
      )}

      <IconTrashButton
        onClick={() => setShowDeleteModal(true)}
        title="Usuń cel"
        className="pointer-events-auto absolute right-2 top-2 z-30 h-8 w-8 bg-white/80 shadow-sm"
      />

      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-inner sm:h-14 sm:w-14 ${
            isCompleted ? "border-[#4aad6f] bg-[#dcfce7]" : "border-[#cf833f]/30 bg-[#fcf4e4]"
          }`}
        >
          <DynamicIcon
            name={goal.icon}
            className={`h-6 w-6 sm:h-7 sm:w-7 ${isCompleted ? "text-[#4aad6f]" : "text-[#cf833f]"}`}
          />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <h4 className="truncate text-[14px] font-medium text-[#2b180a] sm:text-[15px]">
            {goal.name}
          </h4>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <span
              className={`text-[16px] font-bold leading-none sm:text-[17px] ${
                isCompleted ? "text-[#4aad6f]" : "text-[#2b180a]"
              }`}
            >
              {formatAmount(goal.currentAmount, currency)}
            </span>
            <span className="text-[11px] font-bold leading-none text-[#b89b87]">
              z {formatAmount(goal.targetAmount, currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-[#f5e5cf] shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isCompleted
                ? "bg-gradient-to-r from-[#67c48a] to-[#4aad6f]"
                : "bg-gradient-to-r from-[#de9241] to-[#ca782a]"
            }`}
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
          <span className="text-[11px] font-bold text-[#cf833f]">{pct.toFixed(1)}%</span>
          {!isCompleted && goal.deadline && (
            <span className="text-[10px] font-bold text-[#b89b87]">
              Cel do: {new Date(goal.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className={`relative z-10 mt-3 rounded-xl border px-3 py-2.5 ${paceMeta.bg}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className={`h-4 w-4 ${paceMeta.tone}`} />
            <span className={`text-xs font-bold uppercase tracking-[0.14em] ${paceMeta.tone}`}>
              {paceMeta.badge}
            </span>
          </div>
          {goal.pace.trendPct !== 0 && (
            <span className="text-[11px] font-bold text-[#8a7262]">
              {goal.pace.trendPct > 0 ? "+" : ""}
              {Math.round(goal.pace.trendPct)}% vs poprzednie 14 dni
            </span>
          )}
        </div>
        <p className="mt-2 text-xs font-medium leading-relaxed text-[#6d4d38]">{paceMeta.copy}</p>
      </div>

      {!isCompleted && (() => {
  const thirdValue = goal.plan.mode === "deadline"
    ? { main: `${formatAmount(goal.plan.targetDailyAmount, currency)} dziennie`, sub: goal.plan.deadlineDaysLeft !== null ? `${goal.plan.deadlineDaysLeft} dni do terminu` : "bez terminu" }
    : { main: formatShortDate(goal.pace.projectedCompletionDate), sub: "bazując na obecnym tempie" };

  return (
    <div className="relative z-10 mt-3 overflow-hidden rounded-xl border border-[#f2dfcb] bg-white/60 flex divide-x divide-[#f2dfcb]">
      {[
        { icon: PiggyBank, label: "Do celu", main: formatAmount(goal.remainingAmount, currency) },
        { icon: TrendingUp, label: "Tempo 30 dni", main: formatAmount(goal.pace.projectedMonthlyAmount, currency), sub: `${formatAmount(goal.pace.averageDailyAmount, currency)} dziennie` },
        { icon: CalendarDays, label: goal.plan.mode === "deadline" ? "Plan do terminu" : "Szacowany finisz", ...thirdValue },
      ].map(({ icon: Icon, label, main, sub }) => (
        <div key={label} className="flex-1 px-2 py-2.5 flex flex-col">
          <div className="flex items-start gap-1.5 text-[#8a7262] min-h-[32px]">
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] leading-tight">{label}</span>
          </div>
          <div className="mt-auto">
            <p className="text-[13px] font-semibold text-[#2b180a]">{main}</p>
            {sub && <p className="mt-1 text-[10px] leading-tight font-medium text-[#8a7262]">{sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
})()}

      {!isCompleted && goal.actionPlan.length > 0 && (
        <div className="relative z-10 mt-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#cf833f]" />
            <h5 className="text-sm font-semibold text-[#2b180a]">Plan działania</h5>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#f2dfcb] bg-white/60">
            {goal.actionPlan.map((action, index) => (
              <div
                key={`${action.kind}-${index}`}
                className={`${index > 0 ? "border-t border-[#f2dfcb]" : ""} px-3 py-2.5`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#2b180a]">{action.title}</p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-[#6d4d38]">
                      {action.body}
                    </p>
                    {action.daysFaster !== null && action.daysFaster > 0 && (
                      <p className="mt-2 text-[11px] font-bold text-[#cf833f]">
                        około {action.daysFaster} dni szybciej
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#2b180a]">
                      {formatAmount(action.amount, currency)}
                    </p>
                    <p className="text-[11px] font-medium text-[#8a7262]">
                      {periodLabel(action.period)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCompleted && goal.recentContributions.length > 0 && (
        <div className="relative z-10 mt-3">
          <div className="mb-2 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-[#8a7262]" />
            <h5 className="text-sm font-semibold text-[#2b180a]">Ostatnie wpłaty</h5>
          </div>
          <div className="flex flex-wrap gap-2">
            {goal.recentContributions.map((contribution) => (
              <div
                key={contribution._id}
                className="rounded-full border border-[#f2dfcb] bg-[#fff8f2] px-3 py-1.5 text-[11px] font-medium text-[#6d4d38]"
              >
                <span className="font-semibold text-[#2b180a]">
                  {formatAmount(contribution.amount, currency)}
                </span>
                <span className="ml-2 text-[#8a7262]">
                  {new Date(contribution.createdAt).toLocaleDateString("pl-PL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCompleted && !showAddFunds && (
        <button
          onClick={() => setShowAddFunds(true)}
          className="mt-3 w-full rounded-xl border border-[#f5e5cf] bg-white/60 py-2 text-xs font-medium text-[#cf833f] shadow-sm transition-all hover:bg-white"
        >
          Odkładasz z bieżącej wypłaty? Wpłać do skarbonki
        </button>
      )}

      {showAddFunds && (
        <form
          onSubmit={handleAddFunds}
          className="animate-in fade-in slide-in-from-top-2 mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center"
        >
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

      {isCompleted && (
        <div className="relative z-10 mt-4 flex items-center gap-2 rounded-xl border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-3 text-sm font-medium text-[#2d8d56]">
          <CheckCircle2 className="h-4 w-4" />
          Ten cel jest już domknięty. Możesz zacząć kolejny albo zostawić go jako sukces w historii.
        </div>
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

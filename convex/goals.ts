import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GOAL_HORIZON_DAYS = 180;
const GOAL_PACE_WINDOW_DAYS = 30;
const GOAL_TREND_WINDOW_DAYS = 14;
const MAX_RECENT_CONTRIBUTIONS = 4;

type ActionCandidate = {
  categoryName: string;
  monthlySpend: number;
  reductionPct: number;
  monthlyImpact: number;
  kind: "category_cut" | "subscription_trim";
  priority: number;
};

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

function normalizeText(value: string) {
  return value.toLowerCase();
}

function categoryFlexibilityScore(categoryName: string, isSubscription = false) {
  const name = normalizeText(categoryName);
  let score = isSubscription ? 6 : 0;

  const highLeverageKeywords = [
    "restaur",
    "kawiar",
    "fast food",
    "pizza",
    "sushi",
    "dostaw",
    "stream",
    "subsk",
    "rozryw",
    "hobby",
    "ubran",
    "obuw",
    "online",
    "marketplace",
    "taxi",
    "uber",
    "alkoh",
    "kawa",
  ];
  const neutralKeywords = ["żywno", "ywn", "napoj", "transport", "zakupy"];
  const fixedCostKeywords = [
    "czynsz",
    "prąd",
    "gaz",
    "woda",
    "internet",
    "telefon",
    "ubezpiec",
    "kredyt",
    "pożycz",
    "dom i mieszkanie",
    "zdrow",
    "apteka",
    "lekarz",
    "dentyst",
  ];

  if (highLeverageKeywords.some((keyword) => name.includes(keyword))) score += 4;
  if (neutralKeywords.some((keyword) => name.includes(keyword))) score += 1;
  if (fixedCostKeywords.some((keyword) => name.includes(keyword))) score -= 6;

  return score;
}

function toRoundedAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const rounded = Math.round(amount / 100) * 100;
  return rounded > 0 ? rounded : Math.round(amount);
}

function getDaysBetween(fromMs: number, toMs: number) {
  return Math.max(0, Math.ceil((toMs - fromMs) / DAY_MS));
}

function getProjectedCompletionDate(now: number, remainingAmount: number, averageDailyAmount: number) {
  if (!(remainingAmount > 0) || !(averageDailyAmount > 0)) return null;
  return now + Math.ceil(remainingAmount / averageDailyAmount) * DAY_MS;
}

function buildActionCandidates(
  expenseSummaries: Array<{ categoryName: string; total: number; isSubscription: boolean }>
) {
  return expenseSummaries
    .map((summary) => {
      const reductionPct = summary.isSubscription ? 100 : summary.total >= 30_000 ? 20 : 15;
      const monthlyImpact = Math.round(summary.total * (reductionPct / 100));
      const priority = categoryFlexibilityScore(summary.categoryName, summary.isSubscription) * 10 + summary.total / 1000;
      return {
        categoryName: summary.categoryName,
        monthlySpend: summary.total,
        reductionPct,
        monthlyImpact,
        kind: summary.isSubscription ? "subscription_trim" : "category_cut",
        priority,
      } satisfies ActionCandidate;
    })
    .filter((candidate) => candidate.monthlyImpact >= 500)
    .sort((a, b) => b.priority - a.priority || b.monthlyImpact - a.monthlyImpact);
}

function buildGoalActionPlan(args: {
  remainingAmount: number;
  targetDailyAmount: number;
  targetWeeklyAmount: number;
  targetMonthlyAmount: number;
  projectedCompletionDate: number | null;
  actionCandidates: ActionCandidate[];
  currentDailyAmount: number;
  goalHasDeadline: boolean;
  now: number;
}) {
  const {
    remainingAmount,
    targetDailyAmount,
    targetWeeklyAmount,
    targetMonthlyAmount,
    projectedCompletionDate,
    actionCandidates,
    currentDailyAmount,
    goalHasDeadline,
    now,
  } = args;

  if (!(remainingAmount > 0)) {
    return [];
  }

  const boostedDailyAmount = currentDailyAmount > 0
    ? Math.max(targetDailyAmount, currentDailyAmount * 1.15)
    : targetDailyAmount;

  const actions: GoalActionPlanItem[] = [
    {
      kind: "daily_target",
      title: goalHasDeadline ? "Plan dzienny" : "Stały rytm odkładania",
      body: goalHasDeadline
        ? "Taki dzienny rytm dowiezie cel bez zostawiania wszystkiego na końcówkę."
        : "Mała, stała kwota każdego dnia zwykle działa lepiej niż pojedyncze zrywy raz na jakiś czas.",
      amount: toRoundedAmount(targetDailyAmount),
      period: "day" as const,
      monthlyImpact: toRoundedAmount(targetMonthlyAmount),
      daysFaster: null,
      projectedCompletionDate: projectedCompletionDate ?? (boostedDailyAmount > 0 ? now + Math.ceil(remainingAmount / boostedDailyAmount) * DAY_MS : null),
      sourceCategoryName: null,
      reductionPct: null,
    },
    {
      kind: "weekly_target",
      title: goalHasDeadline ? "Plan tygodniowy" : "Jedna większa rata tygodniowo",
      body: goalHasDeadline
        ? "Jeśli wygodniej odkładasz raz w tygodniu, trzymaj właśnie taki próg."
        : "To dobry wariant, jeśli wolisz większą wpłatę po wypłacie albo pod koniec tygodnia.",
      amount: toRoundedAmount(targetWeeklyAmount),
      period: "week" as const,
      monthlyImpact: toRoundedAmount(targetMonthlyAmount),
      daysFaster: null,
      projectedCompletionDate: projectedCompletionDate,
      sourceCategoryName: null,
      reductionPct: null,
    },
  ];

  for (const candidate of actionCandidates) {
    if (actions.length >= 4) break;
    const boostedDaily = currentDailyAmount + candidate.monthlyImpact / 30;
    const fasterDate = getProjectedCompletionDate(now, remainingAmount, boostedDaily);
    const daysFaster = projectedCompletionDate && fasterDate
      ? Math.max(0, Math.round((projectedCompletionDate - fasterDate) / DAY_MS))
      : null;

    actions.push({
      kind: candidate.kind,
      title:
        candidate.kind === "subscription_trim"
          ? "Odetnij jedną stałą opłatę"
          : `Ogranicz ${candidate.categoryName} o ${candidate.reductionPct}%`,
      body:
        candidate.kind === "subscription_trim"
          ? "Stałe koszty są najłatwiejsze do zamiany w automatyczne oszczędzanie, bo działają co miesiąc."
          : "To jedna z kategorii, która może realnie przyspieszyć cel bez rozbijania planu na drobne.",
      amount: toRoundedAmount(candidate.monthlyImpact),
      period: "month" as const,
      monthlyImpact: toRoundedAmount(candidate.monthlyImpact),
      daysFaster,
      projectedCompletionDate: fasterDate,
      sourceCategoryName: candidate.categoryName,
      reductionPct: candidate.reductionPct,
    });
  }

  return actions.slice(0, 4);
}

export const listForHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const now = Date.now();
    const paceWindowStart = now - GOAL_PACE_WINDOW_DAYS * DAY_MS;
    const trendWindowStart = now - GOAL_TREND_WINDOW_DAYS * DAY_MS;
    const previousTrendWindowStart = trendWindowStart - GOAL_TREND_WINDOW_DAYS * DAY_MS;

    const [goals, recentContributions, recentExpenses] = await Promise.all([
      ctx.db
        .query("goals")
        .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
        .order("desc")
        .collect(),
      ctx.db
        .query("goal_contributions")
        .withIndex("by_household_and_createdAt", (q) =>
          q.eq("householdId", args.householdId).gte("createdAt", previousTrendWindowStart)
        )
        .collect(),
      ctx.db
        .query("expenses")
        .withIndex("by_household_and_date", (q) =>
          q.eq("householdId", args.householdId).gte("date", paceWindowStart)
        )
        .collect(),
    ]);

    const categoryCache = new Map<string, string>();
    const expenseSummary = new Map<string, { categoryName: string; total: number; isSubscription: boolean }>();
    for (const expense of recentExpenses) {
      let categoryName = categoryCache.get(expense.categoryId as string);
      if (!categoryName) {
        const category = await ctx.db.get(expense.categoryId);
        categoryName = category?.name ?? "Inne";
        categoryCache.set(expense.categoryId as string, categoryName);
      }

      const key = `${categoryName}_${expense.isSubscription ? "subscription" : "category"}`;
      const current = expenseSummary.get(key) ?? {
        categoryName,
        total: 0,
        isSubscription: Boolean(expense.isSubscription),
      };
      current.total += expense.amount;
      current.isSubscription = current.isSubscription || Boolean(expense.isSubscription);
      expenseSummary.set(key, current);
    }

    const actionCandidates = buildActionCandidates(Array.from(expenseSummary.values()));

    const contributionsByGoal = new Map<string, typeof recentContributions>();
    for (const contribution of recentContributions) {
      const list = contributionsByGoal.get(contribution.goalId as string) ?? [];
      list.push(contribution);
      contributionsByGoal.set(contribution.goalId as string, list);
    }

    return goals.map((goal) => {
      const contributions = (contributionsByGoal.get(goal._id as string) ?? [])
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt);

      const last30DaysAmount = contributions
        .filter((item) => item.createdAt >= paceWindowStart)
        .reduce((sum, item) => sum + item.amount, 0);
      const last14DaysAmount = contributions
        .filter((item) => item.createdAt >= trendWindowStart)
        .reduce((sum, item) => sum + item.amount, 0);
      const previous14DaysAmount = contributions
        .filter((item) => item.createdAt >= previousTrendWindowStart && item.createdAt < trendWindowStart)
        .reduce((sum, item) => sum + item.amount, 0);

      const averageDailyAmount = last30DaysAmount / GOAL_PACE_WINDOW_DAYS;
      const averageWeeklyAmount = averageDailyAmount * 7;
      const projectedMonthlyAmount = averageDailyAmount * 30;
      const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
      const progressPct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;

      const deadlineDaysLeft = goal.deadline ? getDaysBetween(now, goal.deadline) : null;
      const planningDays = goal.deadline
        ? Math.max(deadlineDaysLeft ?? 0, 1)
        : Math.max(
            DEFAULT_GOAL_HORIZON_DAYS,
            averageDailyAmount > 0 ? Math.min(DEFAULT_GOAL_HORIZON_DAYS * 2, Math.ceil(remainingAmount / averageDailyAmount)) : DEFAULT_GOAL_HORIZON_DAYS
          );

      const targetDailyAmount = remainingAmount > 0 ? remainingAmount / planningDays : 0;
      const targetWeeklyAmount = targetDailyAmount * 7;
      const targetMonthlyAmount = targetDailyAmount * 30;
      const projectedCompletionDate = getProjectedCompletionDate(now, remainingAmount, averageDailyAmount);

      const paceStatus =
        remainingAmount <= 0
          ? "completed"
          : averageDailyAmount <= 0
            ? "idle"
            : goal.deadline && averageDailyAmount < targetDailyAmount * 0.9
              ? "behind"
              : goal.deadline && averageDailyAmount > targetDailyAmount * 1.1
                ? "ahead"
                : "on_track";

      const trendPct = previous14DaysAmount > 0
        ? ((last14DaysAmount - previous14DaysAmount) / previous14DaysAmount) * 100
        : last14DaysAmount > 0
          ? 100
          : 0;

      return {
        ...goal,
        remainingAmount,
        progressPct,
        pace: {
          status: paceStatus,
          last30DaysAmount,
          last14DaysAmount,
          previous14DaysAmount,
          averageDailyAmount,
          averageWeeklyAmount,
          projectedMonthlyAmount,
          projectedCompletionDate,
          trendPct,
        },
        plan: {
          mode: goal.deadline ? "deadline" : "smart",
          deadlineDaysLeft,
          targetDailyAmount,
          targetWeeklyAmount,
          targetMonthlyAmount,
          isBehind: paceStatus === "behind",
        },
        recentContributions: contributions
          .slice(0, MAX_RECENT_CONTRIBUTIONS)
          .map((item) => ({
            _id: item._id,
            amount: item.amount,
            createdAt: item.createdAt,
          })),
        actionPlan: buildGoalActionPlan({
          remainingAmount,
          targetDailyAmount,
          targetWeeklyAmount,
          targetMonthlyAmount,
          projectedCompletionDate,
          actionCandidates,
          currentDailyAmount: averageDailyAmount,
          goalHasDeadline: Boolean(goal.deadline),
          now,
        }),
      };
    });
  },
});

export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    targetAmount: v.number(),
    icon: v.string(),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db.insert("goals", {
      ...args,
      currentAmount: 0,
      createdAt: Date.now(),
    });
  },
});

export const addFunds = mutation({
  args: {
    householdId: v.id("households"),
    goalId: v.id("goals"),
    amount: v.number(), // cents
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.householdId !== args.householdId) throw new Error("Unauthorized");

    let newAmount = goal.currentAmount + args.amount;
    if (newAmount < 0) newAmount = 0;
    if (newAmount > goal.targetAmount) newAmount = goal.targetAmount;

    const actualDelta = newAmount - goal.currentAmount;

    await ctx.db.patch(args.goalId, { currentAmount: newAmount });

    if (actualDelta !== 0) {
      await ctx.db.insert("goal_contributions", {
        householdId: args.householdId,
        goalId: args.goalId,
        userId,
        amount: actualDelta,
        createdAt: Date.now(),
      });
    }
  },
});

export const remove = mutation({
  args: {
    householdId: v.id("households"),
    goalId: v.id("goals"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found");
    if (goal.householdId !== args.householdId) throw new Error("Unauthorized");

    const contributions = await ctx.db
      .query("goal_contributions")
      .withIndex("by_goal", (q) => q.eq("goalId", args.goalId))
      .collect();

    for (const contribution of contributions) {
      await ctx.db.delete(contribution._id);
    }

    await ctx.db.delete(args.goalId);
  },
});

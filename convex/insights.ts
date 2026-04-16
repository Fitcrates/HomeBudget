import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import { internal } from "./_generated/api";

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value: string) {
  return value.toLowerCase();
}

function scenarioCategoryPriority(name: string, isSubscription = false) {
  const normalized = normalizeText(name);
  let score = isSubscription ? 10 : 0;

  const highValue = [
    "restaur",
    "kawiar",
    "fast food",
    "pizza",
    "sushi",
    "dostaw",
    "rozryw",
    "stream",
    "subsk",
    "ubran",
    "obuw",
    "online",
    "marketplace",
    "taxi",
    "uber",
    "alkoh",
    "żywno",
    "ywn",
    "napoj",
    "kawa",
  ];
  const lowerValue = [
    "czynsz",
    "prąd",
    "gaz",
    "woda",
    "internet",
    "telefon",
    "ubezpiec",
    "kredyt",
    "pożycz",
    "zdrow",
    "apteka",
    "lekarz",
    "dentyst",
  ];

  if (highValue.some((keyword) => normalized.includes(keyword))) score += 5;
  if (lowerValue.some((keyword) => normalized.includes(keyword))) score -= 8;

  return score;
}

async function loadExpenseRows(ctx: any, householdId: any) {
  const threeMonthsAgo = Date.now() - 90 * DAY_MS;
  const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_household_and_date", (q: any) =>
      q.eq("householdId", householdId).gte("date", threeMonthsAgo)
    )
    .collect();

  const categoryCache = new Map<string, { name: string; icon: string; color: string }>();
  const monthlySummary: Record<string, { categoryName: string; month: string; total: number }> = {};

  for (const expense of expenses) {
    let category = categoryCache.get(expense.categoryId as string);
    if (!category) {
      const loaded = await ctx.db.get(expense.categoryId);
      category = {
        name: loaded?.name ?? "Nieznana",
        icon: loaded?.icon ?? "LayoutList",
        color: loaded?.color ?? "#B89B87",
      };
      categoryCache.set(expense.categoryId as string, category);
    }

    const d = new Date(expense.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const key = `${expense.categoryId}_${month}`;
    if (!monthlySummary[key]) {
      monthlySummary[key] = { categoryName: category.name, month, total: 0 };
    }
    monthlySummary[key].total += expense.amount;
  }

  return Object.values(monthlySummary).map((summary) => ({
    ...summary,
    total: summary.total / 100,
  }));
}

async function loadBudgetRows(ctx: any, householdId: any) {
  const budgets = await ctx.db
    .query("category_budgets")
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .collect();

  return Promise.all(
    budgets.map(async (budget: { categoryId: any; limitAmount: number; period: string }) => {
      const category = await ctx.db.get(budget.categoryId);
      return {
        categoryName: category?.name ?? "Nieznana",
        limitAmount: budget.limitAmount / 100,
        period: budget.period,
      };
    })
  );
}

async function buildScenarioContext(ctx: any, householdId: any) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const previousMonthEnd = currentMonthStart - 1;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_household_and_date", (q: any) =>
      q.eq("householdId", householdId).gte("date", previousMonthStart)
    )
    .collect();

  const currentMonth = expenses.filter((expense: any) => expense.date >= currentMonthStart);
  const previousMonth = expenses.filter(
    (expense: any) => expense.date >= previousMonthStart && expense.date <= previousMonthEnd
  );

  const categoryCache = new Map<string, { name: string; icon: string; color: string }>();
  const categories = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      icon: string;
      color: string;
      currentMonthSpent: number;
      projectedMonthSpent: number;
      isSubscriptionCategory: boolean;
      priority: number;
    }
  >();

  const projectedMultiplier = daysInMonth / Math.max(dayOfMonth, 1);
  let currentMonthSpent = 0;
  let previousMonthSpent = 0;
  let subscriptionProjectedMonthly = 0;

  for (const expense of currentMonth) {
    currentMonthSpent += expense.amount;
    if (expense.isSubscription) {
      subscriptionProjectedMonthly += Math.round(expense.amount * projectedMultiplier);
    }

    let category = categoryCache.get(expense.categoryId as string);
    if (!category) {
      const loaded = await ctx.db.get(expense.categoryId);
      category = {
        name: loaded?.name ?? "Nieznana",
        icon: loaded?.icon ?? "LayoutList",
        color: loaded?.color ?? "#B89B87",
      };
      categoryCache.set(expense.categoryId as string, category);
    }

    const current = categories.get(expense.categoryId as string) ?? {
      categoryId: expense.categoryId as string,
      categoryName: category.name,
      icon: category.icon,
      color: category.color,
      currentMonthSpent: 0,
      projectedMonthSpent: 0,
      isSubscriptionCategory: false,
      priority: 0,
    };

    current.currentMonthSpent += expense.amount;
    current.projectedMonthSpent = Math.round(current.currentMonthSpent * projectedMultiplier);
    current.isSubscriptionCategory = current.isSubscriptionCategory || Boolean(expense.isSubscription);
    current.priority =
      scenarioCategoryPriority(current.categoryName, current.isSubscriptionCategory) * 10 +
      current.projectedMonthSpent / 1000;
    categories.set(expense.categoryId as string, current);
  }

  for (const expense of previousMonth) {
    previousMonthSpent += expense.amount;
  }

  const sortedCategories = Array.from(categories.values())
    .filter((category) => category.projectedMonthSpent >= 1000)
    .sort((a, b) => b.priority - a.priority || b.projectedMonthSpent - a.projectedMonthSpent);

  const suggestedScenarios = sortedCategories.slice(0, 3).map((category, index) => {
    const reductionPct = index === 0 ? 20 : 15;
    const monthlyImpact = Math.round(category.projectedMonthSpent * (reductionPct / 100));
    return {
      id: `${category.categoryId}-${reductionPct}`,
      label: `${category.categoryName} -${reductionPct}%`,
      type: "reduce_category" as const,
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      reductionPct,
      monthlyImpact,
      projectedMonthSpent: Math.max(0, currentMonthSpent - monthlyImpact),
    };
  });

  return {
    dayOfMonth,
    daysInMonth,
    currentMonthSpent,
    projectedMonthSpent: Math.round(currentMonthSpent * projectedMultiplier),
    previousMonthSpent,
    subscriptionProjectedMonthly,
    categories: sortedCategories.slice(0, 6),
    suggestedScenarios,
  };
}

export const getLatest = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const rows = await ctx.db
      .query("ai_insights")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .take(1);

    return rows[0] ?? null;
  },
});

export const getWhatIfOverview = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);
    return buildScenarioContext(ctx, args.householdId);
  },
});

export const generate = action({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [expenses, budgets, scenarioContext] = await Promise.all([
      ctx.runQuery(internal.insights.loadExpenseData, {
        householdId: args.householdId,
      }),
      ctx.runQuery(internal.insights.loadBudgetData, {
        householdId: args.householdId,
      }),
      ctx.runQuery(internal.insights.loadScenarioContext, {
        householdId: args.householdId,
      }),
    ]);

    const dataHash = btoa(
      JSON.stringify({
        count: expenses.length,
        total: expenses.reduce((sum, expense) => sum + expense.total, 0),
        projectedMonthSpent: scenarioContext.projectedMonthSpent,
      })
    ).slice(0, 32);

    const insights: Array<{
      type: string;
      title: string;
      body: string;
      emoji: string;
      severity: "info" | "warning" | "danger";
    }> = await ctx.runAction(internal.insightsNode.callAI, {
      expenses,
      budgets,
      scenarioContext: {
        currentMonthSpent: scenarioContext.currentMonthSpent / 100,
        projectedMonthSpent: scenarioContext.projectedMonthSpent / 100,
        previousMonthSpent: scenarioContext.previousMonthSpent / 100,
        subscriptionProjectedMonthly: scenarioContext.subscriptionProjectedMonthly / 100,
        categories: scenarioContext.categories.map((category) => ({
          categoryName: category.categoryName,
          projectedMonthSpent: category.projectedMonthSpent / 100,
          currentMonthSpent: category.currentMonthSpent / 100,
          isSubscriptionCategory: category.isSubscriptionCategory,
        })),
        suggestedScenarios: scenarioContext.suggestedScenarios.map((scenario) => ({
          label: scenario.label,
          type: scenario.type,
          categoryName: scenario.categoryName,
          reductionPct: scenario.reductionPct,
          monthlyImpact: scenario.monthlyImpact / 100,
          projectedMonthSpent: scenario.projectedMonthSpent / 100,
        })),
      },
    });

    await ctx.runMutation(internal.insights.saveInsights, {
      householdId: args.householdId,
      insights,
      dataHash,
    });

    return insights;
  },
});

export const loadExpenseData = internalQuery({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    return loadExpenseRows(ctx, args.householdId);
  },
});

export const loadBudgetData = internalQuery({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    return loadBudgetRows(ctx, args.householdId);
  },
});

export const loadScenarioContext = internalQuery({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    return buildScenarioContext(ctx, args.householdId);
  },
});

export const saveInsights = internalMutation({
  args: {
    householdId: v.id("households"),
    insights: v.array(
      v.object({
        type: v.string(),
        title: v.string(),
        body: v.string(),
        emoji: v.string(),
        severity: v.union(v.literal("info"), v.literal("warning"), v.literal("danger")),
      })
    ),
    dataHash: v.string(),
  },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("ai_insights")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    for (const row of old) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.insert("ai_insights", {
      householdId: args.householdId,
      generatedAt: Date.now(),
      insights: args.insights,
      dataHash: args.dataHash,
    });
  },
});

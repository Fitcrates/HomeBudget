import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember, getEffectiveFinancialRole } from "./households";
import { getBudgetPeriodRange } from "./budgets";

function getMonthRange(dateMs: number) {
  const date = new Date(dateMs);
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
  };
}

function getExpenseTransactionKey(expense: {
  _id: string;
  userId: string;
  date: number;
  receiptImageId?: string | null;
  ocrRawText?: string | null;
}) {
  if (expense.receiptImageId) {
    return `receipt:${expense.receiptImageId}`;
  }

  if (expense.ocrRawText) {
    const dayKey = new Date(expense.date).toISOString().split("T")[0];
    return `ocr:${expense.userId}:${dayKey}:${expense.ocrRawText}`;
  }

  return `manual:${expense._id}`;
}

function countTransactions(
  expenses: Array<{
    _id: string;
    userId: string;
    date: number;
    receiptImageId?: string | null;
    ocrRawText?: string | null;
  }>
) {
  return new Set(expenses.map(getExpenseTransactionKey)).size;
}

export const summary = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    return { total, count: countTransactions(filtered as any) };
  },
});

export const totalsPerPeriod = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
    granularity: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const buckets: Record<string, number> = {};
    for (const e of filtered) {
      const d = new Date(e.date);
      let key: string;
      if (args.granularity === "day") {
        key = d.toISOString().split("T")[0];
      } else if (args.granularity === "week") {
        const s = new Date(d);
        s.setDate(d.getDate() - d.getDay());
        key = s.toISOString().split("T")[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      buckets[key] = (buckets[key] ?? 0) + e.amount;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, total]) => ({ period, total }));
  },
});

export const totalsPerCategory = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const byCategory: Record<string, { total: number; name: string; color: string; icon: string }> = {};
    for (const e of filtered) {
      const cat = await ctx.db.get(e.categoryId);
      if (!cat) continue;
      if (!byCategory[e.categoryId]) {
        byCategory[e.categoryId] = { total: 0, name: cat.name, color: cat.color, icon: cat.icon };
      }
      byCategory[e.categoryId].total += e.amount;
    }

    return Object.entries(byCategory).map(([id, data]) => ({ id, ...data }));
  },
});

export const totalsPerSubcategory = query({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_category", (q) =>
        q.eq("householdId", args.householdId).eq("categoryId", args.categoryId)
      )
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const bySubcategory: Record<string, { total: number; name: string; icon: string }> = {};
    for (const e of filtered) {
      const sub = await ctx.db.get(e.subcategoryId);
      if (!sub) continue;
      if (!bySubcategory[e.subcategoryId]) {
        bySubcategory[e.subcategoryId] = { total: 0, name: sub.name, icon: sub.icon };
      }
      bySubcategory[e.subcategoryId].total += e.amount;
    }

    return Object.entries(bySubcategory).map(([id, data]) => ({ id, ...data }));
  },
});

export const householdMemberStats = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    return Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const profile = await ctx.db
          .query("user_profiles")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .unique();

        const avatarUrl = profile?.avatarImageId
          ? await ctx.storage.getUrl(profile.avatarImageId)
          : null;

        const userExpenses = allExpenses.filter((e) => e.userId === m.userId);
        
        const manualExpensesList = userExpenses.filter((e) => !e.ocrRawText && !e.receiptImageId);
        const ocrExpensesList = userExpenses.filter((e) => !!e.ocrRawText || !!e.receiptImageId);

        const seenScans = new Set<string>();
        for (const e of ocrExpensesList) {
          const key = e.receiptImageId || (e.ocrRawText ? e.ocrRawText + "_" + e.date : e._id);
          seenScans.add(key as string);
        }

        const ocrExpenses = seenScans.size;
        const manualExpenses = manualExpensesList.length;
        const totalExpenses = manualExpenses + ocrExpenses;
        const totalAmount = userExpenses.reduce((sum, e) => sum + e.amount, 0);

        const daySet = new Set(
          userExpenses.map((e) => new Date(e.date).toISOString().split("T")[0])
        );
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          if (daySet.has(key)) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }

        return {
          userId: m.userId,
          role: m.role,
          financialRole: getEffectiveFinancialRole(m as any),
          displayName:
            profile?.displayName || user?.name || user?.email?.split("@")[0] || "Nieznany",
          email: user?.email || "",
          avatarUrl,
          totalExpenses,
          ocrExpenses,
          manualExpenses,
          totalAmount,
          streak,
        };
      })
    );
  },
});

export const memberBudgetOverview = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();
    const personBudgets = await ctx.db
      .query("person_budgets")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    const now = Date.now();
    const monthRange = getMonthRange(now);
    const earliestBudgetStart = personBudgets.reduce((earliest, budget) => {
      const start = getBudgetPeriodRange(budget.period, now).start;
      return Math.min(earliest, start);
    }, monthRange.start);

    const recentExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) =>
        q.eq("householdId", args.householdId)
          .gte("date", earliestBudgetStart)
          .lte("date", now)
      )
      .collect();

    return Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        const profile = await ctx.db
          .query("user_profiles")
          .withIndex("by_user", (q) => q.eq("userId", membership.userId))
          .unique();
        const avatarUrl = profile?.avatarImageId
          ? await ctx.storage.getUrl(profile.avatarImageId)
          : null;

        const monthlySpent = recentExpenses
          .filter((expense) =>
            expense.userId === membership.userId &&
            expense.date >= monthRange.start &&
            expense.date <= monthRange.end
          )
          .reduce((sum, expense) => sum + expense.amount, 0);

        const personalBudget = personBudgets.find((budget) => budget.userId === membership.userId) ?? null;
        const budgetRange = personalBudget ? getBudgetPeriodRange(personalBudget.period, now) : null;
        const personalBudgetSpent = personalBudget && budgetRange
          ? recentExpenses
              .filter((expense) =>
                expense.userId === membership.userId &&
                expense.date >= budgetRange.start &&
                expense.date <= budgetRange.end
              )
              .reduce((sum, expense) => sum + expense.amount, 0)
          : null;
        const personalBudgetRemaining =
          personalBudget && personalBudgetSpent !== null
            ? personalBudget.limitAmount - personalBudgetSpent
            : null;
        const personalBudgetPct =
          personalBudget && personalBudgetSpent !== null && personalBudget.limitAmount > 0
            ? (personalBudgetSpent / personalBudget.limitAmount) * 100
            : null;

        return {
          userId: membership.userId,
          accessRole: membership.role,
          financialRole: getEffectiveFinancialRole(membership as any),
          displayName:
            profile?.displayName || user?.name || user?.email?.split("@")[0] || "Nieznany",
          email: user?.email || "",
          avatarUrl,
          monthlySpent,
          personalBudget: personalBudget
            ? {
                limitAmount: personalBudget.limitAmount,
                period: personalBudget.period,
                updatedAt: personalBudget.updatedAt,
              }
            : null,
          personalBudgetSpent,
          personalBudgetRemaining,
          personalBudgetPct,
          isOverBudget: Boolean(
            personalBudget &&
              personalBudgetSpent !== null &&
              personalBudgetSpent > personalBudget.limitAmount
          ),
        };
      })
    ).then((items) => items.sort((a, b) => b.monthlySpent - a.monthlySpent));
  },
});

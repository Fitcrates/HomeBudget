import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assertCanManageFinancialRoles,
  assertCanManageSharedBudgets,
  assertMember,
  getEffectiveFinancialRole,
} from "./households";

export function getBudgetPeriodRange(period: "month" | "week", dateMs: number) {
  const date = new Date(dateMs);

  if (period === "week") {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(date.getDate() + diffToMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      start: start.getTime(),
      end: end.getTime(),
    };
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    start: start.getTime(),
    end: end.getTime(),
  };
}

export async function assertWithinPersonalBudgetLimit(
  ctx: any,
  args: {
    householdId: any;
    userId: any;
    date: number;
    amountDelta: number;
    excludeExpenseId?: any;
  }
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_household_and_user", (q: any) =>
      q.eq("householdId", args.householdId).eq("userId", args.userId)
    )
    .unique();

  if (!membership) {
    throw new Error("Nie znaleziono członkostwa w gospodarstwie.");
  }

  if (getEffectiveFinancialRole(membership) !== "child") {
    return;
  }

  const personalBudget = await ctx.db
    .query("person_budgets")
    .withIndex("by_household_and_user", (q: any) =>
      q.eq("householdId", args.householdId).eq("userId", args.userId)
    )
    .unique();

  if (!personalBudget) {
    return;
  }

  const periodRange = getBudgetPeriodRange(personalBudget.period, args.date);
  const expensesInPeriod = await ctx.db
    .query("expenses")
    .withIndex("by_household_user_date", (q: any) =>
      q.eq("householdId", args.householdId)
        .eq("userId", args.userId)
        .gte("date", periodRange.start)
        .lte("date", periodRange.end)
    )
    .collect();

  const currentSpent = expensesInPeriod.reduce((sum: number, expense: any) => {
    if (args.excludeExpenseId && String(expense._id) === String(args.excludeExpenseId)) {
      return sum;
    }
    return sum + expense.amount;
  }, 0);

  const nextSpent = currentSpent + args.amountDelta;
  if (nextSpent > personalBudget.limitAmount) {
    const remaining = Math.max(personalBudget.limitAmount - currentSpent, 0);
    throw new Error(
      `Przekroczysz osobisty limit wydatków. Pozostało ${(remaining / 100).toFixed(2)} w tym ${
        personalBudget.period === "month" ? "miesiącu" : "tygodniu"
      }.`
    );
  }
}

export const listForHousehold = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db
      .query("category_budgets")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    limitAmount: v.number(),
    period: v.union(v.literal("month"), v.literal("week")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertCanManageSharedBudgets(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("category_budgets")
      .withIndex("by_household_and_category", (q) =>
        q.eq("householdId", args.householdId).eq("categoryId", args.categoryId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        limitAmount: args.limitAmount,
        period: args.period,
      });
    } else {
      await ctx.db.insert("category_budgets", {
        householdId: args.householdId,
        categoryId: args.categoryId,
        limitAmount: args.limitAmount,
        period: args.period,
      });
    }
  },
});

export const remove = mutation({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertCanManageSharedBudgets(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("category_budgets")
      .withIndex("by_household_and_category", (q) =>
        q.eq("householdId", args.householdId).eq("categoryId", args.categoryId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listPersonBudgets = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db
      .query("person_budgets")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();
  },
});

export const upsertPersonBudget = mutation({
  args: {
    householdId: v.id("households"),
    targetUserId: v.id("users"),
    limitAmount: v.number(),
    period: v.union(v.literal("month"), v.literal("week")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertCanManageFinancialRoles(ctx, args.householdId, userId);
    await assertMember(ctx, args.householdId, args.targetUserId);

    const existing = await ctx.db
      .query("person_budgets")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", args.householdId).eq("userId", args.targetUserId)
      )
      .unique();

    const payload = {
      limitAmount: args.limitAmount,
      period: args.period,
      updatedAt: Date.now(),
      updatedByUserId: userId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("person_budgets", {
        householdId: args.householdId,
        userId: args.targetUserId,
        ...payload,
      });
    }
  },
});

export const removePersonBudget = mutation({
  args: {
    householdId: v.id("households"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertCanManageFinancialRoles(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("person_budgets")
      .withIndex("by_household_and_user", (q) =>
        q.eq("householdId", args.householdId).eq("userId", args.targetUserId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

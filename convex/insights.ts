import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import { internal } from "./_generated/api";

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

export const generate = action({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const expenses: Array<{ categoryName: string; month: string; total: number }> =
      await ctx.runQuery(internal.insights.loadExpenseData, {
        householdId: args.householdId,
      });
    const budgets: Array<{ categoryName: string; limitAmount: number; period: string }> =
      await ctx.runQuery(internal.insights.loadBudgetData, {
        householdId: args.householdId,
      });

    const dataHash = btoa(
      JSON.stringify({
        count: expenses.length,
        total: expenses.reduce((s, e) => s + e.total, 0),
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
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const recent = expenses.filter((e) => e.date >= threeMonthsAgo);

    const summary: Record<string, { categoryName: string; month: string; total: number }> = {};
    for (const e of recent) {
      const cat = await ctx.db.get(e.categoryId);
      const d = new Date(e.date);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const key = `${e.categoryId}_${month}`;
      if (!summary[key]) {
        summary[key] = { categoryName: cat?.name ?? "Nieznana", month, total: 0 };
      }
      summary[key].total += e.amount;
    }

    return Object.values(summary);
  },
});

export const loadBudgetData = internalQuery({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const budgets = await ctx.db
      .query("category_budgets")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    return Promise.all(
      budgets.map(async (b) => {
        const cat = await ctx.db.get(b.categoryId);
        return {
          categoryName: cat?.name ?? "Nieznana",
          limitAmount: b.limitAmount,
          period: b.period,
        };
      })
    );
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

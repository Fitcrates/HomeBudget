import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { DEFAULT_PROFILE_WINDOW_DAYS, DEFAULT_SEGMENT_TTL_MS } from "../types";
import { buildSpendingProfile, calculateSegments } from "./calculator";

async function replaceByHousehold(ctx: any, table: "household_spending_profiles" | "household_offer_segments", householdId: any) {
  const existing = await ctx.db
    .query(table)
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .collect();

  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
}

export const markHouseholdDirty = internalMutation({
  args: {
    householdId: v.id("households"),
    reason: v.string(),
    nextRunAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("household_segment_jobs")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .first();

    const patch = {
      status: "dirty" as const,
      reason: args.reason,
      nextRunAt: args.nextRunAt ?? now,
      error: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("household_segment_jobs", {
      householdId: args.householdId,
      ...patch,
    });
  },
});

export const loadDirtyHouseholds = internalQuery({
  args: {
    now: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("household_segment_jobs")
      .withIndex("by_status_next_run", (q) =>
        q.eq("status", "dirty").lte("nextRunAt", args.now)
      )
      .take(args.limit ?? 100);
  },
});

export const recalculateHousehold = internalMutation({
  args: {
    householdId: v.id("households"),
    windowDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowDays = args.windowDays ?? DEFAULT_PROFILE_WINDOW_DAYS;
    const from = now - windowDays * 24 * 60 * 60 * 1000;
    const household = await ctx.db.get(args.householdId);
    if (!household) throw new Error("Household not found");

    const job = await ctx.db
      .query("household_segment_jobs")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .first();
    if (job) {
      await ctx.db.patch(job._id, { status: "processing", updatedAt: now });
    }

    try {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_household_and_date", (q) =>
          q.eq("householdId", args.householdId).gte("date", from)
        )
        .collect();

      const categoryCache = new Map<string, string>();
      const expenseInputs = [];

      for (const expense of expenses) {
        let categoryName = categoryCache.get(expense.categoryId as string);
        if (!categoryName) {
          const category = await ctx.db.get(expense.categoryId);
          categoryName = category?.name ?? "Unknown";
          categoryCache.set(expense.categoryId as string, categoryName);
        }

        expenseInputs.push({
          amount: expense.amount,
          date: expense.date,
          categoryId: expense.categoryId,
          categoryName,
        });
      }

      const profile = buildSpendingProfile({
        householdId: args.householdId,
        currency: household.currency,
        expenses: expenseInputs,
        now,
        windowDays,
      });
      const segments = calculateSegments(profile);

      await replaceByHousehold(ctx, "household_spending_profiles", args.householdId);
      await replaceByHousehold(ctx, "household_offer_segments", args.householdId);

      await ctx.db.insert("household_spending_profiles", profile);

      for (const segment of segments) {
        await ctx.db.insert("household_offer_segments", {
          householdId: args.householdId,
          segmentKey: segment.segmentKey,
          score: segment.score,
          evidence: segment.evidence,
          computedAt: now,
          expiresAt: now + DEFAULT_SEGMENT_TTL_MS,
        });
      }

      if (job) {
        await ctx.db.patch(job._id, {
          status: "clean",
          lastRunAt: now,
          error: undefined,
          updatedAt: Date.now(),
        });
      }

      return { profile, segments };
    } catch (error: any) {
      if (job) {
        await ctx.db.patch(job._id, {
          status: "failed",
          error: error.message ?? "Segment recalculation failed",
          updatedAt: Date.now(),
        });
      }
      throw error;
    }
  },
});

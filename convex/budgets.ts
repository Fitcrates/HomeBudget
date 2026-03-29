import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

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
    await assertMember(ctx, args.householdId, userId);

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
    await assertMember(ctx, args.householdId, userId);

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

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
      .query("goals")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .collect();
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

    await ctx.db.patch(args.goalId, { currentAmount: newAmount });
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

    await ctx.db.delete(args.goalId);
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

export const get = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const row = await ctx.db
      .query("household_income")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    return row ?? null;
  },
});

export const upsert = mutation({
  args: {
    householdId: v.id("households"),
    monthlyAmount: v.number(),
    memberContributions: v.optional(
      v.array(
        v.object({
          userId: v.string(),
          amount: v.number(),
          label: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("household_income")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        monthlyAmount: args.monthlyAmount,
        memberContributions: args.memberContributions,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("household_income", {
        householdId: args.householdId,
        monthlyAmount: args.monthlyAmount,
        memberContributions: args.memberContributions,
        updatedAt: Date.now(),
      });
    }
  },
});

export const remove = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("household_income")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

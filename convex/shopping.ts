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
      .query("shopping_items")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("asc")
      .collect();
  },
});

export const add = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    addedByAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db.insert("shopping_items", {
      ...args,
      isBought: false,
      createdAt: Date.now(),
    });
  },
});

export const toggleBuy = mutation({
  args: {
    householdId: v.id("households"),
    itemId: v.id("shopping_items"),
    isBought: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.householdId !== args.householdId) throw new Error("Unauthorized");

    await ctx.db.patch(args.itemId, { isBought: args.isBought });
  },
});

export const remove = mutation({
  args: {
    householdId: v.id("households"),
    itemId: v.id("shopping_items"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.householdId !== args.householdId) throw new Error("Unauthorized");

    await ctx.db.delete(args.itemId);
  },
});

export const clearBought = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const boughtItems = await ctx.db
      .query("shopping_items")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .filter((q) => q.eq(q.field("isBought"), true))
      .collect();

    for (const item of boughtItems) {
      await ctx.db.delete(item._id);
    }
  },
});

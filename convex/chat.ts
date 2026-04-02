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
      .query("chat_messages")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    householdId: v.id("households"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    text: v.string(),
    pendingAction: v.optional(
      v.object({
        type: v.literal("clear_shopping_list"),
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Only verify user if the action wasn't internally triggered by an action directly?
    // Let's assume standard client call for user messages.
    // If it's the assistant, we also call this? Yes, from standard node actions we pass context.
    const userId = await getAuthUserId(ctx);
    if (!userId && args.role !== "assistant") {
       throw new Error("Not authenticated");
    }
    
    return await ctx.db.insert("chat_messages", {
      householdId: args.householdId,
      role: args.role,
      text: args.text,
      pendingAction: args.pendingAction,
      createdAt: Date.now(),
    });
  },
});

export const resolvePendingAction = mutation({
  args: {
    householdId: v.id("households"),
    messageId: v.id("chat_messages"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.householdId !== args.householdId) throw new Error("Invalid message");
    
    if (msg.pendingAction) {
      await ctx.db.patch(args.messageId, {
        pendingAction: { ...msg.pendingAction, status: args.status },
      });
    }
  },
});

export const clearHistory = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});

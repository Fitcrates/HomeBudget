import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

export const listSessions = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db
      .query("chat_sessions")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .collect();
  },
});

export const createSession = mutation({
  args: { householdId: v.id("households"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const sessionId = await ctx.db.insert("chat_sessions", {
      householdId: args.householdId,
      title: args.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return sessionId;
  },
});

export const listSessionMessages = query({
  args: { householdId: v.id("households"), sessionId: v.id("chat_sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    return await ctx.db
      .query("chat_messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    householdId: v.id("households"),
    sessionId: v.id("chat_sessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    text: v.string(),
    pendingAction: v.optional(
      v.object({
        type: v.union(v.literal("clear_shopping_list"), v.literal("add_shopping_list")),
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        data: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId && args.role !== "assistant") {
       throw new Error("Not authenticated");
    }
    
    const msgId = await ctx.db.insert("chat_messages", {
      householdId: args.householdId,
      sessionId: args.sessionId,
      role: args.role,
      text: args.text,
      pendingAction: args.pendingAction,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
    return msgId;
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

export const updateSessionTitle = mutation({
  args: { 
    householdId: v.id("households"), 
    sessionId: v.id("chat_sessions"),
    title: v.string()
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    await ctx.db.patch(args.sessionId, { 
      title: args.title,
      updatedAt: Date.now()
    });
  },
});

export const deleteSession = mutation({
  args: { householdId: v.id("households"), sessionId: v.id("chat_sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export const getOrCreate = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("email_tokens")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    if (existing) return existing.token;

    const token = generateToken();
    await ctx.db.insert("email_tokens", {
      householdId: args.householdId,
      token,
      createdAt: Date.now(),
    });
    return token;
  },
});

export const get = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    await assertMember(ctx, args.householdId, userId);

    const row = await ctx.db
      .query("email_tokens")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    return row?.token ?? null;
  },
});

export const regenerate = mutation({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const existing = await ctx.db
      .query("email_tokens")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .unique();

    const token = generateToken();
    if (existing) {
      await ctx.db.patch(existing._id, { token, createdAt: Date.now() });
    } else {
      await ctx.db.insert("email_tokens", {
        householdId: args.householdId,
        token,
        createdAt: Date.now(),
      });
    }
    return token;
  },
});

// Internal: find household by token
export const findHouseholdByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("email_tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    return row?.householdId ?? null;
  },
});

// Internal: save parsed pending expense
export const savePendingExpense = internalMutation({
  args: {
    householdId: v.id("households"),
    emailFrom: v.string(),
    emailSubject: v.string(),
    emailReceivedAt: v.number(),
    rawEmailText: v.string(),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(),
        categoryId: v.optional(v.string()),
        subcategoryId: v.optional(v.string()),
        confidence: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pending_email_expenses", {
      ...args,
      status: "pending",
    });
  },
});

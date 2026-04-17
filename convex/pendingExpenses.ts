import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

async function attachStorageUrls(ctx: any, rows: any[]) {
  return await Promise.all(
    rows.map(async (row) => {
      const storageUrls = await Promise.all(
        (row.storageIds ?? []).map(async (storageId: any) => await ctx.storage.getUrl(storageId))
      );

      return {
        ...row,
        storageUrls,
      };
    })
  );
}

export const listPending = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const rows = await ctx.db
      .query("pending_email_expenses")
      .withIndex("by_household_and_status", (q) =>
        q.eq("householdId", args.householdId).eq("status", "pending")
      )
      .order("desc")
      .collect();

    return await attachStorageUrls(ctx, rows);
  },
});

export const listAll = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const rows = await ctx.db
      .query("pending_email_expenses")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .take(50);

    return await attachStorageUrls(ctx, rows);
  },
});

export const approve = mutation({
  args: {
    pendingId: v.id("pending_email_expenses"),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(),
        categoryId: v.id("categories"),
        subcategoryId: v.id("subcategories"),
        sourceStorageId: v.optional(v.id("_storage")),
      })
    ),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Not found");
    await assertMember(ctx, pending.householdId, userId);

    for (const item of args.items) {
      await ctx.db.insert("expenses", {
        householdId: pending.householdId,
        userId,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        amount: item.amount,
        date: args.date,
        description: item.description,
        receiptImageId: item.sourceStorageId ?? pending.storageIds?.[0],
        ocrRawText: pending.ocrRawText || pending.rawEmailText,
        tags: ["email", "forwarded"],
      });
    }

    await ctx.db.patch(args.pendingId, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewedByUserId: userId,
    });
  },
});

export const reject = mutation({
  args: { pendingId: v.id("pending_email_expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pending = await ctx.db.get(args.pendingId);
    if (!pending) throw new Error("Not found");
    await assertMember(ctx, pending.householdId, userId);

    for (const storageId of pending.storageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    await ctx.db.patch(args.pendingId, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedByUserId: userId,
    });
  },
});

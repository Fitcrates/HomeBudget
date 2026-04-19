import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import type { Id } from "./_generated/dataModel";
import {
  findLinkedExpenseIdsForPending,
  listEffectivelyPendingEmailExpenses,
} from "./lib/pendingEmailExpenses";

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

    const rows = await listEffectivelyPendingEmailExpenses(ctx, args.householdId);

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
    const normalizedRows = await Promise.all(
      rows.map(async (row) => {
        const linkedExpenseIds = await findLinkedExpenseIdsForPending(ctx, row);
        const isProcessed = row.isProcessed === true || linkedExpenseIds.length > 0 || row.status !== "pending";

        if (!isProcessed) {
          return row;
        }

        return {
          ...row,
          status: row.status === "pending" ? "approved" : row.status,
          isProcessed: true,
          processedExpenseIds:
            row.processedExpenseIds && row.processedExpenseIds.length > 0
              ? row.processedExpenseIds
              : linkedExpenseIds,
        };
      })
    );

    return await attachStorageUrls(ctx, normalizedRows);
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

    if (pending.status === "rejected") {
      throw new Error("Ten mail został już odrzucony.");
    }

    const existingLinkedExpenseIds = await findLinkedExpenseIdsForPending(ctx, pending);
    if (existingLinkedExpenseIds.length > 0 || pending.isProcessed === true || pending.status === "approved") {
      const now = Date.now();
      await ctx.db.patch(args.pendingId, {
        status: "approved",
        isProcessed: true,
        processedAt: pending.processedAt ?? now,
        processedExpenseIds:
          pending.processedExpenseIds && pending.processedExpenseIds.length > 0
            ? pending.processedExpenseIds
            : existingLinkedExpenseIds,
        reviewedAt: pending.reviewedAt ?? now,
        reviewedByUserId: pending.reviewedByUserId ?? userId,
      });

      return {
        insertedExpenseIds:
          pending.processedExpenseIds && pending.processedExpenseIds.length > 0
            ? pending.processedExpenseIds
            : existingLinkedExpenseIds,
        alreadyProcessed: true,
      };
    }

    const insertedExpenseIds: Id<"expenses">[] = [];

    for (const item of args.items) {
      const expenseId = await ctx.db.insert("expenses", {
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
        sourcePendingEmailExpenseId: pending._id,
        sourceProviderMessageId: pending.providerMessageId,
      });
      insertedExpenseIds.push(expenseId);
    }

    const now = Date.now();
    await ctx.db.patch(args.pendingId, {
      status: "approved",
      isProcessed: true,
      processedAt: now,
      processedExpenseIds: insertedExpenseIds,
      reviewedAt: now,
      reviewedByUserId: userId,
    });

    return {
      insertedExpenseIds,
      alreadyProcessed: false,
    };
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

    const existingLinkedExpenseIds = await findLinkedExpenseIdsForPending(ctx, pending);
    if (existingLinkedExpenseIds.length > 0 || pending.status === "approved" || pending.isProcessed === true) {
      throw new Error("Ten mail został już zamieniony na wydatki i nie może zostać odrzucony.");
    }

    for (const storageId of pending.storageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    const now = Date.now();
    await ctx.db.patch(args.pendingId, {
      status: "rejected",
      isProcessed: true,
      processedAt: now,
      processedExpenseIds: [],
      reviewedAt: now,
      reviewedByUserId: userId,
    });
  },
});

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";
import type { Id } from "./_generated/dataModel";
import {
  findLinkedExpenseIdsForPending,
  listEffectivelyPendingEmailExpenses,
} from "./lib/pendingEmailExpenses";

const MANUAL_SCAN_SENDER = "Skaner OCR";
const MANUAL_SCAN_INBOX = "manual-ocr@homebudget.local";

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
    const pendingStorageIds = new Set((pending.storageIds ?? []).map((storageId) => String(storageId)));

    for (const item of args.items) {
      const receiptImageId = item.sourceStorageId && pendingStorageIds.has(String(item.sourceStorageId))
        ? item.sourceStorageId
        : pending.storageIds?.[0];

      const expenseId = await ctx.db.insert("expenses", {
        householdId: pending.householdId,
        userId,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        amount: item.amount,
        date: args.date,
        description: item.description,
        receiptImageId,
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

export const createManualReceiptScanPending = internalMutation({
  args: {
    householdId: v.id("households"),
    userId: v.id("users"),
    storageIds: v.array(v.id("_storage")),
    mimeTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await assertMember(ctx, args.householdId, args.userId);

    const now = Date.now();
    const providerMessageId = `manual-ocr:${String(args.storageIds[0] ?? "empty")}:${now}`;
    const attachmentNames = args.storageIds.map((_, index) => {
      const mimeType = args.mimeTypes[index] || "";
      const extension = mimeType === "application/pdf"
        ? "pdf"
        : mimeType.includes("webp")
          ? "webp"
          : mimeType.includes("png")
            ? "png"
            : "jpg";
      return `Paragon ${index + 1}.${extension}`;
    });

    return await ctx.db.insert("pending_email_expenses", {
      householdId: args.householdId,
      providerMessageId,
      sourceType: "manual_ocr",
      createdByUserId: args.userId,
      emailFrom: MANUAL_SCAN_SENDER,
      emailTo: MANUAL_SCAN_INBOX,
      emailSubject: `Skan paragonu ${new Date(now).toLocaleString("pl-PL")}`,
      emailReceivedAt: now,
      rawEmailText: "Ręcznie dodany skan paragonu. Zachowaj oryginalny paragon do czasu zatwierdzenia wyniku OCR.",
      matchedInboxAddress: MANUAL_SCAN_INBOX,
      detectedBy: "ocr",
      sourceSummary: "Przetwarzamy skan w tle. Zachowaj paragon do czasu sprawdzenia wyniku.",
      attachmentNames,
      storageIds: args.storageIds,
      scanStatus: "processing",
      queuedAt: now,
      items: [],
      status: "pending",
      isProcessed: false,
    });
  },
});

export const markManualReceiptScanReady = internalMutation({
  args: {
    pendingId: v.id("pending_email_expenses"),
    ocrRawText: v.optional(v.string()),
    ocrDebugJson: v.optional(v.string()),
    sourceSummary: v.optional(v.string()),
    items: v.array(
      v.object({
        description: v.string(),
        amount: v.number(),
        categoryId: v.optional(v.id("categories")),
        subcategoryId: v.optional(v.id("subcategories")),
        confidence: v.optional(v.string()),
        sourceStorageId: v.optional(v.id("_storage")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending || pending.status !== "pending" || pending.isProcessed === true) {
      return null;
    }

    await ctx.db.patch(args.pendingId, {
      ocrRawText: args.ocrRawText,
      ocrDebugJson: args.ocrDebugJson,
      sourceSummary: args.sourceSummary,
      items: args.items,
      scanStatus: "ready",
      completedAt: Date.now(),
    });

    return args.pendingId;
  },
});

export const markManualReceiptScanFailed = internalMutation({
  args: {
    pendingId: v.id("pending_email_expenses"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingId);
    if (!pending || pending.status !== "pending" || pending.isProcessed === true) {
      return null;
    }

    await ctx.db.patch(args.pendingId, {
      sourceSummary: "Nie udało się automatycznie odczytać skanu. Otwórz załącznik i przepisz pozycje ręcznie albo spróbuj ponownie z wyraźniejszym zdjęciem.",
      scanStatus: "failed",
      scanError: args.error.slice(0, 500),
      completedAt: Date.now(),
    });

    return args.pendingId;
  },
});

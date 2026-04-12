import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

function monthRange(dateMs: number) {
  const date = new Date(dateMs);
  return {
    startOfMonth: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
    endOfMonth: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).getTime(),
  };
}

function hasSubscriptionDuplicate(
  existingExpenses: Array<{ categoryId: string; amount: number; isSubscription?: boolean }>,
  candidate: { categoryId: string; amount: number; isSubscription?: boolean }
) {
  return existingExpenses.some(
    (e) =>
      e.categoryId === candidate.categoryId &&
      e.amount === candidate.amount &&
      (e.isSubscription || candidate.isSubscription)
  );
}

export const list = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    categoryId: v.optional(v.id("categories")),
    subcategoryId: v.optional(v.id("subcategories")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    let expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) =>
        q.eq("householdId", args.householdId)
      )
      .order("desc")
      .collect();

    if (args.dateFrom !== undefined) {
      expenses = expenses.filter((e) => e.date >= args.dateFrom!);
    }
    if (args.dateTo !== undefined) {
      expenses = expenses.filter((e) => e.date <= args.dateTo!);
    }
    if (args.categoryId) {
      expenses = expenses.filter((e) => e.categoryId === args.categoryId);
    }
    if (args.subcategoryId) {
      expenses = expenses.filter((e) => e.subcategoryId === args.subcategoryId);
    }

    const limited = expenses.slice(0, args.limit ?? 200);

    return Promise.all(
      limited.map(async (e) => {
        const category = await ctx.db.get(e.categoryId);
        const subcategory = await ctx.db.get(e.subcategoryId);
        const user = await ctx.db.get(e.userId);
        let receiptUrl: string | null = null;
        if (e.receiptImageId) {
          receiptUrl = await ctx.storage.getUrl(e.receiptImageId);
        }
        return { ...e, category, subcategory, user, receiptUrl };
      })
    );
  },
});

export const get = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    await assertMember(ctx, expense.householdId, userId);

    const category = await ctx.db.get(expense.categoryId);
    const subcategory = await ctx.db.get(expense.subcategoryId);
    let receiptUrl: string | null = null;
    if (expense.receiptImageId) {
      receiptUrl = await ctx.storage.getUrl(expense.receiptImageId);
    }
    return { ...expense, category, subcategory, receiptUrl };
  },
});

export const create = mutation({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    subcategoryId: v.id("subcategories"),
    amount: v.number(),
    date: v.number(),
    description: v.string(),
    receiptImageId: v.optional(v.id("_storage")),
    ocrRawText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isSubscription: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    // Duplication check for subscriptions:
    // If the user adds an expense, check if there's already a subscription with EXACT amount and category in the same month.
    const { startOfMonth, endOfMonth } = monthRange(args.date);

    const existingExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) =>
        q.eq("householdId", args.householdId)
          .gte("date", startOfMonth)
          .lte("date", endOfMonth)
      )
      .collect();

    // Check if there is already an expense that is marked as subscription with the same amount and category
    // or if we are adding a subscription, check if someone already added exactly this via OCR!
    const isDuplicate = hasSubscriptionDuplicate(existingExpenses as any, {
      categoryId: args.categoryId,
      amount: args.amount,
      isSubscription: args.isSubscription,
    });

    if (isDuplicate) {
      throw new Error("Uwaga: Znaleziono już identyczny wydatek abonamentowy (ta sama kwota i kategoria) w tym miesiącu.");
    }

    return await ctx.db.insert("expenses", {
      ...args,
      userId,
    });
  },
});

export const createMany = mutation({
  args: {
    householdId: v.id("households"),
    items: v.array(v.object({
      categoryId: v.id("categories"),
      subcategoryId: v.id("subcategories"),
      amount: v.number(),
      date: v.number(),
      description: v.string(),
      receiptImageId: v.optional(v.id("_storage")),
      ocrRawText: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      isSubscription: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    if (args.items.length === 0) return { insertedIds: [], insertedCount: 0 };

    const monthKeys = new Set(args.items.map((item) => {
      const date = new Date(item.date);
      return `${date.getFullYear()}-${date.getMonth()}`;
    }));

    const existingByMonth = new Map<string, any[]>();
    for (const monthKey of monthKeys) {
      const [yearRaw, monthRaw] = monthKey.split("-");
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      const startOfMonth = new Date(year, month, 1).getTime();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).getTime();

      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_household_and_date", (q) =>
          q.eq("householdId", args.householdId)
            .gte("date", startOfMonth)
            .lte("date", endOfMonth)
        )
        .collect();

      existingByMonth.set(monthKey, [...existing]);
    }

    const insertedIds: any[] = [];

    for (const item of args.items) {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const existingInMonth = existingByMonth.get(monthKey) || [];

      if (hasSubscriptionDuplicate(existingInMonth as any, {
        categoryId: item.categoryId,
        amount: item.amount,
        isSubscription: item.isSubscription,
      })) {
        throw new Error("Uwaga: Znaleziono już identyczny wydatek abonamentowy (ta sama kwota i kategoria) w tym miesiącu.");
      }

      const insertedId = await ctx.db.insert("expenses", {
        householdId: args.householdId,
        userId,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        amount: item.amount,
        date: item.date,
        description: item.description,
        receiptImageId: item.receiptImageId,
        ocrRawText: item.ocrRawText,
        tags: item.tags,
        isSubscription: item.isSubscription,
      });

      insertedIds.push(insertedId);
      existingInMonth.push({
        categoryId: item.categoryId,
        amount: item.amount,
        isSubscription: item.isSubscription,
      });
      existingByMonth.set(monthKey, existingInMonth);
    }

    return { insertedIds, insertedCount: insertedIds.length };
  },
});

export const update = mutation({
  args: {
    expenseId: v.id("expenses"),
    categoryId: v.optional(v.id("categories")),
    subcategoryId: v.optional(v.id("subcategories")),
    amount: v.optional(v.number()),
    date: v.optional(v.number()),
    description: v.optional(v.string()),
    receiptImageId: v.optional(v.id("_storage")),
    ocrRawText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isSubscription: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    await assertMember(ctx, expense.householdId, userId);

    const { expenseId, ...updates } = args;
    await ctx.db.patch(args.expenseId, updates);
  },
});

export const remove = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    await assertMember(ctx, expense.householdId, userId);

    if (expense.receiptImageId) {
      await ctx.storage.delete(expense.receiptImageId);
    }
    await ctx.db.delete(args.expenseId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

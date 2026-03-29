import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

export const summary = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    return { total, count: filtered.length };
  },
});

export const totalsPerPeriod = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
    granularity: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const buckets: Record<string, number> = {};
    for (const e of filtered) {
      const d = new Date(e.date);
      let key: string;
      if (args.granularity === "day") {
        key = d.toISOString().split("T")[0];
      } else if (args.granularity === "week") {
        const s = new Date(d);
        s.setDate(d.getDate() - d.getDay());
        key = s.toISOString().split("T")[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      buckets[key] = (buckets[key] ?? 0) + e.amount;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, total]) => ({ period, total }));
  },
});

export const totalsPerCategory = query({
  args: {
    householdId: v.id("households"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_date", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const byCategory: Record<string, { total: number; name: string; color: string; icon: string }> = {};
    for (const e of filtered) {
      const cat = await ctx.db.get(e.categoryId);
      if (!cat) continue;
      if (!byCategory[e.categoryId]) {
        byCategory[e.categoryId] = { total: 0, name: cat.name, color: cat.color, icon: cat.icon };
      }
      byCategory[e.categoryId].total += e.amount;
    }

    return Object.entries(byCategory).map(([id, data]) => ({ id, ...data }));
  },
});

export const totalsPerSubcategory = query({
  args: {
    householdId: v.id("households"),
    categoryId: v.id("categories"),
    dateFrom: v.number(),
    dateTo: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_household_and_category", (q) =>
        q.eq("householdId", args.householdId).eq("categoryId", args.categoryId)
      )
      .collect();

    const filtered = expenses.filter(
      (e) => e.date >= args.dateFrom && e.date <= args.dateTo
    );

    const bySubcategory: Record<string, { total: number; name: string; icon: string }> = {};
    for (const e of filtered) {
      const sub = await ctx.db.get(e.subcategoryId);
      if (!sub) continue;
      if (!bySubcategory[e.subcategoryId]) {
        bySubcategory[e.subcategoryId] = { total: 0, name: sub.name, icon: sub.icon };
      }
      bySubcategory[e.subcategoryId].total += e.amount;
    }

    return Object.entries(bySubcategory).map(([id, data]) => ({ id, ...data }));
  },
});

export const householdMemberStats = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    return Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const profile = await ctx.db
          .query("user_profiles")
          .withIndex("by_user", (q) => q.eq("userId", m.userId))
          .unique();

        const avatarUrl = profile?.avatarImageId
          ? await ctx.storage.getUrl(profile.avatarImageId)
          : null;

        const userExpenses = allExpenses.filter((e) => e.userId === m.userId);
        const totalExpenses = userExpenses.length;
        const ocrExpenses = userExpenses.filter((e) => !!e.ocrRawText || !!e.receiptImageId).length;
        const manualExpenses = totalExpenses - ocrExpenses;
        const totalAmount = userExpenses.reduce((sum, e) => sum + e.amount, 0);

        const daySet = new Set(
          userExpenses.map((e) => new Date(e.date).toISOString().split("T")[0])
        );
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          if (daySet.has(key)) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }

        return {
          userId: m.userId,
          role: m.role,
          displayName:
            profile?.displayName || user?.name || user?.email?.split("@")[0] || "Nieznany",
          email: user?.email || "",
          avatarUrl,
          totalExpenses,
          ocrExpenses,
          manualExpenses,
          totalAmount,
          streak,
        };
      })
    );
  },
});

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "./households";

// ── Internal: log OCR scan results (called from actions) ──────────

export const logScan = internalMutation({
  args: {
    householdId: v.id("households"),
    imageCount: v.number(),
    modelUsed: v.string(),
    itemCount: v.number(),
    totalAmount: v.optional(v.string()),
    sumMatchedTotal: v.boolean(),
    retryUsed: v.boolean(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ocr_logs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ── Public: get scan stats for dashboard (optional future use) ────

export const getScanStats = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const logs = await ctx.db
      .query("ocr_logs")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .take(100);

    const totalScans = logs.length;
    const avgLatency = totalScans > 0
      ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / totalScans)
      : 0;
    const retryRate = totalScans > 0
      ? Math.round((logs.filter((l) => l.retryUsed).length / totalScans) * 100)
      : 0;
    const matchRate = totalScans > 0
      ? Math.round((logs.filter((l) => l.sumMatchedTotal).length / totalScans) * 100)
      : 0;

    return { totalScans, avgLatency, retryRate, matchRate, recentLogs: logs.slice(0, 10) };
  },
});

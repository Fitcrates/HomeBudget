import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation } from "../../_generated/server";

const conversionStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("paid")
);

async function upsertConversion(ctx: any, args: {
  sourceId: any;
  offerId: any;
  clickToken?: string;
  externalConversionId: string;
  orderAmount?: number;
  commissionAmount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid";
  convertedAt: number;
  metadata?: any;
}) {
  const click = args.clickToken
    ? await ctx.db
        .query("offer_clicks")
        .withIndex("by_click_token", (q: any) => q.eq("clickToken", args.clickToken))
        .first()
    : null;

  const existing = await ctx.db
    .query("offer_conversions")
    .withIndex("by_source_external", (q: any) =>
      q.eq("sourceId", args.sourceId).eq("externalConversionId", args.externalConversionId)
    )
    .first();

  const now = Date.now();
  const record = {
    clickId: click?._id,
    offerId: click?.offerId ?? args.offerId,
    sourceId: args.sourceId,
    externalConversionId: args.externalConversionId,
    orderAmount: args.orderAmount,
    commissionAmount: args.commissionAmount,
    currency: args.currency,
    status: args.status,
    convertedAt: args.convertedAt,
    updatedAt: now,
    metadata: args.metadata,
  };

  if (existing) {
    await ctx.db.patch(existing._id, record);
    return existing._id;
  }

  return await ctx.db.insert("offer_conversions", record);
}

export const recordConversion = internalMutation({
  args: {
    sourceId: v.id("offer_sources"),
    offerId: v.id("offers"),
    clickToken: v.optional(v.string()),
    externalConversionId: v.string(),
    orderAmount: v.optional(v.number()),
    commissionAmount: v.number(),
    currency: v.string(),
    status: conversionStatus,
    convertedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await upsertConversion(ctx, {
      ...args,
      convertedAt: args.convertedAt ?? Date.now(),
    });
  },
});

export const recordManualConversion = mutation({
  args: {
    sourceId: v.id("offer_sources"),
    offerId: v.id("offers"),
    clickToken: v.optional(v.string()),
    externalConversionId: v.string(),
    orderAmount: v.optional(v.number()),
    commissionAmount: v.number(),
    currency: v.string(),
    status: conversionStatus,
    convertedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await upsertConversion(ctx, {
      ...args,
      convertedAt: args.convertedAt ?? Date.now(),
    });
  },
});

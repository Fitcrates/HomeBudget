import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { normalizeOffer } from "./catalog/normalizer";
import { upsertOffer } from "./catalog/repository";

const catalogSourceType = v.union(
  v.literal("manual"),
  v.literal("affiliate_network"),
  v.literal("cashback_network"),
  v.literal("price_comparison"),
  v.literal("loyalty_program"),
  v.literal("bank_offer")
);

const revenueModel = v.union(v.literal("cps"), v.literal("cpc"), v.literal("cpm"), v.literal("flat"));

export const upsertOfferSource = mutation({
  args: {
    sourceId: v.optional(v.id("offer_sources")),
    name: v.string(),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("affiliate_network"),
      v.literal("cashback_network"),
      v.literal("ad_network"),
      v.literal("price_comparison"),
      v.literal("loyalty_program"),
      v.literal("bank_offer")
    ),
    providerKey: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled"), v.literal("failing")),
    priorityBoost: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    if (args.sourceId) {
      const { sourceId, ...patch } = args;
      await ctx.db.patch(sourceId, { ...patch, updatedAt: now });
      return sourceId;
    }

    return await ctx.db.insert("offer_sources", {
      name: args.name,
      sourceType: args.sourceType,
      providerKey: args.providerKey,
      status: args.status,
      priorityBoost: args.priorityBoost,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listOfferSources = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sources = await ctx.db.query("offer_sources").collect();
    return await Promise.all(
      sources.map(async (source) => {
        const recentRuns = await ctx.db
          .query("provider_ingestion_runs")
          .withIndex("by_source_time", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .take(5);
        return { ...source, recentRuns };
      })
    );
  },
});

export const upsertManualOffer = mutation({
  args: {
    offerId: v.optional(v.id("offers")),
    sourceId: v.id("offer_sources"),
    externalId: v.string(),
    title: v.string(),
    merchantName: v.string(),
    description: v.string(),
    categoryKeys: v.array(v.string()),
    segmentKeys: v.array(v.string()),
    countryCodes: v.array(v.string()),
    currency: v.string(),
    revenueModel,
    commissionRate: v.optional(v.number()),
    commissionAmount: v.optional(v.number()),
    estimatedSavingsAmount: v.optional(v.number()),
    estimatedSavingsPct: v.optional(v.number()),
    affiliateUrl: v.string(),
    imageUrl: v.optional(v.string()),
    termsUrl: v.optional(v.string()),
    startsAt: v.number(),
    expiresAt: v.optional(v.number()),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("expired")),
    weight: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Offer source not found");
    if (source.sourceType === "ad_network") throw new Error("Ad network sources do not use the offer catalog");

    const { offerId: _offerId, ...input } = args;
    return await upsertOffer(
      ctx,
      normalizeOffer({
        ...input,
        sourceType: source.sourceType as any,
        cashbackSharePct: undefined,
      })
    );
  },
});

export const pauseOffer = mutation({
  args: { offerId: v.id("offers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.offerId, { status: "paused", updatedAt: Date.now() });
  },
});

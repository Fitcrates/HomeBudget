import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "../../households";

export const getOfferPerformance = query({
  args: {
    householdId: v.id("households"),
    offerId: v.optional(v.id("offers")),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const clicks = await ctx.db
      .query("offer_clicks")
      .withIndex("by_household_time", (q) => q.eq("householdId", args.householdId))
      .collect();

    const filtered = clicks.filter((click) =>
      (args.offerId === undefined || click.offerId === args.offerId) &&
      (args.since === undefined || click.clickedAt >= args.since)
    );

    const conversions = await ctx.db.query("offer_conversions").collect();
    const byOffer = new Map<string, {
      offerId: string;
      clicks: number;
      conversions: number;
      commissionAmount: number;
      ctrBasisRecommendations: number;
    }>();

    const recommendations = await ctx.db
      .query("household_offer_recommendations")
      .withIndex("by_household_status_rank", (q) => q.eq("householdId", args.householdId).eq("status", "active"))
      .collect();

    for (const recommendation of recommendations) {
      const key = String(recommendation.offerId);
      const current = byOffer.get(key) ?? {
        offerId: key,
        clicks: 0,
        conversions: 0,
        commissionAmount: 0,
        ctrBasisRecommendations: 0,
      };
      current.ctrBasisRecommendations += 1;
      byOffer.set(key, current);
    }

    for (const click of filtered) {
      const key = String(click.offerId);
      const current = byOffer.get(key) ?? {
        offerId: key,
        clicks: 0,
        conversions: 0,
        commissionAmount: 0,
        ctrBasisRecommendations: 0,
      };
      current.clicks += 1;
      byOffer.set(key, current);
    }

    for (const conversion of conversions) {
      if (args.offerId !== undefined && conversion.offerId !== args.offerId) continue;
      if (args.since !== undefined && conversion.convertedAt < args.since) continue;
      const key = String(conversion.offerId);
      const current = byOffer.get(key) ?? {
        offerId: key,
        clicks: 0,
        conversions: 0,
        commissionAmount: 0,
        ctrBasisRecommendations: 0,
      };
      current.conversions += 1;
      if (conversion.status === "approved" || conversion.status === "paid") {
        current.commissionAmount += conversion.commissionAmount;
      }
      byOffer.set(key, current);
    }

    return [...byOffer.values()].map((row) => ({
      ...row,
      ctr: row.ctrBasisRecommendations > 0 ? row.clicks / row.ctrBasisRecommendations : null,
      conversionRate: row.clicks > 0 ? row.conversions / row.clicks : null,
    }));
  },
});

export const getSourcePerformance = query({
  args: {
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [sources, clicks, conversions] = await Promise.all([
      ctx.db.query("offer_sources").collect(),
      ctx.db.query("offer_clicks").collect(),
      ctx.db.query("offer_conversions").collect(),
    ]);

    const bySource = new Map<string, {
      sourceId: string;
      providerKey: string;
      sourceType: string;
      clicks: number;
      conversions: number;
      commissionAmount: number;
    }>();

    for (const source of sources) {
      bySource.set(String(source._id), {
        sourceId: String(source._id),
        providerKey: source.providerKey,
        sourceType: source.sourceType,
        clicks: 0,
        conversions: 0,
        commissionAmount: 0,
      });
    }

    const offerSourceCache = new Map<string, string>();
    for (const click of clicks) {
      if (args.since !== undefined && click.clickedAt < args.since) continue;
      let sourceId = offerSourceCache.get(String(click.offerId));
      if (!sourceId) {
        const offer = await ctx.db.get(click.offerId);
        if (!offer) continue;
        sourceId = String(offer.sourceId);
        offerSourceCache.set(String(click.offerId), sourceId);
      }
      const current = bySource.get(sourceId);
      if (current) current.clicks += 1;
    }

    for (const conversion of conversions) {
      if (args.since !== undefined && conversion.convertedAt < args.since) continue;
      const current = bySource.get(String(conversion.sourceId));
      if (!current) continue;
      current.conversions += 1;
      if (conversion.status === "approved" || conversion.status === "paid") {
        current.commissionAmount += conversion.commissionAmount;
      }
    }

    return [...bySource.values()].map((row) => ({
      ...row,
      conversionRate: row.clicks > 0 ? row.conversions / row.clicks : null,
    }));
  },
});

export const getStrategyPerformance = query({
  args: {
    householdId: v.id("households"),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const recommendations = await ctx.db
      .query("household_offer_recommendations")
      .withIndex("by_household_status_rank", (q) => q.eq("householdId", args.householdId).eq("status", "active"))
      .collect();
    const clicks = await ctx.db
      .query("offer_clicks")
      .withIndex("by_household_time", (q) => q.eq("householdId", args.householdId))
      .collect();

    const byRecommendation = new Map(recommendations.map((row) => [String(row._id), row.strategyKey]));
    const byStrategy = new Map<string, { strategyKey: string; recommendations: number; clicks: number }>();

    for (const recommendation of recommendations) {
      if (args.since !== undefined && recommendation.generatedAt < args.since) continue;
      const current = byStrategy.get(recommendation.strategyKey) ?? {
        strategyKey: recommendation.strategyKey,
        recommendations: 0,
        clicks: 0,
      };
      current.recommendations += 1;
      byStrategy.set(recommendation.strategyKey, current);
    }

    for (const click of clicks) {
      if (!click.recommendationId || (args.since !== undefined && click.clickedAt < args.since)) continue;
      const strategyKey = byRecommendation.get(String(click.recommendationId));
      if (!strategyKey) continue;
      const current = byStrategy.get(strategyKey) ?? { strategyKey, recommendations: 0, clicks: 0 };
      current.clicks += 1;
      byStrategy.set(strategyKey, current);
    }

    return [...byStrategy.values()].map((row) => ({
      ...row,
      ctr: row.recommendations > 0 ? row.clicks / row.recommendations : null,
    }));
  },
});

import { v } from "convex/values";
import { action, internalQuery, mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertMember } from "../households";
import { internal } from "../_generated/api";

export const listFreshPersonalized = query({
  args: {
    householdId: v.id("households"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const rows = await ctx.db
      .query("household_offer_recommendations")
      .withIndex("by_household_status_rank", (q) =>
        q.eq("householdId", args.householdId).eq("status", "active")
      )
      .collect();

    const fresh = rows
      .filter((row) => row.expiresAt > Date.now())
      .sort((a, b) => a.rank - b.rank)
      .slice(0, args.limit ?? 10);

    return await Promise.all(
      fresh.map(async (recommendation) => ({
        recommendation,
        offer: await ctx.db.get(recommendation.offerId),
      }))
    );
  },
});

export const assertCanAccessHousehold = internalQuery({
  args: {
    householdId: v.id("households"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await assertMember(ctx, args.householdId, args.userId);
    return true;
  },
});

export const refreshPersonalized = action({
  args: {
    householdId: v.id("households"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.runQuery(internal.offers.public.assertCanAccessHousehold, {
      householdId: args.householdId,
      userId,
    });

    await ctx.runMutation(internal.offers.matching.recommendations.regenerate, {
      householdId: args.householdId,
      limit: args.limit ?? 10,
    });

    return await ctx.runQuery(internal.offers.matching.recommendations.listFresh, {
      householdId: args.householdId,
      now: Date.now(),
      limit: args.limit ?? 10,
    });
  },
});

export const dismissRecommendation = mutation({
  args: {
    householdId: v.id("households"),
    recommendationId: v.id("household_offer_recommendations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const recommendation = await ctx.db.get(args.recommendationId);
    if (!recommendation || recommendation.householdId !== args.householdId) {
      throw new Error("Recommendation not found");
    }
    await ctx.db.patch(args.recommendationId, { status: "dismissed" });
  },
});

export const createClickUrl = mutation({
  args: {
    householdId: v.id("households"),
    offerId: v.id("offers"),
    recommendationId: v.optional(v.id("household_offer_recommendations")),
  },
  handler: async (ctx, args): Promise<any> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const click: any = await ctx.runMutation(internal.offers.tracking.clicks.createTrackedClick, {
      householdId: args.householdId,
      userId,
      offerId: args.offerId,
      recommendationId: args.recommendationId,
    });

    return {
      clickId: click.clickId,
      url: `/api/offers/redirect?clickToken=${encodeURIComponent(click.clickToken)}`,
    };
  },
});

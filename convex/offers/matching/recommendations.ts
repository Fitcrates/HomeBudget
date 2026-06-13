import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { DEFAULT_RECOMMENDATION_TTL_MS, type SpendingProfile } from "../types";
import { matchOffersForHousehold } from "./matcher";
import { renderOfferMessage } from "../messages/renderer";

async function expireOldRecommendations(ctx: any, householdId: any, now: number) {
  const rows = await ctx.db
    .query("household_offer_recommendations")
    .withIndex("by_household_status_rank", (q: any) =>
      q.eq("householdId", householdId).eq("status", "active")
    )
    .collect();

  for (const row of rows) {
    if (row.expiresAt <= now) {
      await ctx.db.patch(row._id, { status: "expired" });
    }
  }
}

export const listFresh = internalQuery({
  args: {
    householdId: v.id("households"),
    now: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("household_offer_recommendations")
      .withIndex("by_household_status_rank", (q) =>
        q.eq("householdId", args.householdId).eq("status", "active")
      )
      .collect();

    const fresh = rows
      .filter((row) => row.expiresAt > args.now)
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

export const regenerate = internalMutation({
  args: {
    householdId: v.id("households"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await expireOldRecommendations(ctx, args.householdId, now);

    const profile = await ctx.db
      .query("household_spending_profiles")
      .withIndex("by_household_computed", (q) => q.eq("householdId", args.householdId))
      .order("desc")
      .first();

    if (!profile) return [];

    const activeRows = await ctx.db
      .query("household_offer_recommendations")
      .withIndex("by_household_status_rank", (q) =>
        q.eq("householdId", args.householdId).eq("status", "active")
      )
      .collect();

    for (const row of activeRows) {
      await ctx.db.patch(row._id, { status: "expired" });
    }

    const scored = await matchOffersForHousehold(ctx, args.householdId);
    const selected = scored.slice(0, args.limit ?? 10);
    const result = [];

    for (let index = 0; index < selected.length; index++) {
      const item = selected[index];
      const message = renderOfferMessage({
        offer: item.offer,
        profile: profile as SpendingProfile,
        matchedCategoryKeys: item.matchedCategoryKeys,
      });
      const recommendationId = await ctx.db.insert("household_offer_recommendations", {
        householdId: args.householdId,
        offerId: item.offer._id,
        strategyKey: item.strategyKey,
        score: item.score,
        rank: index + 1,
        messageTitle: message.title,
        messageBody: message.body,
        audit: {
          matchedSegments: item.matchedSegments,
          matchedCategoryKeys: item.matchedCategoryKeys,
          scoringFactors: item.scoringFactors,
        },
        status: "active",
        generatedAt: now,
        expiresAt: now + DEFAULT_RECOMMENDATION_TTL_MS,
      });
      result.push({ recommendationId, offerId: item.offer._id, score: item.score });
    }

    return result;
  },
});

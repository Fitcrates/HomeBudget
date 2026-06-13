import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

function makeClickToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

function appendSubId(url: string, token: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("subid", token);
  return parsed.toString();
}

export const createTrackedClick = internalMutation({
  args: {
    householdId: v.id("households"),
    userId: v.id("users"),
    offerId: v.id("offers"),
    recommendationId: v.optional(v.id("household_offer_recommendations")),
  },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.status !== "active") throw new Error("Offer not found");

    const token = makeClickToken();
    const affiliateUrl = appendSubId(offer.affiliateUrl, token);
    const clickId = await ctx.db.insert("offer_clicks", {
      householdId: args.householdId,
      userId: args.userId,
      offerId: args.offerId,
      recommendationId: args.recommendationId,
      clickToken: token,
      affiliateUrl,
      sourceType: offer.sourceType,
      revenueModel: offer.revenueModel,
      clickedAt: Date.now(),
    });

    return { clickId, clickToken: token, affiliateUrl };
  },
});

export const getRedirectByToken = internalQuery({
  args: { clickToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("offer_clicks")
      .withIndex("by_click_token", (q) => q.eq("clickToken", args.clickToken))
      .first();
  },
});

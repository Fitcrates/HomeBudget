import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "../../_generated/server";

export const upsertPlacement = mutation({
  args: {
    placementId: v.optional(v.id("ad_placements")),
    placementKey: v.string(),
    providerKey: v.string(),
    sourceId: v.optional(v.id("offer_sources")),
    screen: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    accountKey: v.optional(v.string()),
    campaignKey: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    if (args.placementId) {
      const { placementId, ...patch } = args;
      await ctx.db.patch(placementId, { ...patch, updatedAt: now });
      return placementId;
    }

    return await ctx.db.insert("ad_placements", {
      placementKey: args.placementKey,
      providerKey: args.providerKey,
      sourceId: args.sourceId,
      screen: args.screen,
      status: args.status,
      accountKey: args.accountKey,
      campaignKey: args.campaignKey,
      targetUrl: args.targetUrl,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listPlacements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.query("ad_placements").collect();
  },
});

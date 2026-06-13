import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";

function makeEventToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export const getPlacementByKey = internalQuery({
  args: { placementKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ad_placements")
      .withIndex("by_placement", (q) => q.eq("placementKey", args.placementKey))
      .first();
  },
});

export const recordAdEvent = internalMutation({
  args: {
    placementKey: v.string(),
    providerKey: v.string(),
    eventType: v.union(v.literal("impression"), v.literal("click"), v.literal("conversion"), v.literal("view")),
    householdId: v.optional(v.id("households")),
    userId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const placement = await ctx.db
      .query("ad_placements")
      .withIndex("by_placement", (q) => q.eq("placementKey", args.placementKey))
      .first();
    if (!placement || placement.status !== "active") throw new Error("Ad placement not found");
    if (placement.providerKey !== args.providerKey) throw new Error("Ad provider mismatch");

    return await ctx.db.insert("ad_events", {
      placementId: placement._id,
      providerKey: args.providerKey,
      householdId: args.householdId,
      userId: args.userId,
      eventType: args.eventType,
      eventToken: makeEventToken(),
      occurredAt: Date.now(),
      metadata: args.metadata,
    });
  },
});

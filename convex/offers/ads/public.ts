import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "../../_generated/server";
import { assertMember } from "../../households";
import { getAdProvider } from "./providers/registry";

export const getPlacementForScreen = query({
  args: {
    householdId: v.id("households"),
    screen: v.string(),
    eventBaseUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const placement = await ctx.db
      .query("ad_placements")
      .withIndex("by_screen_status", (q) => q.eq("screen", args.screen).eq("status", "active"))
      .first();
    if (!placement) return null;

    const segments = await ctx.db
      .query("household_offer_segments")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();
    const provider = getAdProvider(placement.providerKey);

    return provider.buildRenderConfig({
      placement,
      eventBaseUrl: args.eventBaseUrl,
      householdSegments: segments.map((segment) => segment.segmentKey),
    });
  },
});

export const recordView = mutation({
  args: {
    householdId: v.id("households"),
    placementKey: v.string(),
    providerKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertMember(ctx, args.householdId, userId);

    const placement = await ctx.db
      .query("ad_placements")
      .withIndex("by_placement", (q) => q.eq("placementKey", args.placementKey))
      .first();
    if (!placement || placement.status !== "active") throw new Error("Ad placement not found");

    return await ctx.db.insert("ad_events", {
      placementId: placement._id,
      providerKey: args.providerKey,
      householdId: args.householdId,
      userId,
      eventType: "view",
      eventToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      occurredAt: Date.now(),
    });
  },
});

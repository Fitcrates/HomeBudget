import { internalMutation } from "../../_generated/server";

export const expireOffers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("offers")
      .withIndex("by_status_expires", (q) => q.eq("status", "active"))
      .collect();

    let expired = 0;
    for (const offer of rows) {
      if (offer.expiresAt !== undefined && offer.expiresAt <= now) {
        await ctx.db.patch(offer._id, { status: "expired", updatedAt: now });
        expired += 1;
      }
    }
    return { expired };
  },
});

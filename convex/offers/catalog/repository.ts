import type { Doc, Id } from "../../_generated/dataModel";
import type { NormalizedOfferInput } from "../types";

export async function upsertOffer(ctx: any, offer: NormalizedOfferInput): Promise<Id<"offers">> {
  const now = Date.now();
  const existing = await ctx.db
    .query("offers")
    .withIndex("by_source_external", (q: any) =>
      q.eq("sourceId", offer.sourceId).eq("externalId", offer.externalId)
    )
    .first();

  const record = {
    ...offer,
    metadata: offer.metadata as any,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, record);
    return existing._id;
  }

  return await ctx.db.insert("offers", {
    ...record,
    createdAt: now,
  });
}

export async function listActiveOffers(ctx: any, now: number): Promise<Doc<"offers">[]> {
  const active = await ctx.db
    .query("offers")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .collect();

  return active.filter((offer: Doc<"offers">) =>
    offer.startsAt <= now && (offer.expiresAt === undefined || offer.expiresAt > now)
  );
}

export async function getActiveSource(ctx: any, sourceId: Id<"offer_sources">) {
  const source = await ctx.db.get(sourceId);
  if (!source || source.status !== "active") return null;
  return source;
}

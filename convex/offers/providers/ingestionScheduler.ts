import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { getProvider } from "./registry";
import { normalizeOffer } from "../catalog/normalizer";

export const listActiveSources = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("offer_sources").collect();
    return sources.filter((source) => source.status === "active" && source.sourceType !== "ad_network");
  },
});

export const recordIngestionRun = internalMutation({
  args: {
    sourceId: v.id("offer_sources"),
    providerKey: v.string(),
    status: v.union(v.literal("success"), v.literal("failed")),
    fetchedCount: v.number(),
    upsertedCount: v.number(),
    deactivatedCount: v.number(),
    error: v.optional(v.string()),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("provider_ingestion_runs", {
      ...args,
      finishedAt: now,
    });
    await ctx.db.patch(args.sourceId, {
      lastIngestedAt: now,
      lastSuccessAt: args.status === "success" ? now : undefined,
      lastError: args.error,
      status: args.status === "failed" ? "failing" : "active",
      updatedAt: now,
    });
  },
});

export const upsertIngestedOffers = internalMutation({
  args: {
    offers: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const offer of args.offers) {
      const existing = await ctx.db
        .query("offers")
        .withIndex("by_source_external", (q) =>
          q.eq("sourceId", offer.sourceId).eq("externalId", offer.externalId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...offer, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("offers", { ...offer, createdAt: Date.now(), updatedAt: Date.now() });
      }
      upserted += 1;
    }
    return { upserted };
  },
});

export const ingestProvider = internalAction({
  args: {
    sourceId: v.id("offer_sources"),
  },
  handler: async (ctx, args): Promise<any> => {
    const startedAt = Date.now();
    const source: any = await ctx.runQuery(internal.offers.providers.ingestionScheduler.getSource, {
      sourceId: args.sourceId,
    });
    if (!source) throw new Error("Offer source not found");

    try {
      const provider = getProvider(source.providerKey);
      const page = await provider.fetchOffers({});
      const normalized: any[] = page.items
        .flatMap((item): any[] => provider.normalize(item, source as any))
        .map(normalizeOffer);
      const result: any = await ctx.runMutation(internal.offers.providers.ingestionScheduler.upsertIngestedOffers, {
        offers: normalized,
      });
      await ctx.runMutation(internal.offers.providers.ingestionScheduler.recordIngestionRun, {
        sourceId: args.sourceId,
        providerKey: source.providerKey,
        status: "success",
        fetchedCount: page.items.length,
        upsertedCount: result.upserted,
        deactivatedCount: 0,
        startedAt,
      });
      return result;
    } catch (error: any) {
      await ctx.runMutation(internal.offers.providers.ingestionScheduler.recordIngestionRun, {
        sourceId: args.sourceId,
        providerKey: source.providerKey,
        status: "failed",
        fetchedCount: 0,
        upsertedCount: 0,
        deactivatedCount: 0,
        error: error.message ?? "Provider ingestion failed",
        startedAt,
      });
      throw error;
    }
  },
});

export const ingestAllActiveProviders = internalAction({
  args: {},
  handler: async (ctx): Promise<any> => {
    const sources: any[] = await ctx.runQuery(internal.offers.providers.ingestionScheduler.listActiveSources, {});
    const results = [];

    for (const source of sources) {
      if (source.providerKey === "manual") {
        results.push({ sourceId: source._id, providerKey: source.providerKey, skipped: true });
        continue;
      }

      const result = await ctx.runAction(internal.offers.providers.ingestionScheduler.ingestProvider, {
        sourceId: source._id,
      });
      results.push({ sourceId: source._id, providerKey: source.providerKey, result });
    }

    return results;
  },
});

export const getSource = internalQuery({
  args: { sourceId: v.id("offer_sources") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sourceId);
  },
});

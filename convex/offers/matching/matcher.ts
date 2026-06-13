import type { Id } from "../../_generated/dataModel";
import type { ScoredOffer, SpendingProfile } from "../types";
import { listActiveOffers, getActiveSource } from "../catalog/repository";
import { getMatchedCategoryKeys, getMatchedSegments, isEligibleOffer } from "./eligibility";
import { selectStrategy } from "./scoring/registry";

export async function matchOffersForHousehold(ctx: any, householdId: Id<"households">): Promise<ScoredOffer[]> {
  const now = Date.now();
  const profile = await ctx.db
    .query("household_spending_profiles")
    .withIndex("by_household_computed", (q: any) => q.eq("householdId", householdId))
    .order("desc")
    .first();

  if (!profile) return [];

  const segments = await ctx.db
    .query("household_offer_segments")
    .withIndex("by_household", (q: any) => q.eq("householdId", householdId))
    .collect();

  const offers = await listActiveOffers(ctx, now);
  const strategy = selectStrategy(String(householdId));
  const scored: ScoredOffer[] = [];

  for (const offer of offers) {
    const source = await getActiveSource(ctx, offer.sourceId);
    if (!isEligibleOffer({ offer, source, profile, segments, now })) continue;
    if (!source) continue;

    const matchedSegments = getMatchedSegments(offer, segments);
    const matchedCategoryKeys = getMatchedCategoryKeys(offer, profile);
    const result = strategy.score({
      offer,
      source,
      profile: profile as SpendingProfile,
      segments,
      matchedSegments,
      matchedCategoryKeys,
      now,
    });

    if (result.score <= 0) continue;

    scored.push({
      offer,
      source,
      score: result.score,
      strategyKey: strategy.key,
      matchedSegments,
      matchedCategoryKeys,
      scoringFactors: result.factors,
    });
  }

  return scored.sort((a, b) => b.score - a.score || b.offer.weight - a.offer.weight);
}

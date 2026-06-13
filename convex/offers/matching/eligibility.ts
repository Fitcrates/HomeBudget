import type { Doc } from "../../_generated/dataModel";

export function getMatchedSegments(offer: Doc<"offers">, segments: Array<{ segmentKey: string }>) {
  const segmentSet = new Set(segments.map((segment) => segment.segmentKey.toUpperCase()));
  return offer.segmentKeys.filter((key) => segmentSet.has(key.toUpperCase()));
}

export function getMatchedCategoryKeys(offer: Doc<"offers">, profile: { categoryStats: Array<{ categoryKey: string }> }) {
  const categorySet = new Set(profile.categoryStats.map((stat) => stat.categoryKey.toLowerCase()));
  return offer.categoryKeys.filter((key) => categorySet.has(key.toLowerCase()));
}

export function isEligibleOffer(args: {
  offer: Doc<"offers">;
  source: Doc<"offer_sources"> | null;
  profile: { currency: string; categoryStats: Array<{ categoryKey: string }> };
  segments: Array<{ segmentKey: string }>;
  now: number;
  countryCode?: string;
}) {
  if (!args.source || args.source.status !== "active") return false;
  if (args.offer.status !== "active") return false;
  if (args.offer.startsAt > args.now) return false;
  if (args.offer.expiresAt !== undefined && args.offer.expiresAt <= args.now) return false;
  if (args.offer.currency !== args.profile.currency) return false;
  if (!args.offer.countryCodes.includes((args.countryCode ?? "PL").toUpperCase())) return false;

  const matchedSegments = getMatchedSegments(args.offer, args.segments);
  const matchedCategories = getMatchedCategoryKeys(args.offer, args.profile);

  return matchedSegments.length > 0 || matchedCategories.length > 0;
}

import type { NormalizedOfferInput } from "../types";

function uniqueClean(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export function normalizeOffer(input: NormalizedOfferInput): NormalizedOfferInput {
  if (!input.title.trim()) throw new Error("Offer title is required");
  if (!input.merchantName.trim()) throw new Error("Offer merchantName is required");
  if (!input.externalId.trim()) throw new Error("Offer externalId is required");
  if (!input.affiliateUrl.trim()) throw new Error("Offer affiliateUrl is required");
  if (input.startsAt <= 0) throw new Error("Offer startsAt must be a timestamp");
  if (input.expiresAt !== undefined && input.expiresAt <= input.startsAt) {
    throw new Error("Offer expiresAt must be after startsAt");
  }
  if (input.revenueModel === "cps" && input.commissionRate === undefined) {
    throw new Error("CPS offers require commissionRate");
  }
  if ((input.revenueModel === "cpc" || input.revenueModel === "flat") && input.commissionAmount === undefined) {
    throw new Error("CPC and flat offers require commissionAmount");
  }

  return {
    ...input,
    title: input.title.trim(),
    merchantName: input.merchantName.trim(),
    description: input.description.trim(),
    externalId: input.externalId.trim(),
    categoryKeys: uniqueClean(input.categoryKeys),
    segmentKeys: uniqueClean(input.segmentKeys).map((key) => key.toUpperCase()),
    countryCodes: uniqueClean(input.countryCodes).map((code) => code.toUpperCase()),
    currency: input.currency.trim().toUpperCase(),
    weight: Math.max(0, Math.round(input.weight)),
  };
}

import type { Doc, Id } from "../_generated/dataModel";

export type SourceType =
  | "manual"
  | "affiliate_network"
  | "cashback_network"
  | "ad_network"
  | "price_comparison"
  | "loyalty_program"
  | "bank_offer";

export type CatalogSourceType = Exclude<SourceType, "ad_network">;

export type RevenueModel = "cps" | "cpc" | "cpm" | "flat";

export type OfferStatus = "draft" | "active" | "paused" | "expired";

export type ConversionStatus = "pending" | "approved" | "rejected" | "paid";

export type SegmentKey =
  | "HIGH_FOOD"
  | "DELIVERY_HEAVY"
  | "FUEL_SPENDER"
  | "SUBSCRIPTION_HEAVY"
  | "ONLINE_SHOPPER"
  | string;

export type CategoryStat = {
  categoryId: Id<"categories">;
  categoryName: string;
  categoryKey: string;
  totalAmount: number;
  monthlyAverage: number;
  transactionCount: number;
  frequencyPerMonth: number;
};

export type SpendingProfile = {
  householdId: Id<"households">;
  windowDays: number;
  currency: string;
  totalSpend: number;
  categoryStats: CategoryStat[];
  computedAt: number;
  dataFrom: number;
  dataTo: number;
  dataHash: string;
};

export type SegmentEvaluation = {
  segmentKey: SegmentKey;
  score: number;
  evidence: {
    windowDays: number;
    monthlyAverage: number;
    transactionCount: number;
    categoryKeys: string[];
  };
};

export type NormalizedOfferInput = {
  sourceId: Id<"offer_sources">;
  sourceType: CatalogSourceType;
  externalId: string;
  title: string;
  merchantName: string;
  description: string;
  categoryKeys: string[];
  segmentKeys: string[];
  countryCodes: string[];
  currency: string;
  revenueModel: RevenueModel;
  commissionRate?: number;
  commissionAmount?: number;
  cashbackSharePct?: number;
  estimatedSavingsAmount?: number;
  estimatedSavingsPct?: number;
  affiliateUrl: string;
  imageUrl?: string;
  termsUrl?: string;
  startsAt: number;
  expiresAt?: number;
  status: OfferStatus;
  weight: number;
  metadata?: unknown;
};

export type ScoredOffer = {
  offer: Doc<"offers">;
  source: Doc<"offer_sources">;
  score: number;
  strategyKey: string;
  matchedSegments: string[];
  matchedCategoryKeys: string[];
  scoringFactors: Array<{ key: string; value: number; weight: number }>;
};

export const DEFAULT_RECOMMENDATION_TTL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_SEGMENT_TTL_MS = 36 * 60 * 60 * 1000;
export const DEFAULT_PROFILE_WINDOW_DAYS = 90;

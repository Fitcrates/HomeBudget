import type { Doc } from "../../_generated/dataModel";
import type { CatalogSourceType, NormalizedOfferInput } from "../types";

export type FetchOffersArgs = {
  cursor?: string;
  limit?: number;
};

export type ProviderOfferPage = {
  items: unknown[];
  nextCursor?: string;
};

export type OfferProvider = {
  key: string;
  sourceType: CatalogSourceType;
  fetchOffers(args: FetchOffersArgs): Promise<ProviderOfferPage>;
  normalize(raw: unknown, source: Doc<"offer_sources">): NormalizedOfferInput[];
};

import { fetchCsvFeed, normalizeFeedRow } from "./feedUtils";
import type { OfferProvider } from "./providerTypes";

export const tradeTrackerProvider: OfferProvider = {
  key: "tradetracker",
  sourceType: "affiliate_network",
  async fetchOffers() {
    return { items: await fetchCsvFeed("TRADETRACKER_OFFERS_CSV_URL") };
  },
  normalize(raw, source) {
    return [normalizeFeedRow({ row: raw as Record<string, string>, source, fallbackProvider: "tradetracker" })];
  },
};

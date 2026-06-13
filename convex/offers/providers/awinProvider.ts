import { fetchCsvFeed, normalizeFeedRow } from "./feedUtils";
import type { OfferProvider } from "./providerTypes";

export const awinProvider: OfferProvider = {
  key: "awin",
  sourceType: "affiliate_network",
  async fetchOffers() {
    return { items: await fetchCsvFeed("AWIN_OFFERS_CSV_URL") };
  },
  normalize(raw, source) {
    return [normalizeFeedRow({ row: raw as Record<string, string>, source, fallbackProvider: "awin" })];
  },
};

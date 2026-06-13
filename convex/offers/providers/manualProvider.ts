import type { OfferProvider } from "./providerTypes";

export const manualProvider: OfferProvider = {
  key: "manual",
  sourceType: "manual",
  async fetchOffers() {
    return { items: [] };
  },
  normalize() {
    return [];
  },
};

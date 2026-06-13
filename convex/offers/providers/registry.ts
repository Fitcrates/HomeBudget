import type { OfferProvider } from "./providerTypes";
import { manualProvider } from "./manualProvider";
import { awinProvider } from "./awinProvider";
import { tradeTrackerProvider } from "./tradeTrackerProvider";

const providers: OfferProvider[] = [manualProvider, awinProvider, tradeTrackerProvider];

export function listProviders() {
  return providers;
}

export function getProvider(key: string) {
  const provider = providers.find((candidate) => candidate.key === key);
  if (!provider) throw new Error(`Offer provider not registered: ${key}`);
  return provider;
}

import type { AdProvider } from "../types";
import { rtbHouseProvider } from "./rtbHouseProvider";

const providers: AdProvider[] = [rtbHouseProvider];

export function getAdProvider(key: string) {
  const provider = providers.find((candidate) => candidate.key === key);
  if (!provider) throw new Error(`Ad provider not registered: ${key}`);
  return provider;
}

export function listAdProviders() {
  return providers;
}

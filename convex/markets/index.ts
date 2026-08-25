"use node";

import { MarketPack } from "./types";
import { PL_MARKET } from "./pl";
import { DE_MARKET } from "./de";
import { GENERIC_MARKET } from "./generic";

export type { MarketLexicon, MarketPack } from "./types";
export { GENERIC_MARKET } from "./generic";

const PACKS: Record<string, MarketPack> = {
  PL: PL_MARKET,
  DE: DE_MARKET,
};

/** Kraje z dedykowanym pakietem — reszta dostaje pakiet generyczny. */
export function supportedMarkets(): string[] {
  return Object.keys(PACKS);
}

export function getMarketPack(country: string | null | undefined): MarketPack {
  const code = (country ?? "").trim().toUpperCase();
  return PACKS[code] ?? GENERIC_MARKET;
}

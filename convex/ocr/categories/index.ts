"use node";

import { CategoryResolution, stripDiacritics } from "./constants";
import { detectIssuers } from "./issuers";
import { matchFood, matchFoodStandalone } from "./food";
import { matchHousehold, matchHouseholdStandalone } from "./household";
import { matchTransport } from "./transport";
import { matchHome, matchHomeStandalone } from "./home";
import { matchHealth, matchHealthStandalone } from "./health";
import { matchClothing, matchClothingStandalone } from "./clothing";
import { matchLifestyle } from "./lifestyle";
import { matchCommerce, matchCommerceStandalone } from "./commerce";
import { matchFamily, matchFamilyStandalone } from "./family";

// Re-export public API (used by parser.ts)
export { resolveCategoryNames, buildCompactCategoryList } from "./constants";

// ─── Cache ───────────────────────────────────────────────────────────────────
const heuristicCache = new Map<string, CategoryResolution | null>();
const HEURISTIC_CACHE_MAX_SIZE = 200;

function cacheResult(key: string, result: CategoryResolution | null): CategoryResolution | null {
  if (heuristicCache.size >= HEURISTIC_CACHE_MAX_SIZE) {
    const firstKey = heuristicCache.keys().next().value;
    if (firstKey) heuristicCache.delete(firstKey);
  }
  heuristicCache.set(key, result);
  return result;
}

// ─── Main orchestrator ───────────────────────────────────────────────────────
export function resolveHeuristicCategory(
  description: string,
  categoriesArray: any[],
  receiptContextText?: string
): CategoryResolution | null {
  const cacheKey = `${description}|${receiptContextText || ""}`;
  const cached = heuristicCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const text = stripDiacritics(description);
  const receiptContext = stripDiacritics(receiptContextText || "");
  const combinedContext = `${receiptContext} ${text}`.trim();
  const issuers = detectIssuers(receiptContext);

  // Priority order matters — more specific matches first
  const matchers = [
    // 1. Store-based matchers (high specificity)
    () => matchTransport(text, combinedContext, issuers, categoriesArray),
    () => matchHome(text, combinedContext, issuers, categoriesArray),
    () => matchLifestyle(text, combinedContext, issuers, categoriesArray),
    () => matchFamily(text, combinedContext, issuers, categoriesArray),
    () => matchHealth(text, combinedContext, issuers, categoriesArray),
    () => matchClothing(text, combinedContext, issuers, categoriesArray),
    () => matchCommerce(text, combinedContext, issuers, categoriesArray),
    () => matchFood(text, combinedContext, issuers, categoriesArray),
    () => matchHousehold(text, combinedContext, issuers, categoriesArray),
    // 2. Standalone matchers (fallback — no store context needed)
    () => matchFoodStandalone(text, categoriesArray),
    () => matchHouseholdStandalone(text, categoriesArray),
    () => matchHomeStandalone(text, categoriesArray),
    () => matchHealthStandalone(text, categoriesArray),
    () => matchClothingStandalone(text, categoriesArray),
    () => matchFamilyStandalone(text, categoriesArray),
    () => matchCommerceStandalone(text, categoriesArray),
  ];

  for (const matcher of matchers) {
    const result = matcher();
    if (result?.categoryId && result?.subcategoryId) {
      return cacheResult(cacheKey, result);
    }
  }

  return cacheResult(cacheKey, null);
}

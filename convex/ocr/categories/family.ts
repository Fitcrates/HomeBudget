"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Dzieci + Zwierzęta */
export function matchFamily(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isPetIssuer, isToyIssuer } = issuers;

  // ── Dzieci ──
  if (has(combinedContext, /\b(zlobek|przedszkole|opiekun dzienny)\b/i)) return resolve(CATEGORY.KIDS, SUB.zlobek, categoriesArray);
  if (isToyIssuer || has(combinedContext, /\b(zabawka|lalka|klocki|lego|pluszak|gra planszowa dla dzieci)\b/i)) return resolve(CATEGORY.KIDS, SUB.zabawki, categoriesArray);
  if (has(combinedContext, /\b(pieluch|chusteczki dla dzieci|mleko modyfikowane|smoczek|butelka dla niemowlat|kaszka|body dzieciece|wozek|fotelik)\b/i)) {
    if (has(combinedContext, /\b(pieluch|chusteczki|krem na odparzenia)\b/i)) return resolve(CATEGORY.KIDS, SUB.pieluchy, categoriesArray);
    return resolve(CATEGORY.KIDS, SUB.artykulyDzieciece, categoriesArray);
  }
  if (has(combinedContext, /\b(taniec|basen dla dzieci|robotyka|angielski dla dzieci|zajecia dodatkowe)\b/i)) return resolve(CATEGORY.KIDS, SUB.zajeciaDodatkowe, categoriesArray);

  // ── Zwierzęta ──
  if (isPetIssuer || has(text, /\b(karma|zwirek|weteryn|drapak|smycz|obroza|kuweta|miska|przysmak dla psa|przysmak dla kota)\b/i)) {
    if (has(combinedContext, /\b(weteryn|vet|szczepienie|badanie psa|badanie kota)\b/i)) return resolve(CATEGORY.PETS, SUB.weterynarz, categoriesArray);
    if (has(combinedContext, /\b(zwirek|kuweta|podklad higieniczny)\b/i)) return resolve(CATEGORY.PETS, SUB.zwirek, categoriesArray);
    if (has(combinedContext, /\b(karma|saszetka|puszka|sucha karma)\b/i)) return resolve(CATEGORY.PETS, SUB.karma, categoriesArray);
    if (has(combinedContext, /\b(grooming|strzyzenie psa|kąpiel psa|pielegnacja psa)\b/i)) return resolve(CATEGORY.PETS, SUB.grooming, categoriesArray);
    return resolve(CATEGORY.PETS, SUB.akcesoria, categoriesArray);
  }

  return null;
}

/** Standalone kids + pets matching */
export function matchFamilyStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(zabawk|lalka|klocki|lego|pluszak|gra planszowa|puzzle)\b/i)) return resolve(CATEGORY.KIDS, SUB.zabawki, categoriesArray);
  if (has(text, /\b(pieluch|mleko modyfikowane|smoczek|butelka dla niemowl|kaszka|wozek|fotelik)\b/i)) return resolve(CATEGORY.KIDS, SUB.artykulyDzieciece, categoriesArray);
  if (has(text, /\b(karma|saszetka|puszka|sucha karma|whiskas|felix|royal canin|purina|hills)\b/i)) return resolve(CATEGORY.PETS, SUB.karma, categoriesArray);
  if (has(text, /\b(drapak|smycz|obroza|kuweta|miska|przysmak dla psa|przysmak dla kota|legowisko)\b/i)) return resolve(CATEGORY.PETS, SUB.akcesoria, categoriesArray);
  if (has(text, /\b(zwirek|podklad higieniczny|cat litter)\b/i)) return resolve(CATEGORY.PETS, SUB.zwirek, categoriesArray);
  return null;
}

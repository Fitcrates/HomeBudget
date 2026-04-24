"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Chemia domowa i higiena */
export function matchHousehold(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isDrugstoreIssuer } = issuers;

  if (isDrugstoreIssuer && has(combinedContext, /\b(perfum|woda perfumowana|eau de parfum|zapach)\b/i)) return resolve(CATEGORY.HEALTH, SUB.perfumy, categoriesArray);
  if (isDrugstoreIssuer && has(combinedContext, /\b(podklad|tusz|pomadka|roz|eyeliner|makijaz)\b/i)) return resolve(CATEGORY.HEALTH, SUB.kosmetyki, categoriesArray);

  if (isDrugstoreIssuer || has(text, /\b(szampon|odzywk|zel pod prysznic|mydlo|pasta do zeb|szczoteczka|dezodorant|papier toaletowy|recznik papierowy|plyn do szyb|proszek do prania)\b/i)) {
    if (has(combinedContext, /\b(proszek|plyn do prania|kapsulki do prania|odplamiacz|plyn do plukania)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.pranie, categoriesArray);
    if (has(combinedContext, /\b(tabletki do zmywarki|plyn do naczyn|sol do zmywarki|nabyszczacz)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.zmywanie, categoriesArray);
    if (has(combinedContext, /\b(papier toaletowy|recznik papierowy|chusteczki higieniczne)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.papier, categoriesArray);
    if (has(combinedContext, /\b(kostka wc|zel wc|plyn do wc)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.wc, categoriesArray);
    if (has(combinedContext, /\b(odswiezacz|swieca zapachowa|patyczki zapachowe)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.odswiezacze, categoriesArray);
    if (has(combinedContext, /\b(pieluchy|chusteczki dla niemowlat|podklad do przewijania)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaDzieci, categoriesArray);
    if (has(combinedContext, /\b(podpaski|tampony|kubeczek menstruacyjny|wkladki higieniczne)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaIntymna, categoriesArray);
    if (has(combinedContext, /\b(szampon|mydlo|pasta do zeb|szczoteczka|dezodorant|maszynka do golenia)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaOsobista, categoriesArray);
    if (has(combinedContext, /\b(balsam|maslo do ciala|krem do rak|olejek do ciala)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.pielegnacjaCiala, categoriesArray);
    if (has(combinedContext, /\b(perfum|woda toaletowa|eau de parfum)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.perfumyZapachy, categoriesArray);
    if (has(combinedContext, /\b(tusz|pomadka|cien do powiek|podklad|puder|roz)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.kosmetykiMakijaz, categoriesArray);
    if (has(combinedContext, /\b(pletwa|mop|domestos|plyn do szyb|mleczko czyszczace|srodek czystosci|gabka)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.srodkiCzystosci, categoriesArray);
    return resolve(CATEGORY.HOUSEHOLD, SUB.higienaOsobista, categoriesArray);
  }

  return null;
}

/** Standalone household matching */
export function matchHouseholdStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(domestos|plyn do szyb|mleczko czyszcz|srodek czystosc|gabka|sciereczk|mop\b|ajax|cif\b|vanish)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.srodkiCzystosci, categoriesArray);
  if (has(text, /\b(proszek do pran|plyn do pran|kapsulki do pran|odplamiacz|plyn do plukan|pranie|lenor|persil|ariel)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.pranie, categoriesArray);
  if (has(text, /\b(tabletki do zmywar|plyn do naczyn|sol do zmywar|nabyszczacz|fairy|ludwik|finish|somat)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.zmywanie, categoriesArray);
  if (has(text, /\b(papier toalet|recznik papier|chusteczki higien|serwetk|velvet|foxy|regina)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.papier, categoriesArray);
  if (has(text, /\b(kostka wc|zel wc|plyn do wc|bref|duck|toaletow)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.wc, categoriesArray);
  if (has(text, /\b(odswiezacz|swieca zapach|patyczki zapach|air wick|glade|ambi pur)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.odswiezacze, categoriesArray);
  if (has(text, /\b(szampon|odzywk|zel pod prysznic|mydlo|pasta do zeb|szczoteczk|dezodoran|maszynka do golen|plyn do ust|nici dent|head.shoulders|dove|nivea|colgate|oral.b)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaOsobista, categoriesArray);
  if (has(text, /\b(balsam|maslo do ciala|krem do rak|olejek do ciala|peeling|scrub|lotion)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.pielegnacjaCiala, categoriesArray);
  if (has(text, /\b(tusz do rzes|pomadka|cien do powiek|podklad|puder|roz do policzk|eyeliner|makijaz|mascara|bronzer|korektor|concealer)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.kosmetykiMakijaz, categoriesArray);
  if (has(text, /\b(perfum|woda toaletowa|eau de parfum|eau de toilette|woda perfumowana)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.perfumyZapachy, categoriesArray);
  if (has(text, /\b(podpask|tampon|kubeczek menstruac|wkladki higien|always|ob\b|bella)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaIntymna, categoriesArray);
  if (has(text, /\b(pieluchy|pampers|huggies|chusteczki dla niemowl|podklad do przewij)\b/i)) return resolve(CATEGORY.HOUSEHOLD, SUB.higienaDzieci, categoriesArray);
  return null;
}

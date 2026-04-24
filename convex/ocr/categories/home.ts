"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags } from "./issuers";

/** Dom i mieszkanie */
export function matchHome(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isUtilityIssuer, isTelcoIssuer, isHomeIssuer } = issuers;

  if (has(combinedContext, /\b(czynsz|najem|oplata administracyjna|spoldzielnia|wspolnota mieszkaniowa)\b/i)) return resolve(CATEGORY.HOME, SUB.czynsz, categoriesArray);
  if (isUtilityIssuer && has(combinedContext, /\b(prad|energia|kwh|dystrybucja)\b/i)) return resolve(CATEGORY.HOME, SUB.prad, categoriesArray);
  if (isUtilityIssuer && has(combinedContext, /\b(gaz|pgnig)\b/i)) return resolve(CATEGORY.HOME, SUB.gaz, categoriesArray);
  if (isUtilityIssuer && has(combinedContext, /\b(woda|scieki|wodociagi)\b/i)) return resolve(CATEGORY.HOME, SUB.woda, categoriesArray);
  if (isTelcoIssuer && has(combinedContext, /\b(internet|swiatlowod|fiber|router|wifi)\b/i)) return resolve(CATEGORY.HOME, SUB.internet, categoriesArray);
  if (isTelcoIssuer || has(combinedContext, /\b(abonament|telefon|komorka|rozmowy|sms|starter|doladowanie)\b/i)) return resolve(CATEGORY.HOME, SUB.telefon, categoriesArray);

  if (isHomeIssuer || has(text, /\b(donicz|ziemia|nawoz|zarowka|mebel|poduszka|posciel|pojemnik|narzedz|wiert|mlotek|farba|pedzel|balkon|ogrod|garnek|patelnia|talerz|dekoracja)\b/i)) {
    if (has(combinedContext, /\b(donicz|ziemia|nawoz|balkon|ogrod|roslin|krzew|kwiat)\b/i)) return resolve(CATEGORY.HOME, SUB.ogrod, categoriesArray);
    if (has(combinedContext, /\b(narzedz|wiert|mlotek|farba|pedzel|remont|kabel|silikon|plytka)\b/i)) return resolve(CATEGORY.HOME, SUB.remonty, categoriesArray);
    if (has(combinedContext, /\b(garnek|patelnia|miska|talerz|kubek|noz kuchenny|deska do krojenia)\b/i)) return resolve(CATEGORY.HOME, SUB.kuchnia, categoriesArray);
    if (has(combinedContext, /\b(ramka|swiecznik|plakat|poduszka dekoracyjna|zaslona)\b/i)) return resolve(CATEGORY.HOME, SUB.dekoracje, categoriesArray);
    if (has(combinedContext, /\b(mebel|krzeslo|stol|komoda|lampa|polka|szafa)\b/i)) return resolve(CATEGORY.HOME, SUB.wyposazenie, categoriesArray);
    return resolve(CATEGORY.HOME, SUB.wyposazenie, categoriesArray);
  }

  return null;
}

/** Standalone home matching */
export function matchHomeStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(donicz|ziemia|nawoz|roslin|kwiat|krzew|sadzonk|nasion|traw|sekator|konewk)\b/i)) return resolve(CATEGORY.HOME, SUB.ogrod, categoriesArray);
  if (has(text, /\b(narzedz|wiert|mlotek|farba|pedzel|remont|kabel|silikon|plytk|szpachl|gwozdz|srub|wiertark|wkret|tasma)\b/i)) return resolve(CATEGORY.HOME, SUB.remonty, categoriesArray);
  if (has(text, /\b(garnek|patelni|miska|talerz|kubek|noz kuchenn|deska do krojen|lyzka|widelec|szklank|termos)\b/i)) return resolve(CATEGORY.HOME, SUB.kuchnia, categoriesArray);
  if (has(text, /\b(ramka|swiecznik|plakat|poduszka dekorac|zaslona|firanka|obraz|wazon|dywan)\b/i)) return resolve(CATEGORY.HOME, SUB.dekoracje, categoriesArray);
  if (has(text, /\b(mebel|krzeslo|stol|komoda|lampa|polka|szafa|lozko|materac|fotel|biurko|zarowk|gniazdko|kontakt)\b/i)) return resolve(CATEGORY.HOME, SUB.wyposazenie, categoriesArray);
  if (has(text, /\b(sprzatan|mop\b|odkurzacz|scierka|wiaderko|zmiotka)\b/i)) return resolve(CATEGORY.HOME, SUB.sprzatanie, categoriesArray);
  return null;
}

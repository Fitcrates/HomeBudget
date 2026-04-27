"use node";

import { CategoryResolution, CATEGORY, SUB, has, resolve } from "./constants";
import { IssuerFlags, isBusinessSaaSLine } from "./issuers";

/** Finanse + Zakupy online + Praca i biznes + Inne */
export function matchCommerce(text: string, combinedContext: string, issuers: IssuerFlags, categoriesArray: any[]): CategoryResolution | null {
  const { isMarketplaceIssuer, isElectronicsIssuer, isBusinessIssuer, isBankOrInsuranceIssuer } = issuers;

  // ── SaaS (highest priority for cloud receipts) ──
  if (isBusinessSaaSLine(text, combinedContext)) return resolve(CATEGORY.BUSINESS, SUB.saas, categoriesArray);

  // ── Online / Marketplace ──
  if (isMarketplaceIssuer || isElectronicsIssuer || has(combinedContext, /\b(kurier|przesylka|shipping|shipment|marketplace)\b/i)) {
    if (has(combinedContext, /\b(koszt dostawy|przesylka|dostawa|kurier|paczkomat)\b/i)) return resolve(CATEGORY.ONLINE, SUB.dostawa, categoriesArray);
    if (isElectronicsIssuer || has(combinedContext, /\b(sluchawki|laptop|monitor|telefon komorkowy|smartfon|tablet|klawiatura|myszka|drukarka|pendrive|kabel usb|ladowark|powerbank|smartwatch)\b/i)) return resolve(CATEGORY.ONLINE, SUB.elektronika, categoriesArray);
    if (has(combinedContext, /\b(ksiazka|ebook|film|plyta|gra|komiks|audiobook)\b/i)) return resolve(CATEGORY.ONLINE, SUB.ksiazkiMedia, categoriesArray);
    if (has(combinedContext, /\b(krem|kosmetyki|szampon|perfumy|serum|tonik|makijaz)\b/i)) return resolve(CATEGORY.ONLINE, SUB.urodaOnline, categoriesArray);
    if (has(combinedContext, /\b(meble|garnek|posciel|narzedzia|doniczka|lampka|dywan|zaslona|ogrod)\b/i)) return resolve(CATEGORY.ONLINE, SUB.domOgrod, categoriesArray);
    return resolve(CATEGORY.ONLINE, SUB.marketplace, categoriesArray);
  }

  // ── Business ──
  if (isBusinessIssuer) {
    if (has(combinedContext, /\b(delegacja|nocleg sluzbowy|podroz sluzbowa|dieta delegacyjna)\b/i)) return resolve(CATEGORY.BUSINESS, SUB.delegacje, categoriesArray);
    if (has(combinedContext, /\b(ksiegowosc|biuro rachunkowe|vat|pit|faktura ksiegowa)\b/i)) return resolve(CATEGORY.BUSINESS, SUB.ksiegowosc, categoriesArray);
    if (has(combinedContext, /\b(papier|segregator|dlugopis|zeszyt firmowy|tusz do drukarki)\b/i)) return resolve(CATEGORY.BUSINESS, SUB.biuroMaterialy, categoriesArray);
    if (has(combinedContext, /\b(printer|monitor biurowy|krzeslo biurowe|sprzet biurowy|laptop firmowy)\b/i)) return resolve(CATEGORY.BUSINESS, SUB.biuroSprzet, categoriesArray);
  }

  // ── Finance ──
  const looksLikeFinanceLine = has(text, /\b(prowizja|oplata bankowa|oplata za konto|ubezpieczenie|podatek|mandat skarbowy|rata|kredyt|pozyczka|leasing|skladka)\b/i);
  if (looksLikeFinanceLine || (isBankOrInsuranceIssuer && has(text, /\b(oplata|prowizja|ubezpieczenie|podatek|rata|kredyt|pozyczka|leasing|skladka)\b/i))) {
    if (has(text, /\b(podatek|pit|cit|vat|urzad skarbowy)\b/i)) return resolve(CATEGORY.FINANCE, SUB.podatki, categoriesArray);
    if (has(text, /\b(rata|kredyt|pozyczka|leasing)\b/i)) return resolve(CATEGORY.FINANCE, SUB.kredyt, categoriesArray);
    if (has(text, /\b(oszczednosci|lokata)\b/i)) return resolve(CATEGORY.FINANCE, SUB.oszczednosci, categoriesArray);
    if (has(text, /\b(inwest|fundusz|broker)\b/i)) return resolve(CATEGORY.FINANCE, SUB.inwestycje, categoriesArray);
    if (has(text, /\b(ubezpieczenie|skladka)\b/i)) return resolve(CATEGORY.FINANCE, SUB.ubezpieczenie, categoriesArray);
    return resolve(CATEGORY.FINANCE, SUB.bank, categoriesArray);
  }

  // ── Other ──
  if (has(combinedContext, /\b(kwiat|bukiet|swieca zapachowa|prezent|voucher prezentowy)\b/i)) return resolve(CATEGORY.OTHER, SUB.prezenty, categoriesArray);
  if (has(combinedContext, /\b(darowizna|fundacja|zbiorka|wplata charytatywna)\b/i)) return resolve(CATEGORY.OTHER, SUB.darowizny, categoriesArray);

  return null;
}

/** Standalone electronics matching */
export function matchCommerceStandalone(text: string, categoriesArray: any[]): CategoryResolution | null {
  if (has(text, /\b(sluchawk|laptop|monitor|telefon komork|smartfon|tablet|klawiatur|myszk|drukark|pendrive|kabel usb|ladowark|powerbank|smartwatch|router|dysk ssd|karta pamieci)\b/i)) return resolve(CATEGORY.ONLINE, SUB.elektronika, categoriesArray);
  return null;
}

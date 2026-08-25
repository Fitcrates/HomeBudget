"use node";

import { MarketPack } from "./types";

/**
 * Pakiet awaryjny dla kraju bez wlasnego pakietu. Slownictwo angielskie i
 * miedzynarodowe — celowo waskie, bo lepiej nie rozpoznac linii technicznej niz
 * uznac produkt za smiec. Pipeline dziala, po prostu wiecej zostaje modelowi
 * i mapowaniom uzytkownika.
 */
export const GENERIC_MARKET: MarketPack = {
  country: "XX",
  defaultCurrency: "EUR",
  lexicon: {
    discount: /\b(?:discount|coupon|voucher|promo|promotion|rebate|markdown|saving|savings|minus)\b/i,
    discountLine: /^(?:discount|voucher|coupon)\s+(.+?)\s+(-?\d+[.,]\d{2})$/i,
    deposit: /\b(?:deposit|bottle deposit|container deposit|drs)\b/i,
    technical: /\b(?:subtotal|sub total|total|amount due|balance|change due|cash|card|payment|tender|vat|tax|receipt|invoice|thank you)\b/i,
    stopWords: [
      "discount",
      "coupon",
      "voucher",
      "promo",
      "promotion",
      "loyalty",
      "member",
      "card",
      "receipt",
      "minus",
    ],
  },
  promptHints: [
    'totalAmount is the goods total, usually printed as "TOTAL" or "SUBTOTAL".',
    'payableAmount is the final amount to pay, printed as "TOTAL" or "AMOUNT DUE".',
    "Discount and voucher lines are separate negative items, never subtracted from the product price.",
    "Deposits on bottles or containers go to depositTotal, never to items.",
  ],
  auditLines: [
    "RECEIPT AUDIT. Perform a second, strict read of the suspicious receipts only.",
    "Transcribe product and discount lines VERBATIM from the image, especially quantity patterns.",
    "CRITICAL RULES:",
    '1. DISCOUNTS: always a separate negative item (amount: "-X.XX").',
    "2. NEVER subtract a discount from the product. The product keeps its original price.",
    "3. NEVER merge adjacent discounts into one line.",
    "4. DUPLICATES: two physical rows with the same product means two separate objects.",
    "5. CLEAN NAMES: strip tax letters and quantity prefixes.",
    "In audit.productLines return EVERY product line in receipt order, before categorisation. That field matters more than items.",
  ],
};

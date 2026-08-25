"use node";

import { MarketPack } from "./types";

/**
 * Niemcy. Drugi rynek — sluzy tez jako dowod, ze pipeline nie ma wiedzy o
 * kraju wbudowanej na stale.
 */
export const DE_MARKET: MarketPack = {
  country: "DE",
  defaultCurrency: "EUR",
  lexicon: {
    discount: /\b(?:rabatt|sofortrabatt|nachlass|gutschein|coupon|aktion|ersparnis|preisvorteil|minus)/i,
    discountLine: /^(?:rabatt|nachlass)\s+(.+?)\s+(-?\d+[.,]\d{2})$/i,
    deposit: /\b(?:pfand|leergut|mehrweg|einweg|dpg)/i,
    technical: /\b(?:ust|ustg|mwst|bar|netto|brutto|geg)\b|\b(?:summe|zwischensumme|gesamt|zu zahlen|rueckgeld|steuer|karte|kartenzahlung|ec.cash|girocard|beleg|kassenbon|rechnung|vielen dank|danke)/i,
    stopWords: [
      "rabatt",
      "nachlass",
      "gutschein",
      "aktion",
      "coupon",
      "karte",
      "kundenkarte",
      "kunde",
      "bon",
      "beleg",
      "minus",
    ],
  },
  promptHints: [
    'totalAmount is the goods total printed as "SUMME", "GESAMT" or "ZU ZAHLEN".',
    'depositTotal is the sum of "PFAND" / "LEERGUT" lines — a deposit is never a product item.',
    'Discount lines are printed as "RABATT", "NACHLASS", "AKTION" or "GUTSCHEIN" — each is its own negative item.',
    'Tax markers ("A", "B", "MwSt", "USt") trail product names and must be stripped.',
    'Returned empty bottles ("Leergut") appear as negative lines that are deposits, not product discounts.',
  ],
  auditLines: [
    "RECEIPT AUDIT. Perform a second, strict read of the suspicious receipts only.",
    "Transcribe product and discount lines VERBATIM from the image, especially patterns like:",
    '- "3 x 9,99 29,97" -> one item, amount = "29.97"',
    '- "1,234 kg x 12,99  16,03" -> one item, amount = "16.03" (line total, NOT price per kg)',
    '- "RABATT ... -9,98" -> separate item, amount = "-9.98"',
    "- several discount lines under one product -> several separate negative items, never merged",
    '- "PFAND 0,25" -> depositTotal, not an item',
    '- "SUMME" / "ZU ZAHLEN" -> totalAmount / payableAmount',
    "CRITICAL RULES:",
    '1. DISCOUNTS: always a separate negative item (amount: "-X.XX").',
    "2. NEVER subtract a discount from the product. The product keeps its original price.",
    "3. NEVER merge adjacent discounts into one line.",
    "4. DUPLICATES: two physical rows with the same product means two separate objects.",
    "5. CLEAN NAMES: strip tax markers (A, B, MwSt) and quantity prefixes.",
    "In audit.productLines return EVERY product line in receipt order, before categorisation. That field matters more than items.",
  ],
};

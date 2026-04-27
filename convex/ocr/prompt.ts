"use node";

// Tier 1: fast, low-cost vision extraction model.
export const VISION_MODEL = "gemini-2.5-flash-lite";
// Tier 2: stronger model used only for targeted recovery when totals are materially wrong.
export const VISION_MODEL_SMART = "gemini-2.5-pro";

export const SYSTEM_PROMPT = `You are an expert OCR for reading receipts and invoices.
Extract EVERY visible product line. Never skip items. Return valid JSON only.`;

// Extraction only. Category assignment is done locally in parser.ts using
// user mappings, deterministic heuristics, and a final local fallback.
export const EXTRACTION_PROMPT = `Extract ALL items from receipt image(s).
For each item provide: description and amount (TOTAL line price, not unit price).

RULES:
- If "2 x 4.99" then amount = "9.98" (multiply)
- If "1.234 kg x 12.99" then amount = price shown NEXT to it (NOT per kg)
- Discounts as separate line with NEGATIVE amount (e.g., "OPUST -2.00" -> amount: "-2.00")
- Deposits/kaucja as depositTotal, NOT as item
- Clean names: remove quantity (2x, 1.5kg x), unit prices, VAT letters (A,B,C,D)
- totalAmount = value printed on receipt as goods total / SUMA PLN / RAZEM. Do NOT invent it from recognized items.
- If the image is only a fragment and no printed goods total is visible, set totalAmount = "".
- payableAmount = final amount to pay printed on receipt (may include deposits). Leave empty if not visible.
- depositTotal = printed sum of deposits/kaucja. Leave empty if not visible.
- For multiple images of the same long receipt, use all images together and return one receipt with sourceImageIndex per item when possible.

Works in: Polish, English, German, Czech, Slovak.

Return ONLY valid JSON:
{
  "rawText": "Store name and date",
  "currency": "PLN",
  "totalAmount": "83.99",
  "payableAmount": "84.99",
  "depositTotal": "1.00",
  "receiptCount": 1,
  "receipts": [{
    "receiptIndex": 0,
    "receiptLabel": "Store 2026-04-11",
    "sourceImageIndex": 1,
    "totalAmount": "83.99",
    "payableAmount": "84.99",
    "depositTotal": "1.00",
    "items": [{
      "description": "Product name",
      "amount": "9.99"
    }]
  }]
}`;

export function buildPrompt(_compactCategories: string, documentText?: string): string {
  if (documentText) {
    return `Extract ALL items from the following receipt text.

${documentText}

${EXTRACTION_PROMPT}`;
  }
  return EXTRACTION_PROMPT;
}

export function buildAuditPrompt(
  _compactCategories: string,
  previousJson: string,
  suspiciousDuplicateReceipts: number[]
): string {
  return [
    "AUDYT PARAGONU. Wykonaj drugi, rygorystyczny odczyt TYLKO dla podejrzanych paragonow.",
    "Przeczytaj z obrazu DOSLOWNIE linie produktowe i rabatowe, szczegolnie wzorce typu:",
    '- "3 x 9,99 29,97" -> jedna pozycja, amount = "29.97"',
    '- "1,234 kg x 12,99  16,03" -> jedna pozycja, amount = "16.03" (laczna cena, NIE cena za kg)',
    '- "OPUST ... -9,98" -> osobna pozycja, amount = "-9.98"',
    '- "SUMA PLN 83,99"',
    '- "KAUCJA ... 1,00" -> depositTotal, nie item',
    '- "DO ZAPLATY 84,99" -> payableAmount',
    "ZASADY KRYTYCZNE:",
    "1. RABATY: Rabat musi byc ZAWSZE oddzielna pozycja z minusem (amount: \"-X.XX\").",
    "2. NIE ODEJMUJ rabatu od produktu. Produkt zawsze ma swoja pierwotna, pelna cene.",
    "3. CENA PO RABACIE: W sklepach typu Biedronka pod kwota rabatu bywa nadrukowana 'cena po rabacie'. ZIGNORUJ JA CALKOWICIE.",
    "4. DUPLIKATY: Jesli na paragonie widzisz dwa osobne, fizyczne wiersze z tym samym produktem, zwroc 2 oddzielne obiekty. Nie lacz ich w jeden.",
    "5. OCZYSZCZANIE NAZW: Usun z nazw produktow litery VAT (A, B, C, D) i dopiski ilosciowe (np. 1x, 0.405 kg x).",
    "Nie wolno zgadywac nazw z innych domen.",
    "W polu audit.productLines zwroc KAZDA linie produktowa w KOLEJNOSCI z paragonu, przed kategoryzacja. To pole jest wazniejsze niz zwykle items.",
    "",
    `Podejrzane paragony (indeksy 1-based): ${suspiciousDuplicateReceipts.length > 0 ? suspiciousDuplicateReceipts.map((idx) => idx + 1).join(", ") : "brak, ale suma nadal sie nie zgadza"}.`,
    "Poprzedni JSON do korekty:",
    previousJson,
    "",
    "Zwroc TYLKO poprawny JSON zgodny z glownym schematem oraz dodatkowo pole audit:",
    `{ "audit": { "transcribedLines": ["doslowna linia 1", "doslowna linia 2"], "productLines": [{ "description": "Nep. 04'2026 piwo", "quantityText": "2 x 9,99", "total": "19.98" }] }, "rawText": "Lidl 2026-04-11", "currency": "PLN", "totalAmount": "83.99", "payableAmount": "84.99", "depositTotal": "1.00", "receiptCount": 1, "receipts": [] }`,
  ].join("\n");
}

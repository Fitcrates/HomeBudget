"use node";

// Tier 1: Szybki model do ekstrakcji OCR (wizja → JSON). Używany w ~80-90% scanów.
export const VISION_MODEL = "gemini-2.5-flash-lite";
// Tier 2: Model z myśleniem do korekty i audytu. Używany TYLKO gdy Tier 1 wykryje rozbieżności.
export const VISION_MODEL_SMART = "gemini-2.5-pro";

export const SYSTEM_PROMPT = `You are an expert OCR for reading receipts and invoices.
Extract EVERY product. Never skip items. Return valid JSON only.`;

// Uproszczony prompt ekstrakcyjny - tylko ekstrakcja, bez kategoryzacji
// Kategoryzacja odbywa się w kodzie (parser.ts + categories.ts)
export const EXTRACTION_PROMPT = `Extract ALL items from receipt image(s).
For each item provide: description, amount (TOTAL price, not unit price), category, subcategory.

RULES:
- If "2 x 4.99" then amount = "9.98" (multiply)
- If "1.234 kg x 12.99" then amount = price shown NEXT to it (NOT per kg)
- Discounts as separate line with NEGATIVE amount (e.g., "OPUST -2.00" -> amount: "-2.00")
- Deposits/kaucja as depositTotal, NOT as item
- Clean names: remove quantity (2x, 1.5kg x), unit prices, VAT letters (A,B,C,D)
- totalAmount = sum of items (including negative discounts)
- payableAmount = final amount to pay (may include deposits)
- depositTotal = sum of deposits/kaucja
- category and subcategory MUST be chosen from the CATEGORIES list below
- Match the EXACT category and subcategory names from the list

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
      "amount": "9.99",
      "category": "Żywność i napoje",
      "subcategory": "Supermarket"
    }]
  }]
}`;

export function buildPrompt(compactCategories: string, documentText?: string): string {
  const categoryBlock = compactCategories
    ? `\n\nCATEGORIES:\n${compactCategories}`
    : '';

  if (documentText) {
    return `Extract ALL items from the following receipt text.
    
${documentText}

${EXTRACTION_PROMPT}${categoryBlock}`;
  }
  return `${EXTRACTION_PROMPT}${categoryBlock}`;
}


export function buildAuditPrompt(
  compactCategories: string,
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
    "3. CENA PO RABACIE: W sklepach typu Biedronka pod kwota rabatu bywa nadrukowana 'cena po rabacie'. ZIGNORUJ JA CALKOWICIE. Nie wpisuj jej jako produktu ani nie podmieniaj ceny bazowej.",
    "4. DUPLIKATY: Jesli na paragonie widzisz dwa osobne, fizyczne wiersze z tym samym produktem, zwroc 2 oddzielne obiekty. Nie lacz ich w jeden.",
    "5. OCZYSZCZANIE NAZW: Usun z nazw produktow litery VAT (A, B, C, D) i dopiski ilosciowe (np. 1x, 0.405 kg x).",
    "Nie wolno zgadywac nazw z innych domen. Jesli to rachunek za serwery (np. AWS, Vercel), mapuj Memory/Network do Praca i biznes -> Narzedzia / SaaS. Nie myl z paliwem.",
    "Krzew/roslina/kwiat ma byc kategoryzowany do Dom i mieszkanie -> Ogrod i balkon lub zblizonej podkategorii domowej, a nie do zywnosci.",
    "Jesli wystawca to usluga cloud/backend/SaaS (np. Railway, Vercel, AWS, Supabase), to pozycje typu Memory, vCPU, Disk, Network, Pro plan, requests, seats maja trafic do Praca i biznes -> Narzedzia / SaaS.",
    "Nie wolno klasyfikowac oplat cloudowych do Transport/Paliwo przez skojarzenie ze slowem Railway albo Network.",
    "W polu audit.productLines zwroc KAZDA linie produktowa w KOLEJNOSCI z paragonu, przed kategoryzacja. To pole jest wazniejsze niz zwykle items.",
    "Dla kazdej linii produktowej podaj co najmniej description i total. Przyklad: Nep. 04'2026 piwo -> 19.98, Surowka 300g -> 6.98, Calcium Wit. D tabl. -> 5.59.",
    "",
    `Podejrzane paragony (indeksy 1-based): ${suspiciousDuplicateReceipts.length > 0 ? suspiciousDuplicateReceipts.map((idx) => idx + 1).join(", ") : "brak, ale suma nadal sie nie zgadza"}.`,
    "Poprzedni JSON do korekty:",
    previousJson,
    "",
    "Zwroc TYLKO poprawny JSON zgodny z glownym schematem oraz dodatkowo pole audit:",
    `{ "audit": { "transcribedLines": ["doslowna linia 1", "doslowna linia 2"], "productLines": [{ "description": "Nep. 04'2026 piwo", "quantityText": "2 x 9,99", "total": "19.98" }, { "description": "Surowka 300g", "quantityText": "2 x 3,49", "total": "6.98" }] }, "rawText": "Lidl 2026-04-11", "currency": "PLN", "totalAmount": "83.99", "payableAmount": "84.99", "depositTotal": "1.00", "receiptCount": 1, "receipts": [] }`,
    "",
    "KATEGORIE:",
    compactCategories,
  ].join("\n");
}

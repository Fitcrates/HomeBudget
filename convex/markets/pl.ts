"use node";

import { MarketPack } from "./types";

/**
 * Polska. Leksykon przeniesiony 1:1 z `ocr/normalization.ts` i `ocr/utils.ts`,
 * zeby zmiana byla czysto strukturalna — trafnosc dla polskich paragonow ma
 * pozostac identyczna.
 */
export const PL_MARKET: MarketPack = {
  country: "PL",
  defaultCurrency: "PLN",
  lexicon: {
    discount: /(rabat|opust|kupon|coupon|bonifikat|znizk|obnizk|taniej|minus|przecen)/i,
    discountLine: /^opust\s+(.+?)\s+(-?\d+[.,]\d{2})$/i,
    deposit: /(kaucj|opakowan(?:ie|ia)?\s+zwrotn|zwrotn(?:a|e)?\s+(?:butelk|puszk|opakowan))/i,
    technical: /\b(?:suma|sumy|karta|karty|ptu|nip|adres)\b|\b(?:podsuma|sprzedaz|rozliczen|platnosc|gotowk|paragon|fiskaln|zaoszczedzono|wykorzystane kupony|miejsce zakupu|dziekujemy)/i,
    stopWords: [
      "rabat",
      "promocja",
      "promocji",
      "opust",
      "kupon",
      "aplikacja",
      "aplikacji",
      "program",
      "klienta",
      "karta",
      "minus",
      "znizka",
      "bonifikata",
      "paragon",
    ],
  },
  promptHints: [
    'totalAmount is the goods total printed as "SUMA PLN" or "RAZEM".',
    'payableAmount is printed as "DO ZAPLATY". depositTotal is printed as "KAUCJA".',
    'Discount lines are printed as "RABAT", "OPUST" or a loyalty voucher (e.g. "Lidl Plus voucher") — each is its own negative item.',
    'Lidl receipts print "Z Lidl Plus zaoszczedzono ..." and "Wykorzystane kupony" summaries after payment. Use them only as validation hints, never as items.',
    'Biedronka prints a "cena po rabacie" line under the discount. Ignore that line completely — the product keeps its original price.',
    "VAT letters (A, B, C, D) trail product names and must be stripped.",
  ],
  auditLines: [
    "AUDYT PARAGONU. Wykonaj drugi, rygorystyczny odczyt TYLKO dla podejrzanych paragonow.",
    "Przeczytaj z obrazu DOSLOWNIE linie produktowe i rabatowe, szczegolnie wzorce typu:",
    '- "3 x 9,99 29,97" -> jedna pozycja, amount = "29.97"',
    '- "1,234 kg x 12,99  16,03" -> jedna pozycja, amount = "16.03" (laczna cena, NIE cena za kg)',
    '- "OPUST ... -9,98" -> osobna pozycja, amount = "-9.98"',
    "- kilka kolejnych rabatow pod jednym produktem -> kilka osobnych pozycji ujemnych, NIE jeden scalony rabat",
    '- "Z Lidl Plus zaoszczedzono 20,00 zl" i "Wykorzystane kupony" -> tylko walidacja, NIE pozycje paragonu',
    '- "SUMA PLN 83,99"',
    '- "KAUCJA ... 1,00" -> depositTotal, nie item',
    '- "DO ZAPLATY 84,99" -> payableAmount',
    "ZASADY KRYTYCZNE:",
    '1. RABATY: Rabat musi byc ZAWSZE oddzielna pozycja z minusem (amount: "-X.XX").',
    "2. NIE ODEJMUJ rabatu od produktu. Produkt zawsze ma swoja pierwotna, pelna cene.",
    "3. NIE LACZ SASIADUJACYCH RABATOW: np. 'Rabat grupowy -11,19' oraz 'Lidl Plus voucher -1,89' to dwie oddzielne pozycje.",
    "4. CENA PO RABACIE: W sklepach typu Biedronka pod kwota rabatu bywa nadrukowana 'cena po rabacie'. ZIGNORUJ JA CALKOWICIE.",
    "5. DUPLIKATY: Jesli na paragonie widzisz dwa osobne, fizyczne wiersze z tym samym produktem, zwroc 2 oddzielne obiekty. Nie lacz ich w jeden.",
    "6. OCZYSZCZANIE NAZW: Usun z nazw produktow litery VAT (A, B, C, D) i dopiski ilosciowe (np. 1x, 0.405 kg x).",
    "Nie wolno zgadywac nazw z innych domen.",
    "W polu audit.productLines zwroc KAZDA linie produktowa w KOLEJNOSCI z paragonu, przed kategoryzacja. To pole jest wazniejsze niz zwykle items.",
  ],
};

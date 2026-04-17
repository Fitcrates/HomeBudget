"use node";

export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export const SYSTEM_PROMPT = `Jesteś ekspertem OCR do odczytu polskich paragonów i faktur.
Wyodrębniasz KAŻDY produkt. Rozumiesz polskie skróty paragonowe.
Nigdy nie pomijasz pozycji. Zwracasz JSON.`;

export function buildPrompt(compactCategories: string, documentText?: string): string {
  const source = documentText
    ? `Tekst dokumentu:\n"""\n${documentText}\n"""\n\n`
    : "";

  return `Wyodrebnij WSZYSTKIE pozycje zakupowe z ${documentText ? "tekstu" : "obrazu/obrazow"}.
${source}ZASADY:
1. Kazdy produkt - nie pomijaj zadnej pozycji.
2. Czytaj wartosc laczna pozycji, nie cene jednostkowa.
3. Rabat/Opust/Promocja/Kupon musi byc uwzgledniony w finalnej cenie pozycji.
4. Jesli rabat jest pokazany jako osobna linia, mozesz zwrocic go jako osobna pozycje z ujemna kwota zamiast wciskac go w pierwszy produkt.
5. Ilosc >1 -> LACZNA wartosc (np. 3x2.50 = "7.50").
6. Kaucje za opakowania zwrotne NIE sa zwyklymi produktami. Nie dodawaj ich do items, ale zwroc je osobno jako depositTotal.
7. Jesli widzisz zarowno "SUMA PLN"/"Podsuma" jak i "DO ZAPLATY", to:
- totalAmount = suma towarow po rabatach, bez kaucji i bez platnosci
- payableAmount = koncowa kwota do zaplaty
- depositTotal = suma kaucji / opakowan zwrotnych
- items musza sumowac sie do totalAmount, nie do payableAmount
8. Ignoruj naglowki, PTU, platnosci karta/gotowka, rozliczenie platnosci i inne linie techniczne.
9. Jesli na przeslanych obrazach sa rozne paragony, rozdziel je do osobnych grup.

DOPASOWANIE KATEGORII DO WYSTAWCY:
- Najpierw zidentyfikuj sklep lub wystawce rachunku.
- Biedronka, Lidl, Auchan, Kaufland, Zabka, Dino, Netto, Carrefour, Stokrotka: pozycje to zwykle "Zywnosc i napoje" albo "Chemia domowa i higiena".
- Kawiarnie i cukiernie (np. Starbucks, Costa, Green Caffe Nero, lokalne cafe/cukiernia): kawa, herbata, ciasto, deser, croissant, kanapka, lemoniada -> "Restauracje i kawiarnie" / "Kawiarnia", a nie "Zywnosc i napoje".
- Restauracje, bary i bistro: dania oraz napoje kupione do spozycia -> "Restauracje i kawiarnie".
- Pizzerie: pizza -> "Restauracje i kawiarnie" / "Pizza".
- Sushi bary: sushi, maki, nigiri -> "Restauracje i kawiarnie" / "Sushi".
- Fast food (McDonald's, KFC, Burger King, Subway, kebab): zestawy, frytki, burgery, wrapy -> "Restauracje i kawiarnie" / "Fast food".
- Rossmann, Hebe, Super-Pharm, Sephora, Douglas: zwykle "Zdrowie i uroda".
- Castorama, Leroy Merlin, OBI, Jysk, IKEA, Agata Meble: zwykle "Dom i mieszkanie".
- Orlen, BP, Shell, Circle K, Amic, Moya, Lotos: paliwo -> "Transport" / "Paliwo".
- Apteki (DOZ, Gemini, Ziko, Cefarm, Dr.Max): leki i suplementy -> "Zdrowie i uroda" / "Apteka".
- Sklepy zoologiczne: domyslnie "Zwierzeta".
- Dostawcy backendu, hostingu, chmury i narzedzi dla developerow (np. Railway, Vercel, Render, AWS, Google Cloud, Azure, DigitalOcean, Supabase, Cloudflare, OpenAI): pozycje typu Pro plan, Memory, vCPU, Disk, Network, bandwidth, requests, storage, seats -> "Praca i biznes" / "Narzedzia / SaaS".
- Nie wolno mapowac technicznych oplat cloudowych do "Transport" / "Paliwo" tylko dlatego, ze wystawca ma w nazwie np. "Railway" albo pozycja ma slowo "Network".

KATEGORYZACJA SZCZEGOLOWA:
- Jajka, mleko, ser, maslo, jogurt -> "Nabial i jaja"
- Mieso, parowki, szynka, kurczak -> "Mieso i wedliny"
- Owoce, warzywa, ziemniaki -> "Owoce i warzywa"
- Chleb, bulki -> "Piekarnia"
- Makaron, ryz, maka, kasza -> "Produkty sypkie"
- Czekolada, chipsy, cukierki -> "Slodycze i przekaski"
- Woda, sok, cola -> "Napoje bezalkoholowe"
- Kawa ziarnista, kawa mielona i herbata z marketu -> "Kawa i herbata"
- Espresso, americano, latte, cappuccino, herbata, ciasto, deser kupione w kawiarni -> "Restauracje i kawiarnie" / "Kawiarnia"
- Burger, frytki, wrap, kebab, zestaw -> "Restauracje i kawiarnie" / "Fast food"
- Pizza -> "Restauracje i kawiarnie" / "Pizza"
- Sushi, maki, nigiri -> "Restauracje i kawiarnie" / "Sushi"
- Piwo, wino, wodka -> "Alkohol"
- Czystosc (plyny, proszki, papier toaletowy) -> "Chemia domowa i higiena"

KATEGORIE:
${compactCategories}

JSON:
{
  "rawText": "Tylko marka/sklep i data, np. 'Lidl 2026-04-11'",
  "currency": "PLN",
  "totalAmount": "Suma towarow po rabatach, bez kaucji, np. '83.99'",
  "payableAmount": "Kwota do zaplaty, jesli wystepuje, np. '84.99'",
  "depositTotal": "Suma kaucji, jesli wystepuje, np. '1.00'",
  "receiptCount": 1,
  "receipts": [
    {
      "receiptIndex": 0,
      "receiptLabel": "Lidl 2026-04-11",
      "sourceImageIndex": 1,
      "totalAmount": "83.99",
      "payableAmount": "84.99",
      "depositTotal": "1.00",
      "items": [
        {
          "description": "Nazwa produktu",
          "amount": "12.98",
          "category": "Zywnosc i napoje",
          "subcategory": "Nabial i jaja"
        }
      ]
    }
  ],
  "items": [
    {
      "description": "Nazwa produktu",
      "amount": "12.98",
      "category": "Zywnosc i napoje",
      "subcategory": "Nabial i jaja"
    }
  ]
}`;
}

export function buildAuditPrompt(
  compactCategories: string,
  previousJson: string,
  suspiciousDuplicateReceipts: number[]
): string {
  return [
    "AUDYT PARAGONU.",
    "Wykonaj drugi, rygorystyczny odczyt TYLKO dla pozycji podejrzanych.",
    "Najpierw przeczytaj z obrazu DOSLOWNIE linie produktowe i rabatowe, szczegolnie wzorce typu:",
    '- "3 x 9,99 29,97"',
    '- "OPUST ... -9,98"',
    '- "SUMA PLN 83,99"',
    '- "KAUCJA ... 1,00"',
    '- "DO ZAPLATY 84,99"',
    "Nie wolno zgadywac nazw z innych domen. Jesli na paragonie jest piwo, nie wolno zwracac nawozu.",
    "Jedna linia ilosciowa ma dac jedna pozycje JSON z laczna kwota po uwzglednieniu rabatu.",
    "Jesli rabat jest pokazany jako osobna linia koncowa lub globalna, mozesz zwrocic go jako osobna pozycje z ujemna kwota.",
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

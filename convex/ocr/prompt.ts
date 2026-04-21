"use node";

export const VISION_MODEL = "gemini-2.5-flash";

export const SYSTEM_PROMPT = `Jesteś ekspertem OCR do odczytu polskich paragonów i faktur.
Wyodrębniasz KAŻDY produkt. Rozumiesz polskie skróty paragonowe.
Nigdy nie pomijasz pozycji. Zwracasz JSON.`;

export function buildPrompt(compactCategories: string, documentText?: string): string {
  const source = documentText
    ? `Tekst dokumentu:\n"""\n${documentText}\n"""\n\n`
    : "";

  return `Wyodrebnij WSZYSTKIE pozycje zakupowe z ${documentText ? "tekstu" : "obrazu/obrazow"}.
${source}ZASADY:
1. Kazdy produkt - nie pomijaj zadnej pozycji. Jesli paragon jest dluzszy niz widoczny na jednym zdjeciu, produkty z kazdego zdjecia musza byc uwzglednione.
2. CENA: Zawsze podawaj LACZNA cene pozycji - to co klient zaplaci za dana pozycje. NIE podawaj ceny jednostkowej.
   - Jesli jest np. "2 x 4,99" to amount = "9.98" (iloczyn).
   - Jesli jest waga np. "1,234 kg x 12,99 PLN/kg" to amount = to kwota OBOK, np. "16.03", a nie 12.99.
   - Jesli pod produktem jest linia typu "1,500 x 9,99" z kwota "14,99" obok, to amount = "14.99".
3. RABAT/OPUST/PRZECENA:
   - Jesli rabat jest pokazany jako osobna linia (np. "OPUST -2,00" lub "RABAT BIEDRONKA -1,50"), zwroc go jako OSOBNA pozycje z UJEMNA kwota (np. amount: "-2.00").
   - NIE odejmuj rabatu od ceny produktu powyzej. Produkt ma miec swoja pelna cene, rabat idzie jako oddzielna linia.
   - Jesli pod kwota rabatu wydrukowana jest nowa "cena po rabacie" (np. w Biedronce), IGNORUJ ja - nie tworz z niej osobnego produktu i nie zastepuj nia pierwotnej ceny.
   - Opis rabatu powinien zawierac nazwe produktu, jesli jest widoczna (np. "Rabat: Mleko").
4. KAUCJE za opakowania zwrotne NIE sa zwyklymi produktami. Nie dodawaj ich do items. Zwroc je jako depositTotal.
5. DUPLIKATY: Jesli na paragonie sa fizycznie 2 OSOBNE wiersze z identycznym produktem (np. Mleko i ponizej znowu Mleko), zwroc je jako 2 oddzielne obiekty JSON. NIE lacz ich w jedna pozycje (np. 2x 11.98), chyba ze to fizycznie jeden wiersz z mnoznikiem.
6. NAZWY PRODUKTOW: Wyczysc nazwy z mnoznikow (np. "2x", "1,500 kg x"), cen jednostkowych oraz liter VAT (A, B, C, D, E, F, G) na koncu nazwy.
7. SUMY:
   - totalAmount = suma towarow (items musza sie do tego sumowac, wlaczajac ujemne rabaty)
   - payableAmount = koncowa kwota do zaplaty (moze byc wieksza przez kaucje)
   - depositTotal = suma kaucji / opakowan zwrotnych
8. Ignoruj naglowki, PTU, platnosci karta/gotowka, NIP, adres, "PARAGON FISKALNY", rozliczenie platnosci.
9. Jesli na przeslanych obrazach sa ROZNE paragony, rozdziel je do osobnych grup.
10. ZDJECIA NA ZAKLADKE: Jesli jedno zdjecie to kontynuacja poprzedniego, polacz produkty. NIE duplikuj wierszy ktore sa na "zakladce" (tym samym fizycznym fragmencie papieru widocznym na 2 zdjeciach). Ale pamietaj o regule nr 5!

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

Zwroc WYLACZNIE poprawny JSON (bez komentarzy, bez tekstu przed/po):
{
  "rawText": "Sklep i data, np. 'Lidl 2026-04-11'",
  "currency": "PLN",
  "totalAmount": "Suma towarow po rabatach, bez kaucji",
  "payableAmount": "Kwota do zaplaty (z kaucjami)",
  "depositTotal": "Suma kaucji",
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
          "description": "Mleko 3.2% 1L",
          "amount": "3.49",
          "category": "Zywnosc i napoje",
          "subcategory": "Nabial i jaja"
        },
        {
          "description": "Rabat: Mleko 3.2%",
          "amount": "-0.50",
          "category": "Zywnosc i napoje",
          "subcategory": "Nabial i jaja"
        }
      ]
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

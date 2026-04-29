# OCR category and multi-image strategy - 2026-04-27/28

## Pytanie

Czy przekazanie listy kategorii do Gemini zwieksza zuzycie tokenow?

Tak. Lista kategorii w promptcie zwieksza liczbe tokenow wejscia. Nie zwieksza natomiast liczby wywolan AI, bo kategoria jest zwracana w tym samym OCR callu, ktory i tak odczytuje paragon.

## Dlaczego zostalo to przywrocone

Bez listy kategorii model nie ma stabilnego slownika kategorii. Wtedy `resolvedFromAiCategoryCount` pozostaje blisko zera, a caly proces opiera sie na:

1. historii korekt uzytkownika,
2. lokalnych heurystykach,
3. fallbacku `Inne / Rozne`.

To jest tanie, ale przy niepelnych heurystykach daje duzo fallbackow.

Obecny kompromis jest taki: jeden szybki call `gemini-2.5-flash-lite` nadal wykonuje OCR, ale dodatkowo dostaje backendowo zbudowany, kompaktowy katalog kategorii. Parser traktuje wynik AI tylko jako jedna z warstw, a nie jako prawde absolutna.

## Aktualny priorytet kategoryzacji

Priorytet w `convex/ocr/parser.ts` jest nastepujacy:

1. `mapping` - historia recznych korekt uzytkownika.
2. `ai` - kategoria i podkategoria zwrocona przez Gemini, dopasowana do katalogu przez `resolveCategoryNames`.
3. `heuristic` - lokalne reguly w `convex/ocr/categories/*`.
4. `fallback` - ostatnia deska ratunku, zwykle `Inne / Rozne`.

Mapping ma najwyzszy priorytet i przerywa dalsza kategoryzacje danej pozycji. Heurystyki uruchamiaja sie po AI i moga wypelnic brak kategorii albo nadpisac generyczne rozstrzygniecia.

## Rola heurystyk

Heurystyki sa docelowo mechanizmem obnizania kosztu AI. Im lepsze heurystyki, tym mniej potrzebujemy polegac na tym, ze model dostanie pelny katalog kategorii.

Heurystyki sa szczegolnie dobre dla:

- popularnych nazw produktow z paragonow,
- marek i skrotow sklepowych,
- kontekstu sprzedawcy, np. Lidl/Biedronka/Rossmann/Orlen,
- kategorii z jednoznacznymi slowami, np. `mleko`, `papier toaletowy`, `karma`, `pb95`, `pieluchy`.

Heurystyki sa slabsze dla:

- bardzo skroconych nazw OCR,
- nietypowych marek bez nazwy rodzaju produktu,
- produktow wieloznacznych, np. `miska` dla kuchni albo zwierzat,
- nowych sklepow i nowych domen zakupow.

## Docelowy kierunek optymalizacji kosztu

Najlepsza sciezka kosztowa to stopniowe przesuwanie kategoryzacji z AI do lokalnych warstw:

1. Rozwijac heurystyki dla najczestszych produktow i sklepow.
2. Uczyc sie tylko z recznych korekt uzytkownika przez `product_mappings`.
3. Monitorowac `categorySource` w logach/UI.
4. Gdy fallbacki spadna do akceptowalnego poziomu, rozwazyc tryb oszczedny:
   - OCR prompt bez pelnej listy kategorii,
   - lokalna kategoryzacja mapping + heurystyki,
   - opcjonalny tani classifier tylko dla pozycji, ktore nadal trafily do fallbacku.

## Co mierzyc po zmianach

Najwazniejsze metryki z runtime logow:

- `mappedFromHistoryCount` - powinno rosnac z czasem po korektach uzytkownika.
- `resolvedFromAiCategoryCount` - pokazuje, ile pozycji skorzystalo z kategorii z modelu.
- `resolvedByHeuristicCount` - pokazuje realny wklad lokalnych regul.
- liczba pozycji z `categorySource: "fallback"` - powinna spadac.
- `promptLength` - kontrola kosztu tokenow po dodaniu katalogu kategorii.

## Update 2026-04-28 - multi-image i fallbacki

Po testach na paragonach dzielonych na 2 zdjecia okazalo sie, ze single-image potrafi kategoryzowac dobrze, ale multi-image nadal zostawia duzo pozycji jako fallback. Problem nie byl tylko w promptcie, ale w sposobie oceny jakosci wyniku.

### Diagnoza

1. `fallback` ma technicznie `categoryId` i `subcategoryId`, zwykle `Inne / Rozne`.
2. W metrykach jakosci taki item byl liczony jako "skategoryzowany", bo sprawdzano glownie istnienie ID.
3. Przez to wynik `combined` z dwoch zdjec nie byl preferowany tylko dlatego, ze mial mniej fallbackow.
4. Per-image OCR moze tracic kontekst sklepu na drugim zdjeciu dlugiego paragonu, wiec heurystyki mialy mniej informacji niz przy pojedynczym pelnym zdjeciu.

### Zmiany w kodzie

W `convex/ocr.ts`:

1. `summarizeResultQuality` nie liczy juz `categorySource: "fallback"` jako dobrej kategorii.
2. Dodano `fallbackCount` i `categoryQualityScore`.
3. `shouldPreferRecoveryCandidate` preferuje teraz wynik z mniejsza liczba fallbackow albo lepszym score kategorii, o ile nie pogarsza rozliczenia sum.
4. Po scaleniu per-image wynikow `upgradeFallbackCategoriesWithCombinedContext` ponownie uruchamia lokalne heurystyki dla fallbackow, ale juz z pelnym kontekstem scalonego paragonu.
5. Jesli istnieje wynik `combined`, `upgradeFallbackCategoriesFromCandidate` przepisuje kategorie z combined do per-image merge tylko wtedy, gdy pozycja pasuje jednoznacznie po `normalized description + amount` i zrodlo kategorii nie jest fallbackiem.

W `convex/ocr/parser.ts`:

1. `categorizedCount` oznacza teraz pozycje z realnym zrodlem kategorii: `mapping`, `ai`, `heuristic` albo `discount`.
2. `fallbackCount` i `unresolvedCount` pokazuja realna liczbe pozycji wymagajacych poprawy.

### Wplyw na koszt AI

Zmiana nie dodaje nowego wywolania AI. Wykorzystuje:

1. juz istniejacy rownolegly `combined` cross-check dla wielu zdjec,
2. lokalne heurystyki,
3. bezpieczne przepisywanie kategorii z lepszego kandydata.

To jest zgodne z kierunkiem optymalizacji kosztow: wiecej deterministycznej logiki, mniej dodatkowych requestow AI.

### Nowe metryki do obserwacji

W logach warto szczegolnie patrzec na:

- `fallbackCount`,
- `categoryQualityScore`,
- `upgradedWithCombinedContext`,
- `upgradedFromCombined`,
- `mergedFallbackCount`,
- `combinedFallbackCount`.

### Weryfikacja 2026-04-28

Po zmianach przeszly:

- `npm exec tsc -- -p convex --noEmit --pretty false`,
- `npm exec tsc -- -p . --noEmit --pretty false`,
- `node scripts/ocr-regression-check.mjs`.

## Update 2026-04-29 - fast path + background queue

Z punktu widzenia UX czekanie 18-25s na provider OCR jest zbyt dlugie. Flow zostal rozdzielony:

1. Frontend wywoluje `processReceiptFastOrQueue`.
2. Backend probuje szybkiej analizy z krotszym timeoutem (`10625ms` dla pojedynczego obrazu, `11875ms` dla multi-image).
3. Jesli wynik zdazy w fast path, UI pokazuje zwykly ekran korekty OCR.
4. Jesli provider jest wolny, zwroci blad albo przekroczy szybki limit, backend zapisuje skan jako pending i uruchamia `processQueuedReceiptScan` w tle.
5. Pending skan trafia do istniejacej kolejki sprawdzania, a UI informuje uzytkownika, zeby zachowal papierowy paragon do audytu.

To zmienia blad providera z blokujacego spinnera w stan biznesowy: "przetwarza sie w tle / do sprawdzenia". Zdjecia nie sa wtedy kasowane przez discard flow, bo sa potrzebne do pozniejszej weryfikacji.

## Update 2026-04-29 - suspicious fast-path results

Testy na paragonach Lidl pokazaly, ze szybki fallback vision moze zwrocic formalny JSON, ale z bledem wierszy:

1. cena piwa zostala przypisana do granoli, a sama granola 6.99 zniknela z pozycji,
2. rabaty/vouchery Lidl Plus zostaly pominiete, przez co suma pozycji byla wyzsza niz suma towarow.

Zmiana decyzji:

1. Fast path nie uzywa juz synchronicznego fallbacku providerow. Jesli Gemini nie miesci sie w szybkim limicie, skan od razu trafia do kolejki.
2. Wynik fast path z niezgodna suma paragonu nie jest juz traktowany jako sukces. Trafia do background recovery/audit.
3. Background OCR ma wlaczone recovery i audit dla pojedynczych obrazow, wiec moze uzyc wolniejszej analizy bez trzymania uzytkownika na spinnerze.
4. Prompt doprecyzowuje vouchery Lidl Plus jako osobne ujemne pozycje i zakazuje przypisywania ceny z sasiedniego wiersza do poprzedniego produktu.

## Update 2026-04-29 - queue visibility and fast-path tuning

Po testach lokalnych kolejka dzialala backendowo, ale UI nie dawalo jasnej drogi do wyniku. Dodano bezposredni przycisk "Otworz kolejke" po zakolejkowaniu skanu i osobny ekran `reviewQueue` w `MainApp`, ktory otwiera istniejaca kolejke sprawdzania.

Fast path zostal wydluzony o 25%:

- single image: `8500ms` -> `10625ms`,
- multi-image: `9500ms` -> `11875ms`.

Dodatkowo fast path nie kieruje juz do kolejki przy kazdej roznicy powyzej 0.05 PLN. Drobne roznice do `max(1 PLN, 1% sumy paragonu)` moga przejsc do normalnej korekty UI, a materialne roznice nadal trafiaja do background recovery/audit.

## Update 2026-04-29 - szybki 503 i reczny review

Test z 18:04 pokazal, ze Gemini potrafi zwrocic `503 ServiceUnavailable` po ok. 3 sekundach. To nie powinno od razu przerzucac uzytkownika do kolejki, bo fast path ma miec realne okno probowania, a nie konczyc sie na pierwszym szybkim bledzie providera.

Zmiany:

1. Fast path ma minimalne okno `10000ms` dla bledow retriable. Szybki `503` dostaje kolejna probe Gemini bez synchronicznego fallbacku do Groq.
2. Jezeli pierwsza proba po prostu przekroczy szybki limit, nie dokladamy drugiego dlugiego oczekiwania w UI. Wtedy skan trafia do kolejki.
3. Ekran kolejki pozwala teraz obsluzyc rowniez skany `failed` albo skany bez pozycji: mozna otworzyc zalacznik, dodac pozycje recznie, ustawic kategorie i zatwierdzic wydatek.
4. Przycisk zatwierdzania w kolejce nie blokuje juz failed OCR tylko dlatego, ze automatyczny parser nie zwrocil pozycji. Warunkiem jest co najmniej jedna recznie/automatycznie wpisana pozycja z opisem, kategoria i kwota inna niz 0.

Wniosek z paragonu bez widocznej nazwy sklepu: brak sprzedawcy pogarsza kategoryzacje i heurystyki, ale nie powinien blokowac OCR linii. Jesli model mimo to nie zwroci wyniku, system ma teraz bezpieczny tryb manualnego review zamiast martwego pendingu.

## Wniosek

Tak, lista kategorii w promptcie kosztuje dodatkowe tokeny. Zostala przywrocona jako szybka poprawa jakosci bez dokladania kolejnego calla AI. Dlugofalowo nalezy rozwijac heurystyki i baze mappingow, bo to one sa najtanszym sposobem ograniczania fallbackow.

Dla wielu zdjec jednego paragonu dodatkowo trzeba pilnowac, zeby `fallback` nie byl traktowany jako sukces kategoryzacji. Multi-image powinien wykorzystywac combined context i combined cross-check do naprawy kategorii, ale bez podmieniania calego OCR, jesli bezpieczniej jest poprawic tylko fallbacki.

## Update 2026-04-29 - provider fallback i rabaty

Logi z 2026-04-29 pokazaly dwa osobne problemy:

1. Google Gemini zwracal `503 ServiceUnavailable` albo przekraczal lokalny timeout `18000ms`. Kod mial `maxAttempts: 1`, a mimo zmiennej `GROQ_API_KEY` nie mial aktywnego fallbacku do Groq. W efekcie pojedynczy problem dostawcy konczyl sie `all_failed`.
2. Rabaty byly tworzone przed kategoryzacja produktow, a pozniejsze dopinanie szukalo najlepszego produktu w calym paragonie. Przy dlugim paragonie moglo to przypisac rabat do innego produktu niz wiersz bezposrednio nad rabatem.

Zmiany:

1. `convex/ocr/groq.ts` ma teraz fallback do Groq przez OpenAI-compatible endpoint, gdy Gemini zwroci blad retriable/timeout/503. Domyslny model fallbacku to `meta-llama/llama-4-scout-17b-16e-instruct`, z mozliwoscia nadpisania przez `GROQ_VISION_MODEL`.
2. `convex/ocr/parser.ts` przy rabacie najpierw kopiuje kategorie z bezposrednio poprzedzajacego produktu w tym samym paragonie. Dopiero gdy nie ma takiego produktu, uzywa starszego wyszukiwania kandydata.
3. Konkretna heurystyka moze teraz nadpisac kategorie z AI, jezeli AI zwrocilo formalnie poprawna, ale slabsza/inna kategorie. Generyczne heurystyki typu supermarket/dyskont nadal nie powinny nadpisywac szczegolowych rozstrzygniec.

Po zmianach przeszly:

- `npm exec tsc -- -p convex --noEmit --pretty false`,
- `npm exec tsc -- -p . --noEmit --pretty false`,
- `node scripts/ocr-regression-check.mjs`.

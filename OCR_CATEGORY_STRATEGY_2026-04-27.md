# OCR category strategy - 2026-04-27

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

## Wniosek

Tak, lista kategorii w promptcie kosztuje dodatkowe tokeny. Zostala przywrocona jako szybka poprawa jakosci bez dokladania kolejnego calla AI. Dlugofalowo nalezy rozwijac heurystyki i baze mappingow, bo to one sa najtanszym sposobem ograniczania fallbackow.

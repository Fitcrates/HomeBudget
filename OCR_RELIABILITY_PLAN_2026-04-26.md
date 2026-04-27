# OCR Reliability Plan - 2026-04-26

## Cel

Ustabilizowac flagowy flow OCR po regresjach z kategorii, czasu przetwarzania i pracy na wielu zdjeciach jednego paragonu.

## Diagnoza startowa

1. Kategorie po refaktorze trafiaja w zle domeny, np. zywnosc jako `Dom i mieszkanie` albo `Finanse / Oplaty bankowe`.
2. Dwa zdjecia paragonu uruchamiaja kosztowny lancuch: per-image OCR -> merge -> recovery -> retry Pro, co daje ok. 30s.
3. Bez zapisu kosztow mappingi produktow nie sa zapisywane, ale uploady/skan moga zostac jako porzucona operacja.
4. Prompt miesza role sum: `totalAmount` jest opisane jako suma rozpoznanych pozycji, a powinno byc wartoscia odczytana z paragonu.
5. Recovery potrafi zaakceptowac wynik nadal rozjechany z suma, jesli jest "mniej zly" niz merge.

## Plan zmian

- [x] Naprawic zbyt szerokie heurystyki issuerow i finansow.
- [x] Zmienic priorytet heurystyk tak, by rozpoznany sklep spozywczy wygrywal z home/finance.
- [x] Dodac zrodlo kategorii do itemow, zeby UI moglo rozroznic heurystyke, historie i fallback.
- [x] Ograniczyc learning loop do pozycji faktycznie poprawionych przez uzytkownika.
- [x] Dodac discard OCR: porzucone uploady maja byc usuwane, a brak zapisu nie moze tworzyc bazy wiedzy.
- [x] Skrocic flow 2 zdjec do maksymalnie jednego szybkiego combined recovery, bez Pro w sciezce synchronicznej.
- [x] Zaostrzyc akceptacje recovery i zachowac mismatch jako stan wymagajacy poprawy.
- [x] Poprawic prompt dla sum i czesciowych zdjec.
- [x] Dodac statyczny regression check dla najgrozniejszych regresji kategorii.
- [x] Uruchomic TypeScript/build na koniec.

## Log prac

- 2026-04-26: Start. Utworzono plan po analizie logow z 14:49 i kodu `convex/ocr*`.
- 2026-04-26: Naprawiono falszywe issuery:
  - `action` wymaga teraz granic slowa, wiec `transaction` nie robi z paragonu sklepu Action.
  - `visa/mastercard` usunieto z issuerow bankowych, bo to sa linie platnosci na zwyklych paragonach.
  - finanse wymagaja teraz finansowej tresci pozycji, a nie samego kontekstu terminala.
- 2026-04-26: Zmieniono kolejnosc heurystyk: food/household sa przed commerce/home, zeby paragon spozywczy nie byl przejmowany przez zbyt ogolne matchery.
- 2026-04-26: Dodano `categorySource` (`mapping`, `ai`, `heuristic`, `fallback`, `discount`) do itemow OCR.
- 2026-04-26: Learning loop zapisuje mapping tylko wtedy, gdy uzytkownik zmienil opis/kategorie/podkategorie wzgledem wyniku OCR.
- 2026-04-26: Dodano `discardReceiptUploads` i podpiecie pod wyjscie z ekranu OCR bez zapisu. Po zapisie discard nie usuwa zdjec, bo sa referencja kosztu.
- 2026-04-26: Usunieto trwaly zapis `ocr_logs` z samego skanu. Porzucony OCR zostawia tylko runtime logi Convex, a nie dane aplikacyjne ani mappingi.
- 2026-04-26: Dla wielu zdjec dodano rownolegly combined cross-check bez Pro-retry. Koniec z sekwencja per-image -> recovery -> Pro timeout.
- 2026-04-26: Prompt nie kaze juz liczyc `totalAmount` z rozpoznanych itemow; suma ma byc odczytana z paragonu albo pusta, jesli fragment jej nie pokazuje.
- 2026-04-26: Mismatch pozostaje w `receiptSummaries` i nadal blokuje cache po stronie frontu. Cross-check moze wybrac lepszy wynik, ale nie oznacza go jako poprawiony retry ani nie maskuje rozjazdu sum.
- 2026-04-26: Dodano `scripts/ocr-regression-check.mjs`, ktory pilnuje:
  - `action` nie wraca jako szeroki substring,
  - `visa/mastercard` nie robia z paragonu finansow,
  - food matcher jest przed finance/home,
  - finance wymaga finansowej tresci pozycji.

## Weryfikacja

- `npm exec tsc -- -p convex --noEmit --pretty false` - OK.
- `npm exec tsc -- -p . --noEmit --pretty false` - OK.
- `node scripts/ocr-regression-check.mjs` - OK.
- `npm run build` - OK poza sandboxem. W sandboxie esbuild zatrzymal sie na `spawn EPERM`, tak jak w poprzedniej iteracji; po eskalacji build przeszedl.

## Podsumowanie koncowe

Zmieniono flow tak, zeby bledne kategorie po refaktorze nie wynikaly z przypadkowych slow terminala platniczego ani substringow. `transaction` nie uruchomi juz sklepu Action, a `Visa/Mastercard` nie uruchomia finansow. Heurystyki spozywcze maja teraz pierwszenstwo przed finance/home.

Latency dla dwoch zdjec nie powinna juz wchodzic w okolice 30s, bo usunieto sekwencyjny etap recovery -> `gemini-2.5-pro` timeout. Dla wielu zdjec dziala rownolegly fast combined cross-check plus per-image cross-check, bez drogiego synchronicznego Pro.

Learning loop nie utrwala juz automatycznie blednych kategorii. Mapping zapisuje sie tylko wtedy, gdy po OCR uzytkownik faktycznie zmieni opis/kategorie/podkategorie i zapisze koszt. Wyjscie z OCR bez zapisu wywoluje discard uploadow, a sam skan nie zapisuje juz trwalego rekordu `ocr_logs`.

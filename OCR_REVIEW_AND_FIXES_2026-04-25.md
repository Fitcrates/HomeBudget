# OCR Review and Fixes - 2026-04-25

## Cel

Najwazniejsza funkcjonalnosc aplikacji to szybki i dokladny OCR paragonow przy mozliwie niskim koszcie AI. Priorytety:

1. Dokladne ceny i sumy.
2. Stabilne kategorie bez pustych pol.
3. Minimalne uzycie AI i brak drogich, niekontrolowanych retry.
4. Bezpieczne uzycie kategorii przypisanych do gospodarstwa domowego.

## Co bylo zepsute

### 1. Timeouty Gemini trwaly ponad 2 minuty

OCR startowal z bardzo wysokim `max_tokens: 65536`, a klient AI wykonywal do 4 prob po 30 sekund. W logach dawalo to wynik typu `0 items in 129349ms`.

Naprawa:
- szybki OCR ma `8192` tokenow i timeout `9000ms`,
- recovery/audyt ma `16384` tokenow i timeout `16000ms`,
- glowne wywolania OCR maja `maxAttempts: 1`, zeby przeciążony model nie blokowal procesu przez minuty.

Pliki:
- `convex/ocr.ts`
- `convex/ocr/groq.ts`

### 2. Walidacja sum byla maskowana po merge

Po polaczeniu wynikow z wielu obrazow kod ustawial `totalAmount` na sume rozpoznanych pozycji. To oznaczalo, ze walidacja porownywala wynik z samym soba i mogla pokazywac `ok`, mimo ze OCR pominal pozycje.

Naprawa:
- merge zachowuje odczytane sumy z paragonow,
- fallback do sumy pozycji jest uzywany tylko wtedy, gdy model nie odczytal zadnej sumy,
- recovery odpala sie, gdy realna suma z paragonu rozjezdza sie z suma pozycji.

Plik:
- `convex/ocr.ts`

### 3. AI vision niepotrzebnie kategoryzowalo pozycje

Prompt wysylal pelna liste kategorii do modelu vision i kazal mu przypisywac `category/subcategory`. To zwiekszalo prompt, koszt, czas odpowiedzi i niestabilnosc.

Naprawa:
- prompt vision sluzy tylko do ekstrakcji: opis, kwota, sumy, rabaty, kaucje,
- kategoryzacja odbywa sie lokalnie: mapping uzytkownika -> heurystyki -> fallback `Inne / Rozne`,
- kategorie nie sa juz przekazywane z frontendu do action OCR.

Pliki:
- `convex/ocr/prompt.ts`
- `convex/ocr/parser.ts`
- `convex/ocr.ts`
- `src/components/screens/OcrScreen.tsx`

### 4. Puste wyniki mogly byc cache'owane jako sukces

Gdy wszystkie obrazy failowaly, backend zwracal pusty wynik. Front mogl zapisac `0 items` do cache.

Naprawa:
- backend rzuca blad, gdy wszystkie obrazy failuja,
- frontend cache'uje tylko wyniki z pozycjami,
- frontend nie cache'uje wynikow z mismatch w `receiptSummaries`.

Pliki:
- `convex/ocr.ts`
- `src/components/screens/OcrScreen.tsx`

### 5. Kategorie byly przekazywane z klienta

`processReceiptWithAI` przyjmowal `categories: v.any()` z UI. To zwiekszalo payload i ufalo danym z klienta.

Naprawa:
- action OCR pobiera kategorie po stronie Convex przez `listForHouseholdInternal`,
- frontend nie przesyla kategorii do OCR.

Pliki:
- `convex/ocr.ts`
- `src/components/screens/OcrScreen.tsx`

### 6. Brakowalo walidacji wlasnosci kategorii

Mutacje kategorii i zapis wydatkow nie sprawdzaly wystarczajaco, czy kategoria/podkategoria nalezy do danego gospodarstwa i czy podkategoria nalezy do wybranej kategorii.

Naprawa:
- `categories.ts` sprawdza wlasnosc przy update/delete oraz przy tworzeniu podkategorii,
- listowanie subkategorii systemowych filtruje custom subkategorie po `householdId`,
- `expenses.ts` waliduje `categoryId/subcategoryId` przed zapisem i aktualizacja,
- `productMappings.ts` waliduje kategorie przed zapisaniem mappingu.

Pliki:
- `convex/categories.ts`
- `convex/expenses.ts`
- `convex/productMappings.ts`

### 7. Learning loop robil wiele pojedynczych mutacji

Po zapisaniu OCR frontend wywolywal `upsertMapping` osobno dla kazdej pozycji.

Naprawa:
- dodano `upsertMappingsBatch`,
- frontend zapisuje mappingi jednym wywolaniem.

Pliki:
- `convex/productMappings.ts`
- `src/components/screens/OcrScreen.tsx`

### 8. Front kompresowal obrazy zbyt agresywnie

Upload OCR zmniejszal obraz do `1200px` i WebP `0.70`, co moglo pogarszac odczyt drobnych cen.

Naprawa:
- podniesiono limit do `1800px`,
- WebP quality podniesiono do `0.82`.

Plik:
- `src/lib/ocrUpload.ts`

### 9. Regexy rabatow/kaucji byly za szerokie

Pozytywne pozycje z tekstem typu `karta`, `program`, `aplikacja` mogly byc traktowane jak rabat. Produkty z `puszka/butelka` mogly byc pomijane jako kaucja.

Naprawa:
- rabaty wykrywane sa po bardziej jednoznacznych slowach,
- kaucja wymaga kontekstu `kaucja`, `opakowanie zwrotne` albo `zwrotna butelka/puszka`.

Plik:
- `convex/ocr/normalization.ts`

## Nowy przeplyw OCR

1. Front przygotowuje obraz w wyzszej jakosci.
2. Backend pobiera kategorie dla gospodarstwa.
3. Gemini vision odczytuje tylko dane paragonu: pozycje, kwoty, sumy, rabaty, kaucje.
4. Parser normalizuje kwoty i usuwa kaucje z pozycji.
5. Kategorie sa przypisywane lokalnie:
   - historia korekt uzytkownika,
   - kategoria AI, jesli model mimo wszystko ja zwroci,
   - heurystyki lokalne,
   - fallback `Inne / Rozne`.
6. Walidacja porownuje sume pozycji z realna suma z paragonu.
7. Recovery AI odpala sie tylko przy istotnym mismatch.
8. Front cache'uje tylko niepuste wyniki bez mismatch.
9. Przy zapisie wydatkow walidowane sa kategorie i mappingi.

## Self-review po zmianach

Sprawdzone ryzyka:

- Prompt vision nie zawiera juz listy kategorii.
- `processReceiptWithAI` nie przyjmuje kategorii z klienta.
- Pusty OCR nie jest zwracany jako sukces.
- Cache nie zapisuje pustych ani rozjechanych wynikow.
- Merge nie ustawia juz `totalAmount` na sume rozpoznanych pozycji, jesli model odczytal sume paragonu.
- Kazda pozycja powinna miec kategorie dzieki lokalnemu fallbackowi.
- Mutacje kategorii i zapis wydatkow waliduja wlasnosc kategorii/podkategorii.
- Mappingi produktu sa zapisywane batchowo i walidowane.

## Weryfikacja

Uruchomione:

```bash
npm exec tsc -- -p convex --noEmit --pretty false
npm exec tsc -- -p . --noEmit --pretty false
npm run build
```

Wynik:

- oba polecenia TypeScript przechodza bez bledow,
- `npm run build` przechodzi poza sandboxem,
- build w sandboxie zatrzymuje sie na `spawn EPERM` z esbuild, czyli na ograniczeniu srodowiska, nie na bledzie kodu.

## Dalsze usprawnienia

1. Dodac testy jednostkowe dla:
   - merge wielu obrazow,
   - rabatow,
   - kaucji,
   - fallbacku kategorii,
   - cache pustych wynikow.
2. Rozwazyc tani text-only classifier tylko dla pozycji, ktore trafily do fallbacku `Inne / Rozne`.
3. Dodac metryki:
   - ile pozycji trafilo z mappingu,
   - ile z heurystyk,
   - ile do fallbacku,
   - ile razy recovery realnie poprawilo mismatch.

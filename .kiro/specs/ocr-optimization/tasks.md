# OCR Optimization - Zadania implementacyjne

## Status zadań

- [x] 1. Uproszczony prompt ekstrakcyjny
- [x] 2. Równoległe przetwarzanie obrazów (NAPRAWIONO - pełna implementacja)
- [x] 3. Inteligentne retry (NAPRAWIONO - uproszczona logika)
- [x] 4. Wykrywanie używanej odzieży
- [x] 5. Priorytetyzacja learning (usageCount)
- [x] 6. Dodatkowe naprawy (input validation, timeout, cache)
- [ ] 7. Testy i weryfikacja

---

## Zadanie 1: Uproszczony prompt ekstrakcyjny

**Lokalizacja:** `convex/ocr/prompt.ts`

**Opis:** Zastąpić obecny prompt (~2000 znaków) uproszczonym promptem ekstrakcyjnym (~500 znaków)

**Kroki:**
1. Stworzyć nowy prompt `EXTRACTION_PROMPT` z prostymi zasadami ekstrakcji
2. Zachować wielojęzyczność (PL, EN, DE)
3. Usunąć z prompu instrukcje kategoryzacji (będą w kodzie)
4. Zachować `SYSTEM_PROMPT` bez zmian

**Kryterium akceptacji:** Prompt ma <600 znaków, zachowuje wielojęzyczność

---

## Zadanie 2: Równoległe przetwarzanie obrazów

**Lokalizacja:** `convex/ocr.ts` - funkcja `processImagesWithAI`

**Opis:** Zmienić przetwarzanie z jednego batcha na równoległe per-obraz

**Kroki:**
1. Zmienić wywołanie `analyzeBatch(imageDataList, ...)` na `Promise.all` per-obraz
2. Dla każdego obrazu: `enableRecoveryPasses: false` (proste przypadki)
3. Po przetworzeniu wszystkich: lokalne merge wyników przez `mergeBatchResults`
4. Zachować fallback do per-image jeśli combined zwróci 0 items

**Kryterium akceptacji:** 2 zdjęcia przetwarzają się równolegle, czas <10s

---

## Zadanie 3: Inteligentne retry

**Lokalizacja:** `convex/ocr.ts` - funkcja `analyzeBatch`

**Opis:** Retry ma być uruchamiane tylko gdy naprawdę potrzebne

**Kroki:**
1. Zmienić logikę `shouldRetryWithAI`:
   - Tylko jeśli `mismatchRatio > 0.1` LUB `suspiciousDuplicates > 0`
   - Tylko dla `imageCount <= 2`
2. Dla 3 obrazów: zawsze używaj tylko pierwszego pass (bez retry)
3. Dla prostych paragonów (1 zdjęcie, <10 pozycji): brak retry

**Kryterium akceptacji:** Retry dla 2 zdjęć tylko gdy suma się nie zgadza

---

## Zadanie 4: Wykrywanie używanej odzieży

**Lokalizacja:** `convex/ocr/categories.ts` - funkcja `resolveHeuristicCategory`

**Opis:** Dodać wykrywanie "Odziez UZYW", "second-hand", "outlet"

**Kroki:**
1. Dodać zmienną `isUsedClothing` przed `isClothingIssuer`
2. Regex: `/\b(uzyw|used|second.?hand|outlet|stock|deca)\b/i`
3. Dodać warunek przed regułami dla odzieży:
   - Jeśli używana odzież dziecięca → "Ubrania i obuwie > Odzież dziecięca"
   - Jeśli używana odzież → "Ubrania i obuwie > Odzież"

**Kryterium akceptacji:** "Odziez UZYW" → "Ubrania i obuwie > Odzież"

---

## Zadanie 5: Priorytetyzacja learning

**Lokalizacja:** `convex/ocr/parser.ts` - funkcja `assignCategoriesToItems`

**Opis:** Używać `usageCount` do sortowania mapowań

**Kroki:**
1. W `lookupMappingsBatch` - zwrócić również `usageCount`
2. W `assignCategoriesToItems` - sortować po `usageCount` (najczęściej używane first)
3. Dodać logowanie: `mappedFromHistoryCount` - ile użyto z learning

**Kryterium akceptacji:** Po korekcie użytkownika, kolejne skanowanie używa tej korekty

---

## Zadanie 6: Testy i weryfikacja

**Opis:** Przetestować wszystkie scenariusze

**Testy manualne:**
1. ⏱️ Paragon 1 zdjęcie - czas <3s
2. ⏱️ Paragon 2 zdjęcia - czas <10s
3. 👕 "Odziez UZYW" → "Ubrania i obuwie > Odzież"
4. 🇬🇧 Paragon angielski - poprawna ekstrakcja
5. 🧠 Po korekcie - learning działa

**Metryki do sprawdzenia w logach:**
- `visionMs` - czas wywołania AI
- `totalMs` - całkowity czas
- `retryUsed` - czy retry było użyte
- `mappedFromHistoryCount` - ile z learning
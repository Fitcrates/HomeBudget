# OCR Optimization - Projekt Techniczny

## Architektura rozwiązania

### Obecny flow (problem)

```
[2-3 zdjęcia] → [1 duży prompt ~2000 znaków] → [gemini-flash-lite]
                                                    ↓
                                            Jeśli błąd sumy:
                                            → [retry z gemini-pro]
                                                    ↓
                                            Jeśli nadal błąd:
                                            → [audit z gemini-pro]
                                                    ↓
                                            Jeśli >1 obraz i truncated:
                                            → [fallback per-image]
                                                    
Wynik: 5-7 wywołań AI, 40-80 sekund
```

### Nowy flow (cel)

```
[2-3 zdjęcia] → [Równoległe przetwarzanie per-obraz]
                      ↓
              [Szybki prompt ekstrakcyjny ~500 znaków]
                      ↓
              [gemini-flash-lite x liczba_obrazów]
                      ↓
              [Lokalne merge wyników]
                      ↓
              [Sprawdź sumę - jeśli OK: koniec]
                      ↓
              [Jeśli błąd: 1 retry z modelem smart]
                      ↓
              [Lokalna kategoryzacja + learning lookup]
              
Wynik: 1-3 wywołania AI, <10 sekund
```

## Szczegóły implementacyjne

### Zmiana 1: Uproszczony prompt ekstrakcyjny

**Lokalizacja:** `convex/ocr/prompt.ts`

**Obecny prompt:** ~2000 znaków, 10 zasad, lista sklepów, lista kategorii

**Nowy prompt:** ~500 znaków, skupiony na ekstrakcji

```typescript
// Nowy prompt - prosty i zwięzły
export const EXTRACTION_PROMPT = `Extract ALL items from receipt image.
For each item provide: description, amount (total, not unit price).
Rules:
- If "2 x 4.99" then amount = "9.98"
- If "1.234 kg x 12.99" then amount = price shown next to it (NOT per kg)
- Discounts as separate line with negative amount
- Deposits (kaucja) as depositTotal, not item
- Return JSON with: rawText, totalAmount, payableAmount, depositTotal, items[]
- Works in Polish, English, German, Czech, Slovak`;
```

**Dlaczego to działa lepiej:**
- Model nie "myśli" tylko ekstraktuje
- temperature: 0.0 + response_format: json_object = szybkie wypełnianie schematu
- Logika biznesowa (kategoryzacja, sumy) w kodzie, nie w prompcie

### Zmiana 2: Równoległe przetwarzanie obrazów

**Lokalizacja:** `convex/ocr.ts` - funkcja `processImagesWithAI`

```typescript
// Zamiast jednego batcha z wszystkimi obrazami:
const combined = await analyzeBatch(imageDataList, "combined");

// Nowe podejście: równoległe per-obraz
const results = await Promise.all(
  imageDataList.map((image, index) =>
    analyzeBatch([image], `ocr:image:${index + 1}`, {
      enableRecoveryPasses: false, // wyłącz retry dla prostych przypadków
    })
  )
);

// Lokalne merge wyników
const merged = mergeBatchResults(results, { combineIntoSingleReceipt: true });
```

**Korzyści:**
- Czas = max(czas_obrazu_1, czas_obrazu_2, ...) zamiast sumy
- Każdy obraz niezależny - brak problemu z kontekstem

### Zmiana 3: Inteligentne retry

**Logika retry:**

```typescript
// Tylko jeśli spełnione warunki:
const shouldRetry = (
  mismatchRatio > 0.1 ||  // suma się nie zgadza >10%
  suspiciousDuplicates > 0  // podejrzane duplikaty
) && imageCount <= 2;  // ale tylko dla max 2 obrazów

// Dla 3 obrazów lub prostych przypadków - brak retry
```

### Zmiana 4: Wykrywanie używanej odzieży

**Lokalizacja:** `convex/ocr/categories.ts`

```typescript
// Dodaj przed regułami dla odzieży (isClothingIssuer)

const isUsedClothing = has(combinedContext, 
  /\b(uzyw|used|second.?hand|outlet|stock|deca)\b/i
);

if (isUsedClothing) {
  if (has(combinedContext, /\b(dzieci|kids|child|baby)\b/i)) {
    return resolve(CATEGORY.CLOTHES, SUB.odziezDziecieca, categoriesArray);
  }
  return resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
}
```

### Zmiana 5: Priorytetyzacja learning

**Lokalizacja:** `convex/ocr/parser.ts`

```typescript
// W funkcji assignCategoriesToItems:

// 1. Najpierw sprawdź learning (zapamiętane korekty)
const mapping = mappingByRawDescription.get(item.originalRawDescription);
if (mapping) {
  item.categoryId = mapping.categoryId;
  item.subcategoryId = mapping.subcategoryId;
  item.fromMapping = true;
  // Użyj usageCount do sortowania
}

// 2. Potem AI category (jeśli allowAiCategoryResolution)
// 3. Na końcu heurystyki lokalne
```

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `convex/ocr/prompt.ts` | Nowy uproszczony prompt, zachowaj wielojęzyczność |
| `convex/ocr.ts` | Równoległe przetwarzanie, inteligentne retry |
| `convex/ocr/categories.ts` | Dodaj wykrywanie używanej odzieży |
| `convex/ocr/parser.ts` | Priorytetyzacja learning, sortowanie po usageCount |

## Testy

### Testy manualne
1. Paragon 1 zdjęcie - czas <3s
2. Paragon 2 zdjęcia - czas <10s
3. Paragon "Odziez UZYW" - kategoria "Ubrania i obuwie > Odzież"
4. Paragon angielski (np. UK receipt) - poprawna ekstrakcja
5. Po korekcie użytkownika - learning działa przy kolejnym skanie

### Metryki do monitorowania
- `visionMs` - czas wywołania AI
- `totalMs` - całkowity czas przetwarzania
- `retryUsed` - czy retry było użyte
- `mappedFromHistoryCount` - ile z learning
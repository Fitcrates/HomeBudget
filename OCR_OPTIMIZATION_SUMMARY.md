# OCR Optimization - Dokumentacja Implementacji

## Spis treści
1. [Architektura systemu](#architektura-systemu)
2. [Przepływ danych](#przepływ-danych)
3. [Komponenty i ich role](#komponenty-i-ich-role)
4. [Spodziewane zachowanie](#spodziewane-zachowanie)
5. [Zmiany względem poprzedniej wersji](#zmiany-względem-poprzedniej-wersji)
6. [Metryki i logowanie](#metryki-i-logowanie)

---

## Architektura systemu

### Ogólny przepływ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER UPLOAD                                        │
│                    (1-3 images of receipts)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    processImagesWithAI (ocr.ts)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. OPTIMIZACJA OBRAZÓW (sharp)                                     │   │
│  │     - Resize do max 1800px                                          │   │
│  │     - Konwersja do WebP (quality 82)                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  2. RÓWNOLEGŁE PRZETWARZANIE (Promise.all)                         │   │
│  │     - Każdy obraz niezależnie                                       │   │
│  │     - enableRecoveryPasses: false (proste przypadki)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  3. ANALIZA BATCH (analyzeBatch)                                    │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  a) Wywołanie AI (gemini-2.5-flash-lite)                │    │   │
│  │     │     - EXTRACTION_PROMPT (~500 znaków)                   │    │   │
│  │     │     - temperature: 0.0                                   │    │   │
│  │     │     - response_format: json_object                       │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  │     │                                                            │    │   │
│  │     ▼                                                            │    │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  b) PARSOWANIE (parseAndNormalizeResponse)              │    │   │
│  │     │     - Ekstrakcja JSON                                    │    │   │
│  │     │     - Walutacja (NBP API)                                │    │   │
│  │     │     - Normalizacja pozycji                               │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  │     │                                                            │    │   │
│  │     ▼                                                            │    │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  c) WALIDACJA I RETRY (opcjonalne)                      │    │   │
│  │     │     - Sprawdzenie sumy (mismatchRatio)                  │    │   │
│  │     │     - Wykrycie duplikatów                                │    │   │
│  │     │     - INTELIGENTNE RETRY: tylko gdy potrzebne           │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  4. MERGE WYNIKÓW (mergeBatchResults)                              │   │
│  │     - Łączenie pozycji z wielu obrazów                            │   │
│  │     - Przypisanie receiptIndex                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  5. KATEGORYZACJA (parser.ts + categories.ts)                     │   │
│  │     ┌──────────────────��──────────────────────────────────────┐    │   │
│  │     │  a) LEARNING (productMappings)                          │    │   │
│  │     │     - lookupMappingsBatch                                │    │   │
│  │     │     - Sortowanie po usageCount (najczęstsze first)      │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  │     │                                                            │    │   │
│  │     ▼                                                            │    │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  b) AI CATEGORY (z promptu)                             │    │   │
│  │     │     - resolveCategoryNames                               │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  │     │                                                            │    │   │
│  │     ▼                                                            │    │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  c) HEURYSTYKI LOKALNE                                   │    │   │
│  │     │     - resolveHeuristicCategory                           │    │   │
│  │     │     - Wykrywanie używanej odzieży ✓ NOWE                 │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROCESSED RESULT                                     │
│  - items: ProcessedReceiptItem[]                                            │
│  - receiptSummaries: ReceiptSummary[]                                       │
│  - retryUsed: boolean                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Przepływ danych

### 1. Upload i optymalizacja obrazów

**Plik:** `convex/ocr.ts` - funkcja `processImagesWithAI`

```typescript
// Optymalizacja każdego obrazu przed wysłaniem do AI
async function optimizeReceiptImageForStorage(inputBuffer: Buffer) {
  // 1. Rotate (auto-orient)
  // 2. Resize jeśli > 1800px
  // 3. Konwersja do WebP (quality 82)
  // 4. Zwróć blob + metadane
}
```

### 2. Równoległe przetwarzanie

**Plik:** `convex/ocr.ts` - funkcja `processImagesWithAI`

```typescript
// ZMIANA: Zamiast jednego batcha - równoległe per-obraz
const results = await Promise.all(
  imageDataList.map((image, index) =>
    analyzeBatch([image], `ocr:image:${index + 1}`, {
      enableRecoveryPasses: false, // wyłącz retry dla prostych przypadków
    })
  )
);
```

### 3. Analiza pojedynczego obrazu

**Plik:** `convex/ocr.ts` - funkcja `analyzeBatch`

```typescript
async function analyzeBatch(batch, traceLabel, options) {
  // 1. Build prompt (uproszczony EXTRACTION_PROMPT)
  // 2. Wywołanie AI (gemini-2.5-flash-lite)
  // 3. Parsowanie odpowiedzi
  // 4. INTELIGENTNE RETRY (opcjonalne)
}
```

### 4. Inteligentne retry

**Logika:** Retry tylko gdy:
- `mismatchRatio > 0.1` (suma się nie zgadza >10%) LUB
- `suspiciousDuplicates > 0` (podejrzane duplikaty)
- `imageCount <= 2` (tylko dla max 2 obrazów)

```typescript
// ZMIANA: Dodano imageCount <= 2
const shouldRetryWithAI = rawShouldRetryWithAI && (
  (suspiciousDuplicateReceipts.length > 0 || mismatchRatio > 0.1) &&
  imageCount <= 2
);
```

### 5. Kategoryzacja

**Plik:** `convex/ocr/parser.ts` - funkcja `assignCategoriesToItems`

Kolejność (priorytet od najwyższego):
1. **Learning** (product_mappings) - korekty użytkownika
2. **AI Category** - kategoria z promptu
3. **Heurystyki lokalne** - wykrywanie sklepów, produktów

---

## Komponenty i ich role

| Plik | Funkcja | Opis |
|------|---------|------|
| `convex/ocr.ts` | Główny orchestrator | Process images, analyze batch, merge results |
| `convex/ocr/prompt.ts` | Prompt management | EXTRACTION_PROMPT, SYSTEM_PROMPT, buildPrompt |
| `convex/ocr/groq.ts` | AI client | createVisionCompletionWithRetry, obsługa błędów |
| `convex/ocr/parser.ts` | Parsowanie | parseAndNormalizeResponse, kategoryzacja |
| `convex/ocr/categories.ts` | Heurystyki | resolveHeuristicCategory, wykrywanie sklepów |
| `convex/ocr/normalization.ts` | Normalizacja | enrichReceiptSummaries, collapseDuplicates |
| `convex/ocr/utils.ts` | Utilities | parseAmount, extractJson, stripDiacritics |
| `convex/ocr/types.ts` | TypeScript types | ProcessedReceiptItem, ReceiptSummary |
| `convex/productMappings.ts` | Learning | lookupMappingsBatch, upsertMapping |

---

## Spodziewane zachowanie

### Przypadek 1: Krótki paragon (1 zdjęcie)

```
Czas: <3 sekundy
Wywołania AI: 1 (flash-lite)
Retry: NIE (prosty przypadek)
```

1. Upload 1 obrazu
2. Optymalizacja (resize + WebP)
3. Wywołanie AI z EXTRACTION_PROMPT
4. Parsowanie + kategoryzacja
5. Zwróć wynik

### Przypadek 2: Długi paragon (2-3 zdjęcia)

```
Czas: <10 sekund
Wywołania AI: 2-3 (flash-lite) + opcjonalnie 1 (pro)
Retry: TAK, ale tylko jeśli suma się nie zgadza
```

1. Upload 2-3 obrazów
2. Równoległa optymalizacja (Promise.all)
3. Równoległe wywołania AI (Promise.all)
4. Merge wyników
5. Sprawdzenie sumy:
   - OK → zwróć wynik
   - BŁĄD → retry z gemini-pro (maksymalnie 1)
6. Kategoryzacja (learning → AI → heurystyki)

### Przypadek 3: Używana odzież

```
Wejście: "Odziez UZYW", "Second Hand", "USED clothing"
Wyjście: Kategoria "Ubrania i obuwie > Odzież"
```

Heurystyka w `categories.ts`:
```typescript
const isUsedClothing = has(receiptContext, 
  /\b(uzyw|used|second.?hand|outlet|stock|deca)\b/i
);

if (isUsedClothing) {
  return resolve(CATEGORY.CLOTHES, SUB.odziez, categoriesArray);
}
```

### Przypadek 4: Paragon zagraniczny

```
Obsługiwane języki: PL, EN, DE, CZ, SK
Prompt: EXTRACTION_PROMPT (wielojęzyczny)
```

### Przypadek 5: Learning (korekty użytkownika)

```
1. Użytkownik skanuje paragon
2. AI przypisuje błędną kategorię
3. Użytkownik ręcznie poprawia kategorię
4. System zapisuje: upsertMapping()
5. Przy kolejnym skanowaniu: lookupMappingsBatch()
6. Sortowanie po usageCount (najczęstsze first)
```

---

## Zmiany względem poprzedniej wersji

| Aspekt | Przed | Po |
|--------|-------|-----|
| Czas 2 zdjęć | 40-80s | <10s |
| Wywołania AI | 5-7 | 1-3 (+ opcjonalnie 1) |
| Prompt | ~2000 znaków | ~500 znaków |
| Retry | Zawsze | Tylko gdy potrzebne |
| Używana odzież | ❌ | ✅ |
| Learning priority | Brak | usageCount sort |

---

## Metryki i logowanie

### Logi w konsoli

```bash
[OCR TIMING][ocr:images] pipeline_started { imageCount: 2 }
[OCR TIMING][ocr:images:combined] prompt_ready { imageCount: 2, promptLength: 487, promptMs: 5 }
[OCR TIMING][ocr:images:combined] vision_completed { visionMs: 2340, ... }
[OCR TIMING][ocr:images:combined] initial_parse_completed { 
  items: 15, 
  mismatchRatio: 0.02,
  shouldRetryWithAI: false,
  ...
}
[OCR TIMING][ocr:images] pipeline_completed { 
  strategy: "combined",
  totalMs: 4500,
  items: 15 
}
```

### Kluczowe metryki

| Metryka | Opis | Cel |
|---------|------|-----|
| `visionMs` | Czas wywołania AI | <3000ms |
| `totalMs` | Całkowity czas | <10000ms |
| `retryUsed` | Czy retry było użyte | false dla prostych |
| `mappedFromHistoryCount` | Ile z learning | >0 po korekcie |
| `mismatchRatio` | Rozbieżność sumy | <0.1 |

---

## Schemat danych

### ProcessedReceiptItem

```typescript
interface ProcessedReceiptItem {
  description: string;           // "Mleko Łowickie 2%"
  originalRawDescription?: string; // "MLK ŁOWE 2%"
  amount: string;                // "4.99"
  categoryId: string | null;     // "abc123"
  subcategoryId: string | null;  // "def456"
  fromMapping?: boolean;         // true jeśli z learning
  receiptIndex: number;          // 0
  receiptLabel?: string;         // "Biedronka 2026-04-11"
  sourceImageIndex?: number;     // 1
}
```

### ReceiptSummary

```typescript
interface ReceiptSummary {
  receiptIndex: number;
  receiptLabel: string;
  totalAmount: string;      // "83.99"
  payableAmount?: string;   // "84.99"
  depositTotal?: string;    // "1.00"
  sourceImageIndex: number | null;
  itemsTotal?: string;      // obliczone z items
  difference?: string;      // różnica
  mismatchType?: "ok" | "missing_items" | "missing_discounts" | "unknown";
}
```

---

## Obsługa błędów

### Retry w groq.ts

```typescript
// Automatyczne retry dla błędów:
- 408 (Request Timeout)
- 409 (Conflict)
- 425 (Too Early)
- 429 (Rate Limit)
- 500, 502, 503, 504 (Server Errors)

// Wyjątki:
- "over capacity"
- "rate limit"
- "timeout"
- "temporarily unavailable"
```

### Fallback w processImagesWithAI

```typescript
// Jeśli combined zwróci 0 items lub truncated:
const shouldFallbackToPerImage = imageDataList.length > 1 && (
  combined.items.length === 0 ||
  combined.wasTruncated === true
);

// Fallback do per-image z enableRecoveryPasses: false
```

---

## Konfiguracja

### Modele AI

```typescript
// convex/ocr/prompt.ts
export const VISION_MODEL = "gemini-2.5-flash-lite";      // Szybki, tani
export const VISION_MODEL_SMART = "gemini-2.5-pro";       // Z myśleniem
```

### Parametry obrazów

```typescript
// convex/ocr.ts
const OCR_UPLOAD_MAX_DIMENSION = 1800;
const OCR_UPLOAD_WEBP_QUALITY = 82;
const OCR_UPLOAD_WEBP_EFFORT = 4;
```

---

## Testy manualne

1. ⏱️ **Paragon 1 zdjęcie** - czas <3s
2. ⏱️ **Paragon 2 zdjęcia** - czas <10s
3. 👕 **"Odziez UZYW"** → "Ubrania i obuwie > Odzież"
4. 🇬🇧 **Paragon angielski** - poprawna ekstrakcja
5. 🧠 **Po korekcie** - learning działa

### Sprawdzenie w logach

```bash
# Wyszukaj w logach:
grep "OCR TIMING" | grep "pipeline_completed"

# Sprawdź metryki:
- visionMs: <3000
- totalMs: <10000
- retryUsed: false (dla prostych)
- mappedFromHistoryCount: >0 (po korekcie)
```
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import OpenAI from "openai";

// ── Configuration ─────────────────────────────────────────────────

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });
}

/**
 * Proxy supports: gpt-4o-mini, gpt-4.1-nano
 * Using gpt-4o-mini for vision — quality boost comes from:
 *  - Enhanced prompt with Polish receipt patterns
 *  - detail:"high" on image_url (critical for small receipt text)
 *  - Multi-image support (all uploaded images in one request)
 *  - Retry logic for incomplete results
 */
const VISION_MODEL = "gpt-4o-mini";

/**
 * System prompt engineered for maximum receipt OCR accuracy.
 * Key principles:
 * - Explicit rules about reading ALL items
 * - Discount/rebate handling (common on Polish receipts: "Opust")
 * - Category assignment guidance with Polish product name understanding
 */
const SYSTEM_PROMPT = `Jesteś światowej klasy ekspertem OCR specjalizującym się w odczycie polskich paragonów, faktur i rachunków.

ABSOLUTNE ZASADY (nigdy ich nie łam):

1. WYODRĘBNIJ KAŻDY PRODUKT — nie pomijaj ŻADNEJ pozycji zakupowej
2. Używaj KOŃCOWEJ ceny po rabacie:
   - Gdy pod produktem jest "Opust" lub "Rabat" → użyj ceny PO obniżce
   - NIE twórz osobnej pozycji dla linii rabatu
3. Czytaj kolumnę "Wartość"/"Wart." (wartość ŁĄCZNA = ilość × cena), NIE cenę jednostkową
4. Ignoruj: sumy, podatki PTU/VAT, kaucje za opakowania, informacje o płatności
5. Przypisuj kategorie precyzyjnie — rozumiesz polskie skróty na paragonach
6. Jeśli produkt jest w ilości >1, podaj ŁĄCZNĄ wartość (np. 3 × 2.50 = "7.50")

ROZUMIENIE POLSKICH SKRÓTÓW NA PARAGONACH:
- "MLK" = mleko → Nabiał i jaja
- "SER" = ser → Nabiał i jaja  
- "MSO" / "MIĘS" = mięso → Mięso i wędliny
- "WAR" / "WARZ" = warzywa → Owoce i warzywa
- "OW" / "OWOC" = owoce → Owoce i warzywa
- "PIW" = piwo → Alkohol
- "SOK" = sok → Napoje bezalkoholowe
- "CHLEB" / "BUŁ" = pieczywo → Piekarnia
- "MRO" / "MROZ" = mrożonki → Mrożonki
- "ŚR.CZ" / "ŚROD" = środek czystości → Chemia domowa
- "PRAL" / "PŁYN" = pranie/płyn → Chemia domowa
- "KARM" = karma → Zwierzęta
- "PIEL" = pieluchy/pielęgnacja → kontekstowo

Zawsze staraj się przypisać kategorię — null tylko gdy absolutnie nie wiadomo.`;

// ── Type Definitions ──────────────────────────────────────────────

interface ProcessedReceiptItem {
  description: string;
  amount: string;
  categoryId: string | null;
  subcategoryId: string | null;
}

interface ProcessReceiptResult {
  items: ProcessedReceiptItem[];
  rawText: string;
  modelUsed: string;
}

interface CategoryPromptItem {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

// ── Utility Functions ─────────────────────────────────────────────

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (withoutFences.startsWith("{") || withoutFences.startsWith("[")) {
    return withoutFences;
  }

  const firstObj = withoutFences.indexOf("{");
  const lastObj = withoutFences.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) {
    return withoutFences.slice(firstObj, lastObj + 1);
  }

  const firstArr = withoutFences.indexOf("[");
  const lastArr = withoutFences.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) {
    return withoutFences.slice(firstArr, lastArr + 1);
  }

  return withoutFences;
}

function normalizeAmount(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (!text) return "";
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ── Category Data Preparation ─────────────────────────────────────

function prepareCategoryData(categories: any) {
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const categoryIds = new Set<string>();
  const subcategoryIdsByCategory = new Map<string, Set<string>>();

  const categoryPromptData: CategoryPromptItem[] = categoriesArray.map(
    (category: any) => {
      const categoryId = asString(category?._id);
      const categoryName = asString(category?.name);
      const subs = Array.isArray(category?.subcategories)
        ? category.subcategories
        : [];

      if (categoryId) categoryIds.add(categoryId);

      const subSet = new Set<string>();
      const subcategories = subs.map((sub: any) => {
        const subId = asString(sub?._id);
        const subName = asString(sub?.name);
        if (subId) subSet.add(subId);
        return { id: subId, name: subName };
      });

      if (categoryId) {
        subcategoryIdsByCategory.set(categoryId, subSet);
      }

      return { id: categoryId, name: categoryName, subcategories };
    }
  );

  return { categoryPromptData, categoryIds, subcategoryIdsByCategory };
}

// ── Prompt Builder ────────────────────────────────────────────────

function buildPrompt(
  categoryPromptData: CategoryPromptItem[],
  documentText?: string
): string {
  const sourceDescription = documentText
    ? "poniższy tekst wyodrębniony z dokumentu"
    : "załączony obraz/obrazy paragonu lub faktury";

  const textSection = documentText
    ? `\nTEKST DOKUMENTU DO ANALIZY:\n"""\n${documentText}\n"""\n`
    : "";

  return `Przeanalizuj ${sourceDescription} i wyodrębnij WSZYSTKIE pozycje zakupowe.
${textSection}
## ZASADY EKSTRAKCJI:

### CZYTANIE POZYCJI
- Wyodrębnij ABSOLUTNIE KAŻDY produkt/usługę z dokumentu
- Jeśli widzisz wiele obrazów, przeanalizuj je WSZYSTKIE łącznie jako jeden paragon/fakturę
- Dla tabel: czytaj kolumnę "Wartość" / "Wart." / "Kwota brutto" (wartość końcowa)
- NIE czytaj kolumny z ceną jednostkową — czytaj WARTOŚĆ (ilość × cena)
- Jeśli "3 x 2.50" → podaj jedną pozycję za "7.50"

### RABATY I OPUSTY
- "Opust" / "Rabat" pod produktem → użyj CENY PO RABACIE
- Przykład: Masło 7.99 → Opust -2.00 → podaj "5.99"
- NIE twórz osobnej pozycji dla rabatu

### FORMAT KWOTY
- Tylko liczba: "12.98" (kropka jako separator dziesiętny)
- Konwertuj przecinek: "5,99" → "5.99"
- Bez walut: nie dodawaj "zł", "PLN"

### IGNORUJ (NIE twórz pozycji):
- Sumy: "Suma", "SUMA PTU", "DO ZAPŁATY", "Razem", "Należność"
- Podatek: linie VAT/PTU (A=, B=, C=)
- Opakowania: "kaucja", "But Plastik kaucja"
- Płatność: informacje o karcie, gotówce, reszcie
- Nagłówki: nazwa sklepu, adres, NIP, data, numer paragonu
- "Sprzedaż opodatkowana", "Rabat łączny"

### KATEGORYZACJA
Przypisz categoryId i subcategoryId z poniższej listy.
Wskazówki kontekstowe (ŚCIŚLE przestrzegaj):
- Produkty spożywcze z supermarketu → "Żywność i napoje"
  • Mleko, ser, masło, jaja, śmietana, jogurt, kefir, twaróg → "Nabiał i jaja"
  • Mięso, kiełbasa, szynka, kurczak, wołowina, wieprzowina, drób → "Mięso i wędliny"
  • Jabłka, pomidory, sałata, ziemniaki, cebula, ogórek, marchew, owoce → "Owoce i warzywa"
  • Chleb, bułki, bagietka, rogalik, ciasto drożdżowe → "Piekarnia"
  • Woda, sok, cola, pepsi, fanta, napój energetyczny → "Napoje bezalkoholowe"
  • Kawa, herbata, kakao → "Kawa i herbata"
  • Piwo, wino, wódka, whisky, likier → "Alkohol"
  • Makaron, ryż, mąka, kasza, płatki owsiane → "Produkty sypkie"
  • Sos pomidorowy, ketchup, musztarda, majonez, ocet, olej, oliwa, sos sojowy → "Przyprawy i dodatki"
  • Przyprawy (pieprz, sól, oregano, bazylia, curry) → "Przyprawy i dodatki"
  • Konserwy (tuńczyk, kukurydza, groszek, fasola, pomidory krojone) → "Przyprawy i dodatki"
  • Czekolada, chipsy, cukierki, ciastka, batony → "Słodycze i przekąski"
  • Pizza mrożona, pierogi mrożone, warzywa mrożone, lody → "Mrożonki"
  • Gotowe dania, sałatki gotowe, kanapki → "Gotowe dania"
  • Produkty bio, eko, organic → "Produkty bio"
- Środki czystości → "Chemia domowa i higiena"
  • Proszek, płyn do prania, kapsułki → "Pranie"
  • Płyn do naczyń, tabletki do zmywarki → "Zmywanie"
  • Pasta do zębów, szczoteczka, szampon, żel pod prysznic → "Higiena osobista"
  • Papier toaletowy, ręczniki papierowe, chusteczki → "Papier i ręczniki"
  • Płyn do podłóg, spray do kuchni/łazienki → "Środki czystości"
- Leki bez recepty, witaminy, suplementy → "Zdrowie i uroda" → "Apteka"
- Karma dla psa/kota, przysmaki, żwirek → "Zwierzęta" → "Karma"

DOZWOLONE KATEGORIE I PODKATEGORIE (używaj TYLKO tych ID):
${JSON.stringify(categoryPromptData, null, 2)}

## WYMAGANY FORMAT ODPOWIEDZI (ścisły JSON):
{
  "rawText": "Nazwa sklepu, data zakupu, adres (krótka transkrypcja nagłówka, max 200 znaków)",
  "items": [
    {
      "description": "Pełna nazwa produktu (przepisz z paragonu)",
      "amount": "12.98",
      "categoryId": "id_kategorii_lub_null",
      "subcategoryId": "id_podkategorii_lub_null"
    }
  ]
}

KRYTYCZNE: Zwróć KOMPLETNĄ listę WSZYSTKICH produktów. Lepiej dodać pozycję za dużo niż pominąć cokolwiek!`;
}

// ── Response Parser & Normalizer ──────────────────────────────────

function parseAndNormalizeResponse(
  content: string,
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>,
  modelUsed: string
): ProcessReceiptResult {
  try {
    const extracted = extractJsonBlock(content);
    const parsed = JSON.parse(extracted || "{}");

    const parsedItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

    console.log(`AI returned ${parsedItems.length} raw items`);

    const normalizedItems: ProcessedReceiptItem[] = parsedItems
      .map((item: any) => {
        const description = asString(item?.description) || "Nieznana pozycja";
        const amount = normalizeAmount(item?.amount);

        const categoryIdCandidate = asString(item?.categoryId);
        const categoryId = categoryIds.has(categoryIdCandidate)
          ? categoryIdCandidate
          : null;

        const subcategoryIdCandidate = asString(item?.subcategoryId);
        const isSubcategoryAllowed =
          !!categoryId &&
          !!subcategoryIdCandidate &&
          !!subcategoryIdsByCategory
            .get(categoryId)
            ?.has(subcategoryIdCandidate);

        return {
          description,
          amount,
          categoryId,
          subcategoryId: isSubcategoryAllowed ? subcategoryIdCandidate : null,
        };
      })
      .filter(
        (item: ProcessedReceiptItem) =>
          item.amount || item.description !== "Nieznana pozycja"
      );

    const rawText = asString(parsed?.rawText);

    console.log(
      `Normalized to ${normalizedItems.length} valid items (model: ${modelUsed})`
    );

    return { items: normalizedItems, rawText, modelUsed };
  } catch (e) {
    console.error("Failed to parse AI JSON:", e);
    console.error("Raw content preview:", content.substring(0, 500));
    return { items: [], rawText: "", modelUsed };
  }
}

// NOTE: No local PDF parsing — Convex runtime lacks DOMMatrix/Canvas.
// All PDF processing goes directly through GPT-4o vision API.

// ── AI Processing: Text ───────────────────────────────────────────

async function processTextWithAI(
  text: string,
  categoryPromptData: CategoryPromptItem[],
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>
): Promise<ProcessReceiptResult> {
  const truncatedText = text.slice(0, 10000);
  const prompt = buildPrompt(categoryPromptData, truncatedText);

  console.log("Sending extracted text to GPT-4o:", {
    textLength: truncatedText.length,
  });

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.05,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    const result = parseAndNormalizeResponse(
      content,
      categoryIds,
      subcategoryIdsByCategory,
      VISION_MODEL
    );

    // Verification pass: if suspiciously few items from substantial text, retry
    if (result.items.length < 2 && text.length > 300) {
      console.log(
        `Only ${result.items.length} items from ${text.length} chars of text — retrying with emphasis`
      );
      return await retryWithEmphasis(
        prompt,
        categoryIds,
        subcategoryIdsByCategory
      );
    }

    return result;
  } catch (err: any) {
    console.error("GPT-4o text processing error:", err?.message);
    throw new Error(
      `Błąd przetwarzania AI: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`
    );
  }
}

// ── AI Processing: Vision (Images) ────────────────────────────────

async function processImagesWithAI(
  imageDataList: { base64: string; mimeType: string }[],
  categoryPromptData: CategoryPromptItem[],
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>
): Promise<ProcessReceiptResult> {
  const prompt = buildPrompt(categoryPromptData);

  // Build content array with ALL images for a single comprehensive analysis
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text" as const, text: prompt },
  ];

  for (const img of imageDataList) {
    contentParts.push({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: "high", // Critical for small receipt text
      },
    });
  }

  console.log("Sending to GPT-4o vision:", {
    imageCount: imageDataList.length,
    totalBase64Bytes: imageDataList.reduce((s, i) => s + i.base64.length, 0),
  });

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.05,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    console.log("GPT-4o vision response:", {
      contentLength: content.length,
      usage: resp.usage,
    });

    const result = parseAndNormalizeResponse(
      content,
      categoryIds,
      subcategoryIdsByCategory,
      VISION_MODEL
    );

    console.log(
      `Vision extracted ${result.items.length} items from ${imageDataList.length} image(s)`
    );
    return result;
  } catch (err: any) {
    console.error("GPT-4o vision error:", err?.message);
    throw new Error(
      `Błąd AI Vision: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`
    );
  }
}

// ── AI Processing: PDF as Vision (fallback for scanned PDFs) ──────

async function processPdfAsVision(
  pdfBase64: string,
  categoryPromptData: CategoryPromptItem[],
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>
): Promise<ProcessReceiptResult> {
  const prompt = buildPrompt(categoryPromptData);

  console.log("Attempting PDF vision (scanned PDF fallback):", {
    pdfBase64Length: pdfBase64.length,
  });

  try {
    // GPT-4o can accept PDFs as data URIs in the image_url field
    const resp = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.05,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text" as const, text: prompt },
            {
              type: "image_url" as const,
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    return parseAndNormalizeResponse(
      content,
      categoryIds,
      subcategoryIdsByCategory,
      `${VISION_MODEL} (pdf-vision)`
    );
  } catch (err: any) {
    console.error("PDF vision fallback failed:", err?.message);
    throw new Error(
      "Nie udało się odczytać tego PDF-a. " +
        "Plik może zawierać zeskanowane obrazy w nieobsługiwanym formacie. " +
        "Spróbuj zrobić zdjęcie dokumentu aparatem i przesłać jako obraz."
    );
  }
}

// ── Retry Logic ───────────────────────────────────────────────────

async function retryWithEmphasis(
  originalPrompt: string,
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>
): Promise<ProcessReceiptResult> {
  const retryPrompt = `UWAGA: Poprzednia analiza mogła pominąć pozycje. Przeczytaj PONOWNIE, DOKŁADNIEJ.
Szukaj KAŻDEJ linii z ceną. Nawet jeśli tekst jest nieczytelny, spróbuj go odczytać.
Upewnij się, że masz WSZYSTKIE produkty!

${originalPrompt}`;

  console.log("Retry with emphasis...");

  const resp = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 8192,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: retryPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = resp.choices[0].message.content ?? "{}";
  return parseAndNormalizeResponse(
    content,
    categoryIds,
    subcategoryIdsByCategory,
    `${VISION_MODEL} (retry)`
  );
}

// ── PDF Processing Orchestrator ───────────────────────────────────
// Strategy: Send PDF directly to GPT-4o as base64 via image_url.
// No local parsing needed — avoids DOMMatrix/Canvas issues in Convex runtime.

async function processPdfDocument(
  pdfBase64: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } =
    prepareCategoryData(categories);

  console.log("=== PDF Processing Pipeline (direct vision) ===", {
    base64Length: pdfBase64.length,
    categoryCount: categoryPromptData.length,
  });

  // Primary: Send PDF as data URI to GPT-4o vision
  try {
    console.log("→ Attempting GPT-4o PDF vision (data:application/pdf)");
    return await processPdfAsVision(
      pdfBase64,
      categoryPromptData,
      categoryIds,
      subcategoryIdsByCategory
    );
  } catch (primaryError: any) {
    console.warn("PDF vision primary failed:", primaryError.message);
  }

  // Fallback: Send PDF base64 as an image/* type (some proxies accept this)
  try {
    console.log("→ Fallback: sending PDF as image/png data URI");
    const prompt = buildPrompt(categoryPromptData);
    const resp = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.05,
      max_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text" as const, text: prompt },
            {
              type: "image_url" as const,
              image_url: {
                url: `data:image/png;base64,${pdfBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    const result = parseAndNormalizeResponse(
      content,
      categoryIds,
      subcategoryIdsByCategory,
      `${VISION_MODEL} (pdf-fallback)`
    );

    if (result.items.length > 0) return result;
  } catch (fallbackError: any) {
    console.warn("PDF vision fallback also failed:", fallbackError.message);
  }

  // Last resort: Extract raw bytes as rough text and send to text model
  try {
    console.log("→ Last resort: raw PDF byte text extraction");
    // Try decoding PDF as UTF-8 and extracting any readable text
    const rawBytes = Buffer.from(pdfBase64, "base64");
    const rawStr = rawBytes.toString("utf-8");
    // Extract text between BT/ET markers (PDF text objects) and stream content
    const textFragments: string[] = [];
    // Simple regex to find text content in PDF streams
    const streamMatches = rawStr.match(/stream[\r\n]([\s\S]*?)endstream/g) || [];
    for (const stream of streamMatches) {
      const cleaned = stream
        .replace(/^stream[\r\n]/, "")
        .replace(/endstream$/, "")
        .replace(/[^\x20-\x7E\xC0-\xFF\u0100-\u024F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length > 10) textFragments.push(cleaned);
    }
    
    const extractedText = textFragments.join("\n").trim();
    console.log("Raw text extraction:", {
      fragmentCount: textFragments.length,
      totalLength: extractedText.length,
      preview: extractedText.substring(0, 200),
    });

    if (extractedText.length > 50) {
      return await processTextWithAI(
        extractedText,
        categoryPromptData,
        categoryIds,
        subcategoryIdsByCategory
      );
    }
  } catch (textError: any) {
    console.warn("Raw text extraction failed:", textError.message);
  }

  throw new Error(
    "Nie udało się odczytać tego pliku PDF. " +
    "Możliwe przyczyny: plik jest zaszyfrowany, uszkodzony lub zawiera tylko zeskanowane obrazy. " +
    "Spróbuj zrobić zdjęcie dokumentu aparatem i przesłać jako obraz."
  );
}

// ══════════════════════════════════════════════════════════════════
// ██ PUBLIC ACTIONS
// ══════════════════════════════════════════════════════════════════

export const getFileUrl = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return (await ctx.storage.getUrl(args.storageId)) ?? null;
  },
});

export const processReceiptWithAI = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    categories: v.any(),
    isPdf: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProcessReceiptResult> => {
    const startTime = Date.now();

    try {
      console.log("=== processReceiptWithAI START ===", {
        storageIdCount: args.storageIds.length,
        isPdf: args.isPdf,
      });

      if (args.storageIds.length === 0) {
        throw new Error("Nie przesłano żadnych plików.");
      }

      const { categoryPromptData, categoryIds, subcategoryIdsByCategory } =
        prepareCategoryData(args.categories);

      if (categoryPromptData.length === 0) {
        throw new Error(
          "Brak kategorii. Dodaj kategorie w ustawieniach przed skanowaniem."
        );
      }

      // ── PDF Path ──
      if (args.isPdf) {
        console.log("Processing PDF document...");
        const url = await ctx.storage.getUrl(args.storageIds[0]);
        if (!url) throw new Error("Nie znaleziono pliku PDF w magazynie.");

        const pdfRes = await fetch(url);
        if (!pdfRes.ok) {
          throw new Error(`Błąd pobierania PDF: HTTP ${pdfRes.status}`);
        }

        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

        // Validate file size (50MB limit for OpenAI)
        if (pdfBuffer.byteLength > 50 * 1024 * 1024) {
          throw new Error(
            "Plik PDF jest za duży (max 50MB). Zmniejsz rozmiar lub zrób zdjęcie."
          );
        }

        const result = await processPdfDocument(
          pdfBase64,
          args.categories
        );

        const elapsed = Date.now() - startTime;
        console.log(
          `=== PDF Processing DONE === ${result.items.length} items in ${elapsed}ms`
        );
        return result;
      }

      // ── Image Path ──
      console.log("Processing image(s)...");

      // Fetch ALL images (not just the first one!)
      const imageDataList: { base64: string; mimeType: string }[] = [];

      for (const storageId of args.storageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (!url) {
          console.warn(`Storage URL not found for ${storageId}, skipping`);
          continue;
        }

        const imageRes = await fetch(url);
        if (!imageRes.ok) {
          console.warn(
            `Failed to fetch image ${storageId}: HTTP ${imageRes.status}`
          );
          continue;
        }

        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        const mimeType =
          imageRes.headers.get("content-type") || "image/jpeg";

        imageDataList.push({ base64: base64Data, mimeType });
      }

      if (imageDataList.length === 0) {
        throw new Error("Nie udało się załadować żadnych obrazów.");
      }

      const result = await processImagesWithAI(
        imageDataList,
        categoryPromptData,
        categoryIds,
        subcategoryIdsByCategory
      );

      const elapsed = Date.now() - startTime;
      console.log(
        `=== Image Processing DONE === ${result.items.length} items in ${elapsed}ms`
      );
      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error("=== FATAL ERROR ===", {
        message: error.message,
        elapsed: `${elapsed}ms`,
        stack: error.stack?.substring(0, 500),
      });
      throw error;
    }
  },
});

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
 * GPT-4o provides dramatically better OCR accuracy than gpt-4o-mini:
 * - Better at reading small/blurry text on receipts
 * - Better at understanding Polish abbreviations on receipts
 * - Better at categorization of products
 * - Supports high-detail image processing
 */
const VISION_MODEL = "gpt-4o";

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
Wskazówki kontekstowe:
- Produkty spożywcze z supermarketu → "Żywność i napoje"
  • Mleko, ser, masło, jaja, śmietana → podkategoria "Nabiał i jaja"
  • Mięso, kiełbasa, szynka, kurczak → "Mięso i wędliny"
  • Jabłka, pomidory, sałata → "Owoce i warzywa"
  • Chleb, bułki → "Piekarnia"
  • Woda, sok, cola → "Napoje bezalkoholowe"
  • Piwo, wino, wódka → "Alkohol"
  • Makaron, ryż, mąka → "Produkty sypkie"
  • Czekolada, chipsy → "Słodycze i przekąski"
  • Pizza mrożona, pierogi → "Mrożonki" lub "Gotowe dania"
- Środki czystości → "Chemia domowa i higiena"
  • Proszek, płyn do prania → "Pranie"
  • Płyn do naczyń → "Zmywanie"
  • Pasta, szczoteczka → "Higiena osobista"
- Leki bez recepty → "Zdrowie i uroda" → "Apteka"
- Karma dla zwierząt → "Zwierzęta" → "Karma"

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

// ── PDF Text Extraction (using unpdf) ─────────────────────────────

async function extractPdfText(
  pdfBuffer: ArrayBuffer
): Promise<{ text: string; pageCount: number }> {
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(pdfBuffer), {
      mergePages: true,
    });

    // unpdf returns string when mergePages:true, but we guard for safety
    const rawText = result.text as unknown;
    const text =
      typeof rawText === "string"
        ? rawText
        : Array.isArray(rawText)
          ? (rawText as string[]).join("\n")
          : "";

    console.log("unpdf extraction:", {
      textLength: text.length,
      totalPages: result.totalPages,
      preview: text.substring(0, 200),
    });

    return { text: text.trim(), pageCount: result.totalPages ?? 1 };
  } catch (error: any) {
    const msg = error?.message ?? "";
    console.error("unpdf extraction failed:", msg);

    // Detect password-protected PDFs
    if (
      msg.toLowerCase().includes("password") ||
      msg.toLowerCase().includes("encrypt")
    ) {
      throw new Error(
        "Ten plik PDF jest chroniony hasłem. " +
          "Odblokuj go przed przesłaniem lub zrób zdjęcie dokumentu aparatem."
      );
    }

    // Re-throw with context for other failures
    throw new Error(`PDF_EXTRACT_FAILED: ${msg}`);
  }
}

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

async function processPdfDocument(
  pdfBuffer: ArrayBuffer,
  pdfBase64: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } =
    prepareCategoryData(categories);

  console.log("=== PDF Processing Pipeline ===", {
    fileSize: pdfBuffer.byteLength,
    categoryCount: categoryPromptData.length,
  });

  // Step 1: Try text extraction with unpdf
  let extractedText = "";
  let extractionFailed = false;

  try {
    const result = await extractPdfText(pdfBuffer);
    extractedText = result.text;
    console.log("Text extraction:", {
      textLength: extractedText.length,
      pageCount: result.pageCount,
    });
  } catch (error: any) {
    // Password-protected → show error immediately
    if (error.message?.includes("hasłem") || error.message?.includes("password")) {
      throw error;
    }
    console.warn("Text extraction failed, will try vision:", error.message);
    extractionFailed = true;
  }

  // Step 2: Route based on extracted text quality
  const hasUsableText = extractedText.length > 80;

  if (hasUsableText) {
    console.log("→ Using TEXT-based processing (good text extraction)");
    return await processTextWithAI(
      extractedText,
      categoryPromptData,
      categoryIds,
      subcategoryIdsByCategory
    );
  }

  // Step 3: Try vision approach for scanned PDFs
  console.log(
    `→ Using VISION-based processing (${extractionFailed ? "extraction failed" : "minimal text found: " + extractedText.length + " chars"})`
  );

  try {
    return await processPdfAsVision(
      pdfBase64,
      categoryPromptData,
      categoryIds,
      subcategoryIdsByCategory
    );
  } catch (visionError: any) {
    // If vision also fails AND we had some text, try with what we have
    if (extractedText.length > 20) {
      console.log("Vision failed, falling back to partial text processing");
      return await processTextWithAI(
        extractedText,
        categoryPromptData,
        categoryIds,
        subcategoryIdsByCategory
      );
    }
    throw visionError;
  }
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
          pdfBuffer,
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

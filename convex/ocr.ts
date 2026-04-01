"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });
}

const DEFAULT_VISION_MODEL = "gpt-4o-mini";

function extractJsonBlock(text: string) {
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

function normalizeAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (!text) return "";
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const getFileUrl = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return null;
    return url;
  },
});

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

export const processReceiptWithAI = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    categories: v.any(),
    isPdf: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProcessReceiptResult> => {
    try {
      console.log("=== processReceiptWithAI START ===", {
        storageIdCount: args.storageIds.length,
        isPdf: args.isPdf,
        firstStorageId: args.storageIds[0]
      });
      
      // PDF path: Not supported - ask user to take photo
      if (args.isPdf) {
        console.log("PDF upload detected - rejecting (not supported)");
        throw new Error(
          "PDFy nie są obecnie obsługiwane. " +
          "Użyj aparatu w aplikacji aby zrobić zdjęcie paragonu lub faktury."
        );
      }

      // Image path: use OpenAI vision
      console.log("Processing as image");
      const url = await ctx.storage.getUrl(args.storageIds[0]);
      if (!url) throw new Error("File not found");

      const imageRes = await fetch(url);
      const arrayBuffer = await imageRes.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imageRes.headers.get("content-type") || "image/jpeg";
      
      console.log("Image loaded, sending to Vision API");

      return await processImageWithOpenAI(base64Data, mimeType, args.categories);
    } catch (error: any) {
      console.error("=== FATAL ERROR in processReceiptWithAI ===", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }
});

async function processTextWithOpenAI(
  text: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } = 
    prepareCategoryData(categories);

  const truncatedText = text.slice(0, 4000);
  
  console.log("Processing text with OpenAI:", {
    textLength: text.length,
    truncatedLength: truncatedText.length,
    preview: truncatedText.substring(0, 200)
  });
  
  const prompt = buildPrompt(categoryPromptData, truncatedText);

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: DEFAULT_VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { 
          role: "system", 
          content: "Jesteś ekspertem OCR specjalizującym się w odczycie paragonów. KRYTYCZNE: Gdy widzisz 'Opust' lub 'Rabat' pod produktem, MUSISZ użyć ceny z linii rabatu, NIE oryginalnej ceny. Zawsze używaj KOŃCOWEJ ceny po rabacie."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    console.log("OpenAI response received:", {
      contentLength: content.length,
      preview: content.substring(0, 200)
    });
    
    const result = parseAndNormalizeResponse(content, categoryIds, subcategoryIdsByCategory, DEFAULT_VISION_MODEL);
    console.log("Parsed result:", {
      itemCount: result.items.length,
      items: result.items.map(i => ({ desc: i.description, amt: i.amount }))
    });
    
    return result;
  } catch (err: any) {
    console.error("OpenAI error:", err);
    throw new Error(`Błąd AI: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`);
  }
}

async function processImageWithOpenAI(
  base64Data: string,
  mimeType: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } = 
    prepareCategoryData(categories);

  console.log("=== processImageWithOpenAI START ===", {
    mimeType,
    base64Length: base64Data.length,
    categoryCount: categoryPromptData.length,
    categories: categoryPromptData.map(c => ({ id: c.id, name: c.name, subCount: c.subcategories.length }))
  });

  const prompt = buildPrompt(categoryPromptData);
  console.log("Prompt length:", prompt.length);

  try {
    console.log("Calling OpenAI Vision API...");
    const resp = await getOpenAI().chat.completions.create({
      model: DEFAULT_VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem OCR specjalizującym się w odczycie paragonów. KRYTYCZNE: Gdy widzisz 'Opust' lub 'Rabat' pod produktem, MUSISZ użyć ceny z linii rabatu, NIE oryginalnej ceny. Zawsze używaj KOŃCOWEJ ceny po rabacie."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    console.log("=== OpenAI Vision Response ===", {
      contentLength: content.length,
      rawContent: content,
      tokensUsed: resp.usage
    });
    
    const result = parseAndNormalizeResponse(content, categoryIds, subcategoryIdsByCategory, DEFAULT_VISION_MODEL);
    console.log("=== Parsed Result ===", {
      itemCount: result.items.length,
      items: result.items
    });
    
    return result;
  } catch (err: any) {
    console.error("=== OpenAI vision error ===", {
      message: err?.message,
      error: err?.error,
      status: err?.status,
      stack: err?.stack
    });
    throw new Error(`Błąd AI: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`);
  }
}

function prepareCategoryData(categories: any) {
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const categoryIds = new Set<string>();
  const subcategoryIdsByCategory = new Map<string, Set<string>>();
  
  const categoryPromptData = categoriesArray.map((category: any) => {
    const categoryId = asString(category?._id);
    const categoryName = asString(category?.name);
    const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];

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

    return {
      id: categoryId,
      name: categoryName,
      subcategories,
    };
  });

  return { categoryPromptData, categoryIds, subcategoryIdsByCategory };
}

function buildPrompt(categoryPromptData: any[], documentText?: string) {
  const textSection = documentText 
    ? `Tekst dokumentu:\n${documentText}\n\n`
    : "";

  return `Jesteś asystentem OCR i kategoryzacji wydatków domowych.
Przeanalizuj ${documentText ? "poniższy tekst" : "obraz"} paragonu lub faktury i zwróć WSZYSTKIE pozycje zakupowe.

${textSection}ZASADY ODCZYTU:

1) CZYTAJ WSZYSTKIE PRODUKTY:
   - Przeczytaj KAŻDY produkt z paragonu/faktury
   - NIE pomijaj żadnych pozycji
   - Dla paragonów: czytaj kolumnę "Wartość" (ostatnia kolumna z ceną)
   - Dla faktur: czytaj kolumnę "Kwota"

2) RABATY (OPUST):
   - Jeśli pod produktem jest "Opust" - użyj KOŃCOWEJ ceny (po rabacie)
   - Przykład: Produkt 19.47 → Opust → 12.98 = użyj "12.98"
   - NIE twórz osobnej pozycji dla "Opust"

3) IGNORUJ:
   - Sumy ("Suma", "Suma PTU", "DO ZAPŁATY", "Należna kwota")
   - Opakowania zwrotne ("But Plastik kaucja")
   - Płatność, reszta, numery transakcji

4) FORMAT KWOTY:
   - Tylko liczba z kropką: "12.98" (bez "zł", "PLN", "USD")
   - Konwertuj przecinek na kropkę: "5,00" → "5.00"

5) KATEGORYZACJA:
   - Wybierz categoryId i subcategoryId z listy poniżej
   - Jeśli niepewne: null

Dozwolone kategorie:
${JSON.stringify(categoryPromptData, null, 2)}

WAŻNE: Zwróć WSZYSTKIE produkty z paragonu, nie pomijaj żadnych!

Zwróć JSON:
{
  "rawText": "krótka transkrypcja",
  "items": [
    {
      "description": "Nazwa produktu",
      "amount": "12.98",
      "categoryId": "id_lub_null",
      "subcategoryId": "id_lub_null"
    }
  ]
}`;
}

function parseAndNormalizeResponse(
  content: string,
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>,
  modelUsed: string
): ProcessReceiptResult {
  console.log("=== parseAndNormalizeResponse START ===");
  try {
    const extracted = extractJsonBlock(content);
    console.log("Extracted JSON block:", extracted.substring(0, 500));
    
    const parsed = JSON.parse(extracted || "{}");
    console.log("Parsed object keys:", Object.keys(parsed));
    
    const parsedItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

    console.log("Raw parsed items count:", parsedItems.length);
    console.log("Raw parsed items:", JSON.stringify(parsedItems, null, 2));

    const normalizedItems = parsedItems.map((item: any, index: number) => {
      const description = asString(item?.description) || "Nieznana pozycja";
      const rawAmount = item?.amount;
      const amount = normalizeAmount(rawAmount);

      console.log(`Item ${index}:`, {
        rawDescription: item?.description,
        description,
        rawAmount,
        amount,
        rawCategoryId: item?.categoryId,
        rawSubcategoryId: item?.subcategoryId
      });

      const categoryIdCandidate = asString(item?.categoryId);
      const categoryId = categoryIds.has(categoryIdCandidate) ? categoryIdCandidate : null;

      const subcategoryIdCandidate = asString(item?.subcategoryId);
      const isSubcategoryAllowed =
        !!categoryId &&
        !!subcategoryIdCandidate &&
        !!subcategoryIdsByCategory.get(categoryId)?.has(subcategoryIdCandidate);

      const normalized = {
        description,
        amount,
        categoryId,
        subcategoryId: isSubcategoryAllowed ? subcategoryIdCandidate : null,
      };
      
      console.log(`Item ${index} normalized:`, normalized);
      return normalized;
    });

    const rawText = asString(parsed?.rawText);
    console.log("=== parseAndNormalizeResponse END ===", {
      normalizedItemCount: normalizedItems.length,
      rawTextLength: rawText.length
    });
    
    return {
      items: normalizedItems,
      rawText,
      modelUsed,
    };
  } catch (e) {
    console.error("=== Failed to parse AI JSON ===", {
      error: e,
      content: content.substring(0, 1000)
    });
    return {
      items: [],
      rawText: "",
      modelUsed,
    };
  }
}

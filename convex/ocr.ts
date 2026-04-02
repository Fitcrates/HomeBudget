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

// Proxy supports: gpt-4o-mini, gpt-4.1-nano
const VISION_MODEL = "gpt-4o-mini";

// ── System Prompt (short for speed) ───────────────────────────────

const SYSTEM_PROMPT = `Jesteś ekspertem OCR do odczytu polskich paragonów i faktur.
Wyodrębniasz KAŻDY produkt. Rozumiesz polskie skróty paragonowe.
Nigdy nie pomijasz pozycji. Zwracasz JSON.`;

// ── Utilities ─────────────────────────────────────────────────────

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const clean = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (clean.startsWith("{") || clean.startsWith("[")) return clean;
  const f = clean.indexOf("{"), l = clean.lastIndexOf("}");
  if (f !== -1 && l > f) return clean.slice(f, l + 1);
  const fa = clean.indexOf("["), la = clean.lastIndexOf("]");
  if (fa !== -1 && la > fa) return clean.slice(fa, la + 1);
  return clean;
}

function normalizeAmount(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (!text) return "";
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Remove Polish diacritics for fuzzy matching */
function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ź/g, "z").replace(/ż/g, "z");
}

// ── Category Helpers ──────────────────────────────────────────────

/**
 * Build compact category list for prompt (names only, no IDs).
 * Format: "• Żywność i napoje: Supermarket, Nabiał i jaja, ..."
 * This is ~80% shorter than full JSON and the model understands it better.
 */
function buildCompactCategoryList(categories: any[]): string {
  return categories
    .map((cat: any) => {
      const subs = Array.isArray(cat.subcategories)
        ? cat.subcategories.map((s: any) => s.name).join(", ")
        : "";
      return `• ${cat.name}: ${subs}`;
    })
    .join("\n");
}

/**
 * Resolve category/subcategory NAMES returned by AI to Convex IDs.
 * Uses exact match first, then fuzzy (stripped diacritics) match.
 */
function resolveCategoryNames(
  categoryName: string | null | undefined,
  subcategoryName: string | null | undefined,
  categoriesArray: any[]
): { categoryId: string | null; subcategoryId: string | null } {
  if (!categoryName) return { categoryId: null, subcategoryId: null };

  const catNorm = stripDiacritics(categoryName);

  // Find category: exact → stripped diacritics → partial
  let cat = categoriesArray.find(
    (c: any) => c.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
  );
  if (!cat) {
    cat = categoriesArray.find(
      (c: any) => stripDiacritics(c.name) === catNorm
    );
  }
  if (!cat) {
    cat = categoriesArray.find(
      (c: any) =>
        stripDiacritics(c.name).includes(catNorm) ||
        catNorm.includes(stripDiacritics(c.name))
    );
  }
  if (!cat) return { categoryId: null, subcategoryId: null };

  // Find subcategory
  const subs: any[] = Array.isArray(cat.subcategories) ? cat.subcategories : [];

  if (!subcategoryName) {
    // Auto-assign first subcategory if available
    return {
      categoryId: cat._id,
      subcategoryId: subs.length > 0 ? subs[0]._id : null,
    };
  }

  const subNorm = stripDiacritics(subcategoryName);

  let sub = subs.find(
    (s: any) => s.name.toLowerCase().trim() === subcategoryName.toLowerCase().trim()
  );
  if (!sub) {
    sub = subs.find((s: any) => stripDiacritics(s.name) === subNorm);
  }
  if (!sub) {
    sub = subs.find(
      (s: any) =>
        stripDiacritics(s.name).includes(subNorm) ||
        subNorm.includes(stripDiacritics(s.name))
    );
  }

  return {
    categoryId: cat._id,
    subcategoryId: sub?._id ?? (subs.length > 0 ? subs[0]._id : null),
  };
}

// ── Prompt Builder ────────────────────────────────────────────────

function buildPrompt(
  compactCategories: string,
  documentText?: string
): string {
  const source = documentText
    ? `Tekst dokumentu:\n"""\n${documentText}\n"""\n\n`
    : "";

  return `Wyodrębnij WSZYSTKIE pozycje zakupowe z ${documentText ? "tekstu" : "obrazu/obrazów"}.
${source}ZASADY:
1. KAŻDY produkt — nie pomijaj żadnej pozycji
2. Czytaj "Wartość" (łączna cena), nie cenę jednostkową
3. Rabat/Opust → użyj ceny PO rabacie, NIE twórz osobnej pozycji
4. Ilość >1 → ŁĄCZNA wartość (3×2.50 = "7.50")
5. Kwota: tylko liczba z kropką ("12.98")
6. Ignoruj: sumy, podatki PTU, kaucje, płatności, nagłówki

KATEGORYZACJA — użyj DOKŁADNEJ nazwy z listy:
- Produkty ze sklepu → ZAWSZE "Żywność i napoje" (NIE "Restauracje"!)
- Jajka, mleko, ser, masło, jogurt → "Nabiał i jaja"
- Mięso, kiełbasa, szynka, kurczak → "Mięso i wędliny"
- Owoce, warzywa, ziemniaki → "Owoce i warzywa"
- Chleb, bułki → "Piekarnia"
- Sos, ketchup, musztarda, olej, ocet, majonez → "Przyprawy i dodatki"
- Konserwy (fasola, kukurydza, tuńczyk, pomidory) → "Przyprawy i dodatki"
- Makaron, ryż, mąka, kasza → "Produkty sypkie"
- Czekolada, chipsy, cukierki → "Słodycze i przekąski"
- Woda, sok, cola → "Napoje bezalkoholowe"
- Piwo, wino → "Alkohol"
- Mrożonki → "Mrożonki"
- Torba/reklamówka → kategoria "Inne", podkategoria "Różne"
- Środki czystości → "Chemia domowa i higiena"
- Leki → "Zdrowie i uroda" > "Apteka"

KATEGORIE:
${compactCategories}

JSON:
{
  "rawText": "Nazwa sklepu, data",
  "items": [
    {
      "description": "Nazwa produktu",
      "amount": "12.98",
      "category": "Żywność i napoje",
      "subcategory": "Nabiał i jaja"
    }
  ]
}`;
}

// ── Response Parser ───────────────────────────────────────────────

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

function parseAndNormalizeResponse(
  content: string,
  categoriesArray: any[],
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

        // Resolve category NAMES to Convex IDs
        const { categoryId, subcategoryId } = resolveCategoryNames(
          asString(item?.category),
          asString(item?.subcategory),
          categoriesArray
        );

        return { description, amount, categoryId, subcategoryId };
      })
      .filter(
        (item: ProcessedReceiptItem) =>
          item.amount || item.description !== "Nieznana pozycja"
      );

    console.log(
      `Normalized: ${normalizedItems.length} items (model: ${modelUsed})`
    );

    return {
      items: normalizedItems,
      rawText: asString(parsed?.rawText),
      modelUsed,
    };
  } catch (e) {
    console.error("Failed to parse AI JSON:", e);
    console.error("Content preview:", content.substring(0, 300));
    return { items: [], rawText: "", modelUsed };
  }
}

// ── AI Processing: Images ─────────────────────────────────────────

async function processImagesWithAI(
  imageDataList: { base64: string; mimeType: string }[],
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult> {
  const prompt = buildPrompt(compactCategories);

  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text" as const, text: prompt },
  ];

  for (const img of imageDataList) {
    contentParts.push({
      type: "image_url" as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
        detail: "high",
      },
    });
  }

  console.log("→ GPT-4o-mini vision:", {
    imageCount: imageDataList.length,
    promptLength: prompt.length,
  });

  const resp = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.05,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contentParts },
    ],
    response_format: { type: "json_object" },
  });

  const content = resp.choices[0].message.content ?? "{}";
  console.log("Vision response:", {
    len: content.length,
    tokens: resp.usage,
  });

  return parseAndNormalizeResponse(content, categoriesArray, VISION_MODEL);
}

// ── AI Processing: Text ───────────────────────────────────────────

async function processTextWithAI(
  text: string,
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult> {
  const prompt = buildPrompt(compactCategories, text.slice(0, 8000));

  const resp = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.05,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = resp.choices[0].message.content ?? "{}";
  return parseAndNormalizeResponse(content, categoriesArray, VISION_MODEL);
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
      console.log("=== processReceiptWithAI ===", {
        count: args.storageIds.length,
        isPdf: args.isPdf,
      });

      if (args.storageIds.length === 0) {
        throw new Error("Nie przesłano żadnych plików.");
      }

      const categoriesArray = Array.isArray(args.categories)
        ? args.categories
        : [];
      if (categoriesArray.length === 0) {
        throw new Error("Brak kategorii.");
      }

      const compactCategories = buildCompactCategoryList(categoriesArray);

      // PDF path: client should have converted to images already.
      // If somehow a raw PDF arrives, show helpful error.
      if (args.isPdf) {
        throw new Error(
          "Przetwarzanie PDF odbywa się po stronie przeglądarki. " +
            "Jeśli widzisz ten błąd, odśwież stronę i spróbuj ponownie."
        );
      }

      // Fetch ALL images
      const imageDataList: { base64: string; mimeType: string }[] = [];

      for (const storageId of args.storageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (!url) continue;

        const res = await fetch(url);
        if (!res.ok) continue;

        const buf = await res.arrayBuffer();
        imageDataList.push({
          base64: Buffer.from(buf).toString("base64"),
          mimeType: res.headers.get("content-type") || "image/jpeg",
        });
      }

      if (imageDataList.length === 0) {
        throw new Error("Nie udało się załadować obrazów.");
      }

      const result = await processImagesWithAI(
        imageDataList,
        compactCategories,
        categoriesArray
      );

      const ms = Date.now() - startTime;
      console.log(`=== DONE === ${result.items.length} items in ${ms}ms`);
      return result;
    } catch (error: any) {
      console.error("=== ERROR ===", error.message);
      throw error;
    }
  },
});

"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import OpenAI from "openai";

// ── Configuration ─────────────────────────────────────────────────

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Groq (GROQ_API_KEY). Skonfiguruj go w ustawieniach Convex.");
  }
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

// Groq replaced 11b and 90b vision with Llama 4 Scout
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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
1. KAŻDY produkt — nie pomijaj żadnej pozycji.
2. Czytaj "Wartość" (łączna cena), nie cenę jednostkową.
3. Rabat/Opust → użyj ceny PO rabacie, NIE twórz osobnej pozycji.
4. Ilość >1 → ŁĄCZNA wartość (3×2.50 = "7.50").
5. Kwota: tylko liczba z kropką ("12.98").
6. Ignoruj: sumy, podatki PTU, kaucje, płatności, nagłówki.

DOPASOWANIE KATEGORII DO WYSTAWCY (BARDZO WAŻNE!):
- Najpierw zidentyfikuj wystawcę rachunku (np. po logo, nagłówku). To absolutnie kluczowe dla właściwej kategoryzacji artykułów.
- Biedronka, Lidl, Auchan, Kaufland, Żabka, Dino, Netto, Carrefour, Stokrotka: pozycje to niemal wyłącznie "Żywność i napoje" oraz "Chemia domowa i higiena". (ZAKAZ kategoryzacji do Restauracji dla zwykłego jedzenia ze sklepu!).
- Rossmann, Hebe, Super-Pharm, Sephora, Douglas: pozycje z tych sklepów to na 99% "Zdrowie i uroda" -> np. "Kosmetyki" lub "Chemia domowa i higiena".
- Castorama, Leroy Merlin, OBI, Mrówka, Jysk, IKEA, Agata Meble, Bricomarché: domyślnie "Dom i mieszkanie" -> np. "Wyposażenie" lub "Remonty". (BARDZO rzadko inne, chyba, że ktoś kupił tam hot-doga).
- Orlen, BP, Shell, Circle K, Amic, Moya, Lotos: dla produktów typu PB95, ON, LPG przydzielaj "Transport" -> "Paliwo". Reszta jedzenia ze stacji to np. "Restauracje i kawiarnie" -> "Fast food" lub "Przekąski" / "Słodycze i przekąski".
- Apteki (DOZ, Gemini, Ziko, Cefarm, Dr.Max): WSZYSTKIE Leki i suplementy kategoryzuj jako "Zdrowie i uroda" -> "Apteka". (Żadnej Chemii domowej dla leków!).
- Maxi Zoo, Kakadu, sklepy zoologiczne: pozycje to domyślnie kategoria "Zwierzęta".
- Piekarnie/Cukiernie (np. Lubaszka, Hert, rzemieślnicze): kategoria "Piekarnia" (w Żywność i napoje) lub kawiarniana.
- Empik: pozycje takie jak książki, gazety przypisuj do "Rozrywka i hobby" -> "Książki". Zawsze sprawdź, co to za sklep!

KATEGORYZACJA SZCZEGÓŁOWA — użyj DOKŁADNEJ nazwy z listy:
- Produkty sklepowe typu kiełbasy czy ziemniaki PRAWIE ZAWSZE należą do podkategorii w "Żywność i napoje"! 
- Jajka, mleko, ser, masło, jogurt → "Nabiał i jaja"
- Mięso, parówki, szynka, kurczak → "Mięso i wędliny"
- Owoce, warzywa, ziemniaki → "Owoce i warzywa"
- Chleb, bułki → "Piekarnia"
- Sos, ketchup, musztarda, olej, majonez → "Przyprawy i dodatki"
- Konserwy (fasola, kukurydza, tuńczyk) → "Przyprawy i dodatki"
- Makaron, ryż, mąka, kasza → "Produkty sypkie"
- Czekolada, chipsy, cukierki → "Słodycze i przekąski"
- Woda, sok, cola → "Napoje bezalkoholowe"
- Piwo, wino, wódka → "Alkohol"
- Mrożonki, lody → "Mrożonki"
- Torba/reklamówka z logo sklepu → "Inne" > "Różne"
- Czystość (płyny, proszki, papier toaletowy) → "Chemia domowa i higiena"

KATEGORIE:
${compactCategories}

JSON:
{
  "rawText": "TUTAJ WPISZ TYLKO I WYŁĄCZNIE NAZWĘ MARKI I WYSTAWCY (np. 'Biedronka', 'Castorama', 'Orlen') ORAZ DATĘ",
  "currency": "PLN (lub USD, EUR, GBP - wykryta waluta)",
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

async function fetchExchangeRate(currencyCode: string): Promise<number> {
  const code = currencyCode.toUpperCase();
  if (code === "PLN" || !code) return 1;
  try {
    const res = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`);
    if (!res.ok) return 1;
    const data = await res.json();
    return data?.rates?.[0]?.mid || 1;
  } catch (err) {
    console.error(`Failed to fetch exchange rate for ${code}`, err);
    return 1;
  }
}

async function parseAndNormalizeResponse(
  content: string,
  categoriesArray: any[],
  modelUsed: string
): Promise<ProcessReceiptResult> {
  try {
    const extracted = extractJsonBlock(content);
    const parsed = JSON.parse(extracted || "{}");

    const parsedItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

    const currency = asString(parsed?.currency).toUpperCase();
    const exchangeRate = await fetchExchangeRate(currency);

    console.log(`AI returned ${parsedItems.length} raw items (Currency: ${currency}, Rate: ${exchangeRate})`);

    const normalizedItems: ProcessedReceiptItem[] = parsedItems
      .map((item: any) => {
        const description = asString(item?.description) || "Nieznana pozycja";
        let amountStr = normalizeAmount(item?.amount);
        
        // Convert currency if needed
        if (amountStr && exchangeRate !== 1) {
          const num = parseFloat(amountStr) * exchangeRate;
          amountStr = num.toFixed(2);
        }

        // Resolve category NAMES to Convex IDs
        const { categoryId, subcategoryId } = resolveCategoryNames(
          asString(item?.category),
          asString(item?.subcategory),
          categoriesArray
        );

        const descWithCurrency = exchangeRate !== 1 
          ? `${description} (${normalizeAmount(item?.amount)} ${currency})` 
          : description;

        return { description: descWithCurrency, amount: amountStr, categoryId, subcategoryId };
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
    { type: "text", text: prompt },
  ];

  for (const img of imageDataList) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
      },
    });
  }

  console.log(`→ Groq vision (${VISION_MODEL}):`, {
    imageCount: imageDataList.length,
    promptLength: prompt.length,
  });

  const resp = await getGroq().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contentParts },
    ],
  });

  const content = resp.choices[0].message.content ?? "{}";
  console.log("Vision response:", {
    len: content.length,
    model: resp.model
  });

  return await parseAndNormalizeResponse(content, categoriesArray, VISION_MODEL);
}

// ── AI Processing: Text ───────────────────────────────────────────

async function processTextWithAI(
  text: string,
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult> {
  const prompt = buildPrompt(compactCategories, text.slice(0, 8000));

  const resp = await getGroq().chat.completions.create({
    model: VISION_MODEL, // Vision model can also accept pure text
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = resp.choices[0].message.content ?? "{}";
  return await parseAndNormalizeResponse(content, categoriesArray, VISION_MODEL);
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



      // Fetch ALL images
      const imageDataList: { base64: string; mimeType: string }[] = [];

      for (const storageId of args.storageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (!url) continue;

        const fileRes = await fetch(url);
        if (!fileRes.ok) continue;

        const arrayBuffer = await fileRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = (fileRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        
        imageDataList.push({ base64, mimeType });
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

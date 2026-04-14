"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractGroqStatusCode(error: any): number | null {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isRetriableGroqError(error: any): boolean {
  const status = extractGroqStatusCode(error);
  if (status !== null && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("over capacity") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporar") ||
    message.includes("try again")
  );
}

async function createGroqCompletionWithRetry(
  request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  label: string,
  maxAttempts = 4
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getGroq().chat.completions.create(request);
    } catch (error: any) {
      lastError = error;
      const retriable = isRetriableGroqError(error);
      const status = extractGroqStatusCode(error);

      console.error(`Groq OCR call failed (${label})`, {
        attempt,
        maxAttempts,
        status,
        message: String(error?.message || error),
        retriable,
      });

      if (!retriable || attempt === maxAttempts) {
        break;
      }

      const delayMs = 1200 * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }

  const status = extractGroqStatusCode(lastError);
  if (status === 503 || isRetriableGroqError(lastError)) {
    throw new Error("Model OCR jest chwilowo przeciążony. Spróbuj ponownie za kilkanaście sekund.");
  }

  throw lastError;
}

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
  const parsed = parseAmountNumber(value);
  if (parsed === null || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function parseAmountNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.replace(/\s+/g, "").replace(/,/g, ".");
  const trailingMinus = normalized.endsWith("-");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  let parsed = Number.parseFloat(match[0]);
  if (trailingMinus && parsed > 0) {
    parsed = -parsed;
  }
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isDiscountLikeDescription(description: string): boolean {
  const text = stripDiacritics(description);
  return /(rabat|opust|promoc|kupon|coupon|bonifikat|znizk|obnizk|program|lojalnosc|aplikacj|karta|taniej|minus)/i.test(text);
}

function isDepositLikeDescription(description: string): boolean {
  const text = stripDiacritics(description);
  return /(kaucj|opakowan|zwrotn|butelk|puszk)/i.test(text);
}

function isTechnicalLine(description: string): boolean {
  const text = stripDiacritics(description);
  return /(suma|podsuma|sprzedaz|sprzedaz opodatkowana|ptu|rozliczenie|platnosc|karta|gotowka|paragon|fiskalny|nip|adres)/i.test(text);
}

function tokenizeDescription(description: string): string[] {
  const normalized = stripDiacritics(description)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const stopWords = new Set([
    "rabat", "promocja", "promocji", "opust", "kupon", "aplikacja", "aplikacji",
    "program", "klienta", "karta", "minus", "znizka", "bonifikata", "paragon",
  ]);

  return normalized
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function normalizeDescriptionKey(description: string): string {
  return stripDiacritics(description)
    .replace(/\b\d+(?:[.,]\d+)?\s*(ml|l|g|kg|szt|tab|tbl|cl)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupReceiptLineDescription(description: string): string {
  return description
    .replace(/\s+[A-Z]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestDiscountCandidate(
  normalizedItems: ProcessedReceiptItem[],
  receiptIndex: number,
  discountDescription: string,
  discountInPln: number
): ProcessedReceiptItem | null {
  const discountTokens = tokenizeDescription(discountDescription);

  let bestCandidate: ProcessedReceiptItem | null = null;
  let bestScore = -1;

  for (let i = normalizedItems.length - 1; i >= 0; i--) {
    const candidate = normalizedItems[i];
    if (candidate.receiptIndex !== receiptIndex) continue;
    const candidateAmount = parseFloat(candidate.amount);
    if (!(candidateAmount > discountInPln + 0.001)) continue;

    const candidateTokens = tokenizeDescription(candidate.originalRawDescription || candidate.description);
    const overlap = discountTokens.length > 0
      ? discountTokens.filter((token) => candidateTokens.includes(token)).length
      : 0;

    const recencyBonus = (normalizedItems.length - i) * 0.05;
    const score = overlap * 10 + recencyBonus;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) return bestCandidate;

  return normalizedItems
    .filter((item) => item.receiptIndex === receiptIndex)
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))[0] ?? null;
}

function buildDiscountLineItem(
  normalizedItems: ProcessedReceiptItem[],
  receiptIndex: number,
  receiptLabel: string,
  sourceImageIndex: number | null,
  discountDescription: string,
  discountInPln: number
): ProcessedReceiptItem | null {
  if (!(discountInPln > 0)) return null;

  const matchedCandidate = findBestDiscountCandidate(
    normalizedItems,
    receiptIndex,
    discountDescription,
    discountInPln
  );
  const cleanedDescription = cleanupReceiptLineDescription(discountDescription) || "Rabat / opust";

  return {
    description: `Rabat: ${cleanedDescription}`,
    originalRawDescription: cleanedDescription,
    amount: (-discountInPln).toFixed(2),
    categoryId: matchedCandidate?.categoryId ?? null,
    subcategoryId: matchedCandidate?.subcategoryId ?? null,
    fromMapping: false,
    receiptIndex,
    receiptLabel,
    sourceImageIndex,
  };
}

function enrichReceiptSummariesWithValidation(
  summaries: ReceiptSummary[],
  items: ProcessedReceiptItem[]
): ReceiptSummary[] {
  return summaries.map((summary) => {
    const itemsTotal = items
      .filter((item) => item.receiptIndex === summary.receiptIndex)
      .reduce((acc, item) => acc + parseFloat(item.amount || "0"), 0);

    const expected = parseFloat(summary.totalAmount || "0");
    const diff = itemsTotal - expected;
    const mismatchType = !(expected > 0)
      ? "unknown"
      : Math.abs(diff) <= 0.05
        ? "ok"
        : diff > 0
          ? "missing_discounts"
          : "missing_items";

    return {
      ...summary,
      itemsTotal: itemsTotal.toFixed(2),
      difference: diff.toFixed(2),
      mismatchType,
    };
  });
}

function collapseLikelyDuplicateItems(
  items: ProcessedReceiptItem[],
  summaries: ReceiptSummary[]
): ProcessedReceiptItem[] {
  let nextItems = [...items];

  for (const summary of summaries) {
    const expected = parseFloat(summary.totalAmount || "0");
    if (!(expected > 0)) continue;

    let receiptItems = nextItems.filter((item) => item.receiptIndex === summary.receiptIndex);
    let currentTotal = receiptItems.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
    const currentDiff = Math.abs(currentTotal - expected);
    if (currentDiff <= 0.05) continue;

    const groups = new Map<string, ProcessedReceiptItem[]>();
    for (const item of receiptItems) {
      const key = `${normalizeDescriptionKey(item.originalRawDescription || item.description)}|${item.amount}`;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    for (const [, group] of groups) {
      if (group.length <= 1) continue;

      const amount = parseFloat(group[0].amount || "0");
      if (!(amount > 0)) continue;

      const candidateTotal = currentTotal - amount * (group.length - 1);
      const candidateDiff = Math.abs(candidateTotal - expected);
      if (candidateDiff + 0.01 >= currentDiff) continue;

      const idsToRemove = new Set(group.slice(1).map((item) => item.description + item.amount + item.receiptIndex + (item.originalRawDescription || "")));
      let removed = 0;
      nextItems = nextItems.filter((item) => {
        const id = item.description + item.amount + item.receiptIndex + (item.originalRawDescription || "");
        if (item.receiptIndex === summary.receiptIndex && idsToRemove.has(id) && removed < group.length - 1) {
          removed++;
          return false;
        }
        return true;
      });

      receiptItems = nextItems.filter((item) => item.receiptIndex === summary.receiptIndex);
      currentTotal = receiptItems.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
    }
  }

  return nextItems;
}

function parseAuditedTranscribedLines(
  lines: string[],
  receiptIndex: number,
  receiptLabel: string,
  sourceImageIndex: number | null,
  exchangeRate: number
): ProcessedReceiptItem[] {
  const items: ProcessedReceiptItem[] = [];

  for (const rawLine of lines) {
    const line = asString(rawLine);
    if (!line) continue;

    const normalizedLine = line.replace(/\s+/g, " ").trim();
    const stripped = stripDiacritics(normalizedLine);
    if (!normalizedLine || isTechnicalLine(normalizedLine) || isDepositLikeDescription(normalizedLine)) {
      continue;
    }

    const discountMatch = normalizedLine.match(/^opust\s+(.+?)\s+(-?\d+[.,]\d{2})$/i);
    if (discountMatch) {
      const discountDescription = cleanupReceiptLineDescription(discountMatch[1] || "");
      const discountAbs = Math.abs(parseAmountNumber(discountMatch[2]) || 0);
      if (discountAbs > 0) {
        const discountInPln = exchangeRate !== 1 ? discountAbs * exchangeRate : discountAbs;
        const discountItem = buildDiscountLineItem(
          items,
          receiptIndex,
          receiptLabel,
          sourceImageIndex,
          discountDescription,
          discountInPln
        );
        if (discountItem) {
          items.push(discountItem);
        }
      }
      continue;
    }

    const resultOnlyMatch = normalizedLine.match(/^-?\d+[.,]\d{2}[A-Z]?$/);
    if (resultOnlyMatch) {
      continue;
    }

    const pricedLineMatch = normalizedLine.match(/^(.*?)(?:\s+[A-Z])?\s+(\d+)\s*x\s*(\d+[.,]\d{2})\s+(-?\d+[.,]\d{2})(?:[A-Z])?$/i);
    if (!pricedLineMatch) {
      continue;
    }

    const description = cleanupReceiptLineDescription(pricedLineMatch[1] || "");
    const totalRaw = pricedLineMatch[4];
    const parsedAmount = parseAmountNumber(totalRaw);

    if (!description || parsedAmount === null || parsedAmount <= 0) continue;
    if (isDiscountLikeDescription(description) || isDepositLikeDescription(description) || isTechnicalLine(description)) continue;

    const amount = exchangeRate !== 1 ? parsedAmount * exchangeRate : parsedAmount;
    items.push({
      description,
      originalRawDescription: description,
      amount: amount.toFixed(2),
      categoryId: null,
      subcategoryId: null,
      fromMapping: false,
      receiptIndex,
      receiptLabel,
      sourceImageIndex,
    });
  }

  return items;
}

function parseAuditedProductLines(
  lines: unknown[],
  receiptIndex: number,
  receiptLabel: string,
  sourceImageIndex: number | null,
  exchangeRate: number
): ProcessedReceiptItem[] {
  const items: ProcessedReceiptItem[] = [];

  for (const entry of lines) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const description = cleanupReceiptLineDescription(asString(row.description));
    const totalRaw = row.total;
    const parsedAmount = parseAmountNumber(totalRaw);

    if (!description || parsedAmount === null || parsedAmount <= 0) continue;
    if (isTechnicalLine(description) || isDepositLikeDescription(description) || isDiscountLikeDescription(description)) continue;

    const amount = exchangeRate !== 1 ? parsedAmount * exchangeRate : parsedAmount;
    items.push({
      description,
      originalRawDescription: description,
      amount: amount.toFixed(2),
      categoryId: null,
      subcategoryId: null,
      fromMapping: false,
      receiptIndex,
      receiptLabel,
      sourceImageIndex,
    });
  }

  return items;
}

function scaleAmountForCurrency(amount: string, exchangeRate: number): string {
  if (!amount) return "";
  const parsed = parseFloat(amount);
  if (!(parsed > 0)) return "";
  return exchangeRate !== 1 ? (parsed * exchangeRate).toFixed(2) : parsed.toFixed(2);
}

function normalizeExpectedTotals(
  totalAmountRaw: unknown,
  payableAmountRaw: unknown,
  depositTotalRaw: unknown,
  exchangeRate: number
): {
  totalAmount: string;
  payableAmount: string;
  depositTotal: string;
} {
  let totalAmount = normalizeAmount(totalAmountRaw);
  let payableAmount = normalizeAmount(payableAmountRaw);
  let depositTotal = normalizeAmount(depositTotalRaw);

  if (!depositTotal && totalAmount && payableAmount) {
    const inferredDeposit = parseFloat(payableAmount) - parseFloat(totalAmount);
    if (inferredDeposit > 0.05) {
      depositTotal = inferredDeposit.toFixed(2);
    }
  }

  if (!totalAmount && payableAmount && depositTotal) {
    const inferredTotal = parseFloat(payableAmount) - parseFloat(depositTotal);
    if (inferredTotal > 0) {
      totalAmount = inferredTotal.toFixed(2);
    }
  }

  return {
    totalAmount: scaleAmountForCurrency(totalAmount, exchangeRate),
    payableAmount: scaleAmountForCurrency(payableAmount, exchangeRate),
    depositTotal: scaleAmountForCurrency(depositTotal, exchangeRate),
  };
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

function resolveHeuristicCategory(
  description: string,
  categoriesArray: any[]
): { categoryId: string | null; subcategoryId: string | null } | null {
  const text = stripDiacritics(description);

  if (/(krzew|rosl|roslina|kwiat|bukiet|lawend|pelarg|surfin|sadzon|ogrod|balkon|donicz|ziemia ogrod|nawoz)/i.test(text)) {
    return resolveCategoryNames("Dom i mieszkanie", "Ogród i balkon", categoriesArray);
  }

  if (/(piwo|lager|ipa|porter|pils|ale\b|nep\b|vodka|wino|whisk|gin\b)/i.test(text)) {
    return resolveCategoryNames("Żywność i napoje", "Alkohol", categoriesArray);
  }

  if (/(jogurt|mleko|maslo|masło|ser|twarog|twaróg|serek|smietan|śmietan|kefir)/i.test(text)) {
    return resolveCategoryNames("Żywność i napoje", "Nabiał i jaja", categoriesArray);
  }

  if (/(rukola|surowka|sur[oó]wka|pomidor|ogorek|ogórek|salat|sałat|warzyw|owoc)/i.test(text)) {
    return resolveCategoryNames("Żywność i napoje", "Owoce i warzywa", categoriesArray);
  }

  if (/(granola|makaron|ryz|ryż|maka|mąka|kasza|platk|płatk)/i.test(text)) {
    return resolveCategoryNames("Żywność i napoje", "Produkty sypkie", categoriesArray);
  }

  if (/(pasta do zeb|pasta do zęb|szampon|mydlo|mydło|dezodor|szczotecz|higien)/i.test(text)) {
    return resolveCategoryNames("Chemia domowa i higiena", "Higiena osobista", categoriesArray);
  }

  if (/(calcium|wit|vit|tablet|tabl|lek|suplement)/i.test(text)) {
    return resolveCategoryNames("Zdrowie i uroda", "Apteka", categoriesArray);
  }

  return null;
}

function findSuspiciousDuplicateReceipts(items: ProcessedReceiptItem[]): number[] {
  const duplicates = new Set<number>();
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = `${item.receiptIndex}|${normalizeDescriptionKey(item.originalRawDescription || item.description)}|${item.amount}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of counts) {
    if (count <= 1) continue;
    duplicates.add(Number.parseInt(key.split("|")[0] || "0", 10));
  }

  return [...duplicates];
}

// ── Prompt Builder ────────────────────────────────────────────────

function buildPrompt(
  compactCategories: string,
  documentText?: string
): string {
  const source = documentText
    ? `Tekst dokumentu:\n"""\n${documentText}\n"""\n\n`
    : "";

  return `Wyodrebnij WSZYSTKIE pozycje zakupowe z ${documentText ? "tekstu" : "obrazu/obrazow"}.
${source}ZASADY:
1. Kazdy produkt - nie pomijaj zadnej pozycji.
2. Czytaj wartosc laczna pozycji, nie cene jednostkowa.
3. Rabat/Opust/Promocja/Kupon musi byc uwzgledniony w finalnej cenie pozycji.
4. Jesli rabat jest pokazany jako osobna linia, mozesz zwrocic go jako osobna pozycje z ujemna kwota zamiast wciskac go w pierwszy produkt.
5. Ilosc >1 -> LACZNA wartosc (np. 3x2.50 = "7.50").
6. Kaucje za opakowania zwrotne NIE sa zwyklymi produktami. Nie dodawaj ich do items, ale zwroc je osobno jako depositTotal.
7. Jesli widzisz zarowno "SUMA PLN"/"Podsuma" jak i "DO ZAPLATY", to:
- totalAmount = suma towarow po rabatach, bez kaucji i bez platnosci
- payableAmount = koncowa kwota do zaplaty
- depositTotal = suma kaucji / opakowan zwrotnych
- items musza sumowac sie do totalAmount, nie do payableAmount
8. Ignoruj naglowki, PTU, platnosci karta/gotowka, rozliczenie platnosci i inne linie techniczne.
9. Jesli na przeslanych obrazach sa rozne paragony, rozdziel je do osobnych grup.

DOPASOWANIE KATEGORII DO WYSTAWCY:
- Najpierw zidentyfikuj sklep lub wystawce rachunku.
- Biedronka, Lidl, Auchan, Kaufland, Zabka, Dino, Netto, Carrefour, Stokrotka: pozycje to zwykle "Zywnosc i napoje" albo "Chemia domowa i higiena".
- Rossmann, Hebe, Super-Pharm, Sephora, Douglas: zwykle "Zdrowie i uroda".
- Castorama, Leroy Merlin, OBI, Jysk, IKEA, Agata Meble: zwykle "Dom i mieszkanie".
- Orlen, BP, Shell, Circle K, Amic, Moya, Lotos: paliwo -> "Transport" / "Paliwo".
- Apteki (DOZ, Gemini, Ziko, Cefarm, Dr.Max): leki i suplementy -> "Zdrowie i uroda" / "Apteka".
- Sklepy zoologiczne: domyslnie "Zwierzeta".

KATEGORYZACJA SZCZEGOLOWA:
- Jajka, mleko, ser, maslo, jogurt -> "Nabial i jaja"
- Mieso, parowki, szynka, kurczak -> "Mieso i wedliny"
- Owoce, warzywa, ziemniaki -> "Owoce i warzywa"
- Chleb, bulki -> "Piekarnia"
- Makaron, ryz, maka, kasza -> "Produkty sypkie"
- Czekolada, chipsy, cukierki -> "Slodycze i przekaski"
- Woda, sok, cola -> "Napoje bezalkoholowe"
- Piwo, wino, wodka -> "Alkohol"
- Czystosc (plyny, proszki, papier toaletowy) -> "Chemia domowa i higiena"

KATEGORIE:
${compactCategories}

JSON:
{
  "rawText": "Tylko marka/sklep i data, np. 'Lidl 2026-04-11'",
  "currency": "PLN",
  "totalAmount": "Suma towarow po rabatach, bez kaucji, np. '83.99'",
  "payableAmount": "Kwota do zaplaty, jesli wystepuje, np. '84.99'",
  "depositTotal": "Suma kaucji, jesli wystepuje, np. '1.00'",
  "receiptCount": 1,
  "receipts": [
    {
      "receiptIndex": 0,
      "receiptLabel": "Lidl 2026-04-11",
      "sourceImageIndex": 1,
      "totalAmount": "83.99",
      "payableAmount": "84.99",
      "depositTotal": "1.00",
      "items": [
        {
          "description": "Nazwa produktu",
          "amount": "12.98",
          "category": "Zywnosc i napoje",
          "subcategory": "Nabial i jaja"
        }
      ]
    }
  ],
  "items": [
    {
      "description": "Nazwa produktu",
      "amount": "12.98",
      "category": "Zywnosc i napoje",
      "subcategory": "Nabial i jaja"
    }
  ]
}`;
}

// Response Parser ───────────────────────────────────────────────

interface ProcessedReceiptItem {
  description: string;
  originalRawDescription?: string; // Keep track of AI's raw output for the learning loop
  amount: string;
  categoryId: string | null;
  subcategoryId: string | null;
  fromMapping?: boolean; // True if this was resolved from user history rather than AI inference
  receiptIndex: number;
  receiptLabel?: string;
  sourceImageIndex?: number | null;
}

interface ReceiptSummary {
  receiptIndex: number;
  receiptLabel: string;
  totalAmount: string;
  payableAmount?: string;
  depositTotal?: string;
  sourceImageIndex: number | null;
  itemsTotal?: string;
  difference?: string;
  mismatchType?: "ok" | "missing_items" | "missing_discounts" | "unknown";
}

interface ProcessReceiptResult {
  items: ProcessedReceiptItem[];
  rawText: string;
  totalAmount: string;
  payableAmount?: string;
  depositTotal?: string;
  modelUsed: string;
  receiptCount: number;
  receiptSummaries: ReceiptSummary[];
}

type AuditedLineCandidate = {
  item: ProcessedReceiptItem;
  receiptIndex: number;
  receiptLabel: string;
  sourceImageIndex: number | null;
};

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
  ctx: any,
  householdId: string,
  content: string,
  categoriesArray: any[],
  modelUsed: string
): Promise<ProcessReceiptResult> {
  try {
    const extracted = extractJsonBlock(content);
    const parsed = JSON.parse(extracted || "{}");

    type ParsedItemWithMeta = {
      item: any;
      receiptIndex: number;
      receiptLabel: string;
      sourceImageIndex: number | null;
    };

    const receiptEntries = Array.isArray(parsed?.receipts) ? parsed.receipts : [];
    const auditTranscribedLines = Array.isArray(parsed?.audit?.transcribedLines)
      ? parsed.audit.transcribedLines.filter((line: unknown) => typeof line === "string")
      : [];
    const auditProductLines = Array.isArray(parsed?.audit?.productLines)
      ? parsed.audit.productLines
      : [];

    const parsedItemsWithMeta: ParsedItemWithMeta[] = receiptEntries.length > 0
      ? receiptEntries.flatMap((receipt: any, idx: number) => {
        const receiptItems = Array.isArray(receipt?.items) ? receipt.items : [];
        const sourceImageIndexRaw = Number.parseInt(String(receipt?.sourceImageIndex ?? ""), 10);
        const sourceImageIndex = Number.isFinite(sourceImageIndexRaw) && sourceImageIndexRaw > 0
          ? sourceImageIndexRaw
          : null;
        const receiptLabel = asString(receipt?.receiptLabel) || `Paragon ${idx + 1}`;
        return receiptItems.map((item: any) => ({
          item,
          receiptIndex: idx,
          receiptLabel,
          sourceImageIndex,
        }));
      })
      : (Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : []).map((item: any) => ({
            item,
            receiptIndex: Number.isFinite(item?.receiptIndex) ? item.receiptIndex : 0,
            receiptLabel: asString(item?.receiptLabel) || "Paragon 1",
            sourceImageIndex: null,
          }));

    const parsedItems = parsedItemsWithMeta.map((entry) => entry.item);

    const currency = asString(parsed?.currency).toUpperCase();
    const exchangeRate = await fetchExchangeRate(currency);
    const auditedLineCandidates: AuditedLineCandidate[] = (auditProductLines.length > 0 || auditTranscribedLines.length > 0)
      ? (() => {
        const fallbackLabel = receiptEntries.length > 0
          ? asString(receiptEntries[0]?.receiptLabel) || "Paragon 1"
          : "Paragon 1";
        const fallbackSourceImageIndexRaw = Number.parseInt(String(receiptEntries[0]?.sourceImageIndex ?? ""), 10);
        const fallbackSourceImageIndex = Number.isFinite(fallbackSourceImageIndexRaw) && fallbackSourceImageIndexRaw > 0
          ? fallbackSourceImageIndexRaw
          : null;

        const parsedProductLines = parseAuditedProductLines(
          auditProductLines,
          0,
          fallbackLabel,
          fallbackSourceImageIndex,
          exchangeRate
        );
        const parsedTranscribedLines = parseAuditedTranscribedLines(
          auditTranscribedLines,
          0,
          fallbackLabel,
          fallbackSourceImageIndex,
          exchangeRate
        );
        const selectedAuditItems = parsedProductLines.length > 0 ? parsedProductLines : parsedTranscribedLines;

        return selectedAuditItems.map((item) => ({
          item,
          receiptIndex: item.receiptIndex,
          receiptLabel: item.receiptLabel || fallbackLabel,
          sourceImageIndex: item.sourceImageIndex ?? fallbackSourceImageIndex,
        }));
      })()
      : [];
    
    const normalizedTopLevelTotals = normalizeExpectedTotals(
      parsed?.totalAmount,
      parsed?.payableAmount,
      parsed?.depositTotal,
      exchangeRate
    );
    const totalAmount = normalizedTopLevelTotals.totalAmount;
    const payableAmount = normalizedTopLevelTotals.payableAmount;
    const depositTotal = normalizedTopLevelTotals.depositTotal;

    console.log(`AI returned ${parsedItems.length} raw items (Currency: ${currency}, Rate: ${exchangeRate}, Total: ${totalAmount}, Payable: ${payableAmount}, Deposit: ${depositTotal})`);

    const normalizedItems: ProcessedReceiptItem[] = [];

    for (const entry of parsedItemsWithMeta) {
      const item = entry.item;
      const originalRawDesc = asString(item?.description) || "Nieznana pozycja";
      const parsedAmount = parseAmountNumber(item?.amount);

      if (parsedAmount === null || parsedAmount === 0) continue;

      const isDiscountLine = isDiscountLikeDescription(originalRawDesc) || parsedAmount < 0;
      if (isDiscountLine) {
        const discountAbs = Math.abs(parsedAmount);
        const discountInPln = exchangeRate !== 1 ? discountAbs * exchangeRate : discountAbs;

        const discountItem = buildDiscountLineItem(
          normalizedItems,
          entry.receiptIndex,
          entry.receiptLabel,
          entry.sourceImageIndex,
          originalRawDesc,
          discountInPln
        );
        if (discountItem) {
          normalizedItems.push(discountItem);
        }
        continue;
      }

      if (isDepositLikeDescription(originalRawDesc)) {
        continue;
      }

      let amount = parsedAmount;
      if (exchangeRate !== 1) {
        amount = amount * exchangeRate;
      }

      let categoryId: string | null = null;
      let subcategoryId: string | null = null;
      const fromMapping = false;
      const resolvedDescription = originalRawDesc;

      const descWithCurrency = exchangeRate !== 1
        ? `${resolvedDescription} (${Math.abs(parsedAmount).toFixed(2)} ${currency})`
        : resolvedDescription;

      normalizedItems.push({
        description: descWithCurrency,
        originalRawDescription: originalRawDesc,
        amount: amount.toFixed(2),
        categoryId,
        subcategoryId,
        fromMapping,
        receiptIndex: entry.receiptIndex,
        receiptLabel: entry.receiptLabel,
        sourceImageIndex: entry.sourceImageIndex,
      });
    }

    // Resolve missing items mapping/categories
    for (const item of normalizedItems) {
        if (parseFloat(item.amount || "0") < 0) continue;
        if (!item.originalRawDescription) continue;
        
        try {
          const mapping = await ctx.runQuery(internal.productMappings.lookupMapping, {
             householdId: householdId as any,
             rawDescription: item.originalRawDescription
          });
          
          if (mapping) {
             item.categoryId = mapping.categoryId;
             item.subcategoryId = mapping.subcategoryId;
             if (exchangeRate === 1) {
                item.description = mapping.correctedDescription; // Only override text if no currency inject
             }
             item.fromMapping = true;
          } else {
             // Fallback to AI's category resolution
             const originalAiCategory = parsedItems.find((i: any) => asString(i?.description) === item.originalRawDescription);
             const resolved = resolveCategoryNames(
               asString(originalAiCategory?.category),
               asString(originalAiCategory?.subcategory),
               categoriesArray
             );
             item.categoryId = resolved.categoryId;
             item.subcategoryId = resolved.subcategoryId;
          }

          const heuristicCategory = resolveHeuristicCategory(
            item.originalRawDescription || item.description,
            categoriesArray
          );
          if (heuristicCategory?.categoryId && heuristicCategory?.subcategoryId && !item.fromMapping) {
            item.categoryId = heuristicCategory.categoryId;
            item.subcategoryId = heuristicCategory.subcategoryId;
          }
        } catch (e) {
          // Ignore failures in lookup
        }
    }

    for (const item of normalizedItems) {
      const amountValue = parseFloat(item.amount || "0");
      if (!(amountValue < 0)) continue;

      const linkedCandidate = findBestDiscountCandidate(
        normalizedItems.filter((candidate) =>
          candidate.receiptIndex === item.receiptIndex && parseFloat(candidate.amount || "0") > 0
        ),
        item.receiptIndex,
        item.originalRawDescription || item.description,
        Math.abs(amountValue)
      );

      if (linkedCandidate?.categoryId) {
        item.categoryId = linkedCandidate.categoryId;
        item.subcategoryId = linkedCandidate.subcategoryId;
        continue;
      }

      const previousPositive = [...normalizedItems]
        .reverse()
        .find((candidate) =>
          candidate.receiptIndex === item.receiptIndex &&
          parseFloat(candidate.amount || "0") > 0
        );

      if (previousPositive?.categoryId) {
        item.categoryId = previousPositive.categoryId;
        item.subcategoryId = previousPositive.subcategoryId;
      }
    }

    const preliminaryItems = normalizedItems.filter(
      (item: ProcessedReceiptItem) =>
        item.amount || item.description !== "Nieznana pozycja"
    );

    const receiptSummariesBase: ReceiptSummary[] = receiptEntries.length > 0
      ? receiptEntries.map((receipt: any, idx: number) => {
        const sourceImageIndexRaw = Number.parseInt(String(receipt?.sourceImageIndex ?? ""), 10);
        const sourceImageIndex = Number.isFinite(sourceImageIndexRaw) && sourceImageIndexRaw > 0
          ? sourceImageIndexRaw
          : null;
        return {
          receiptIndex: idx,
          receiptLabel: asString(receipt?.receiptLabel) || `Paragon ${idx + 1}`,
          ...normalizeExpectedTotals(
            receipt?.totalAmount,
            receipt?.payableAmount,
            receipt?.depositTotal,
            exchangeRate
          ),
          sourceImageIndex,
        };
      })
      : [{
        receiptIndex: 0,
        receiptLabel: "Paragon 1",
        totalAmount: totalAmount || "",
        payableAmount: payableAmount || "",
        depositTotal: depositTotal || "",
        sourceImageIndex: null,
      }];

    let candidateItems = preliminaryItems;

    if (auditedLineCandidates.length > 0) {
      const auditedItems = auditedLineCandidates.map((entry) => entry.item);
      const expectedTotal = parseFloat(totalAmount || receiptSummariesBase[0]?.totalAmount || "0");
      const preliminarySum = preliminaryItems.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
      const auditedSum = auditedItems.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0);
      const preliminaryDiff = expectedTotal > 0 ? Math.abs(preliminarySum - expectedTotal) : Number.POSITIVE_INFINITY;
      const auditedDiff = expectedTotal > 0 ? Math.abs(auditedSum - expectedTotal) : Number.POSITIVE_INFINITY;

      if (
        auditedItems.length > 0 &&
        (
          auditedDiff + 0.01 < preliminaryDiff ||
          (preliminaryDiff > 0.05 && auditedItems.length > preliminaryItems.length)
        )
      ) {
        candidateItems = auditedItems;
      }
    }

    const dedupedItems = collapseLikelyDuplicateItems(candidateItems, receiptSummariesBase);
    const receiptSummaries = enrichReceiptSummariesWithValidation(receiptSummariesBase, dedupedItems);

    console.log(
      `Normalized: ${dedupedItems.length} items in ${receiptSummaries.length} receipt group(s) (model: ${modelUsed})`
    );

    return {
      items: dedupedItems,
      rawText: asString(parsed?.rawText),
      totalAmount: totalAmount || "",
      payableAmount: payableAmount || "",
      depositTotal: depositTotal || "",
      modelUsed,
      receiptCount: Math.max(1, receiptSummaries.length),
      receiptSummaries,
    };
  } catch (e) {
    console.error("Failed to parse AI JSON:", e);
    console.error("Content preview:", content.substring(0, 300));
    return {
      items: [],
      rawText: "",
      totalAmount: "",
      payableAmount: "",
      depositTotal: "",
      modelUsed,
      receiptCount: 1,
      receiptSummaries: [{
        receiptIndex: 0,
        receiptLabel: "Paragon 1",
        totalAmount: "",
        payableAmount: "",
        depositTotal: "",
        sourceImageIndex: null,
      }],
    };
  }
}

// ── AI Processing: Images ─────────────────────────────────────────

async function processImagesWithAI(
  ctx: any,
  householdId: string,
  imageDataList: { base64: string; mimeType: string }[],
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult & { retryUsed: boolean }> {
  const analyzeBatch = async (
    batch: { base64: string; mimeType: string }[]
  ): Promise<ProcessReceiptResult & { retryUsed: boolean }> => {
    const prompt = buildPrompt(compactCategories);

    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: prompt },
    ];

    for (const img of batch) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`
        },
      });
    }

    console.log(`→ Groq vision (${VISION_MODEL}):`, {
      imageCount: batch.length,
      promptLength: prompt.length,
    });

    let resp = await createGroqCompletionWithRetry({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    }, `vision-batch:${batch.length}`);

    let content = resp.choices[0].message.content ?? "{}";
    console.log("Vision response:", {
      len: content.length,
      model: resp.model
    });

    let parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
    let retryUsed = false;

    const suspiciousDuplicateReceipts = findSuspiciousDuplicateReceipts(parsed.items);
    const mismatchReceipts = parsed.receiptSummaries.filter((receipt) => {
      const expected = parseFloat(receipt.totalAmount || "0");
      const diff = parseFloat(receipt.difference || "0");
      return expected > 0 && Math.abs(diff) > 0.05;
    });

    const shouldRetryWithAI = suspiciousDuplicateReceipts.length > 0 || mismatchReceipts.some(
      (receipt) =>
        receipt.mismatchType === "missing_items" ||
        receipt.mismatchType === "missing_discounts" ||
        receipt.mismatchType === "unknown"
    );

    if (shouldRetryWithAI) {
      retryUsed = true;
      const mismatchHint = mismatchReceipts
        .slice(0, 3)
        .map((receipt) => {
          const label = receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`;
          const diff = Math.abs(parseFloat(receipt.difference || "0"));
          const hint = receipt.mismatchType === "missing_items"
            ? "brakuja pozycje"
            : receipt.mismatchType === "missing_discounts"
              ? "brakuje uwzglednionego rabatu/opustu"
              : "wymaga ponownej analizy";
          const totalsHint = receipt.payableAmount
            ? `; totalAmount=${receipt.totalAmount || "?"}; payableAmount=${receipt.payableAmount}; depositTotal=${receipt.depositTotal || "0"}`
            : "";
          return `${label}: roznica ${diff.toFixed(2)} (${hint}${totalsHint})`;
        })
        .join("; ");
      const duplicateHint = suspiciousDuplicateReceipts.length > 0
        ? ` Podejrzane duplikaty produktow w paragonach: ${suspiciousDuplicateReceipts.map((idx) => idx + 1).join(", ")}. Sprawdz, czy model nie rozbil jednej linii ilosciowej (np. "3 x 9,99 29,97") na kilka osobnych produktow.`
        : "";
      
      resp = await createGroqCompletionWithRetry({
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentParts },
          { role: "assistant", content },
          { role: "user", content: `Wykryto rozbieznosci per paragon: ${mismatchHint}.${duplicateHint} Sprawdz osobne linie OPUST/RABAT/PRZECENA oraz KAUCJA/OPAKOWANIA ZWROTNE. Jesli rabat jest pokazany jako osobna linia, wolno zwrocic go jako osobna pozycje z UJEMNA kwota zamiast odejmowac od pierwszego produktu. Jedna linia z iloscia ma dawac jedna pozycje JSON z laczna kwota, a nie kilka duplikatow. Nie zmieniaj nazwy produktu na niepowiazany rzeczownik, jesli na paragonie widac np. piwo, nie wolno zwracac nawozu. totalAmount ma odpowiadac sumie items, a payableAmount moze byc wyzsze przez kaucje. Zwroc POPRAWIONY, PELNY JSON.` }
        ],
      }, `vision-retry:${batch.length}`);
      
      content = resp.choices[0].message.content ?? "{}";
      parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
    }

    const stillNeedsAudit = parsed.receiptSummaries.some((receipt) => {
      const expected = parseFloat(receipt.totalAmount || "0");
      const diff = Math.abs(parseFloat(receipt.difference || "0"));
      return expected > 0 && diff > 0.05;
    }) || findSuspiciousDuplicateReceipts(parsed.items).length > 0;

    if (stillNeedsAudit) {
      retryUsed = true;
      parsed = await auditReceiptWithAI(
        ctx,
        householdId,
        batch,
        compactCategories,
        categoriesArray,
        content,
        parsed,
        findSuspiciousDuplicateReceipts(parsed.items)
      );
    }

    return { ...parsed, retryUsed };
  };

  const mergeBatchResults = (
    results: Array<ProcessReceiptResult & { retryUsed: boolean }>
  ): ProcessReceiptResult & { retryUsed: boolean } => {
    const mergedItems: ProcessedReceiptItem[] = [];
    const mergedSummaries: ReceiptSummary[] = [];
    const rawLabels: string[] = [];
    let total = 0;
    let payable = 0;
    let deposit = 0;
    let receiptOffset = 0;
    let retryUsed = false;

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      retryUsed = retryUsed || result.retryUsed;
      if (result.rawText) rawLabels.push(result.rawText);

      const resultReceiptCount = Math.max(1, result.receiptSummaries.length || result.receiptCount || 1);

      for (const item of result.items) {
        mergedItems.push({
          ...item,
          receiptIndex: item.receiptIndex + receiptOffset,
          receiptLabel: item.receiptLabel || `Paragon ${receiptOffset + 1}`,
          sourceImageIndex: item.sourceImageIndex ?? index + 1,
        });
      }

      const summaries = result.receiptSummaries.length > 0
        ? result.receiptSummaries
        : [{
          receiptIndex: 0,
          receiptLabel: result.rawText || `Paragon ${index + 1}`,
          totalAmount: result.totalAmount || "",
          payableAmount: result.payableAmount || "",
          depositTotal: result.depositTotal || "",
          sourceImageIndex: index + 1,
        }];

      for (const summary of summaries) {
        mergedSummaries.push({
          ...summary,
          receiptIndex: summary.receiptIndex + receiptOffset,
          receiptLabel: summary.receiptLabel || `Paragon ${receiptOffset + 1}`,
          sourceImageIndex: summary.sourceImageIndex ?? index + 1,
        });
      }

      total += parseFloat(result.totalAmount || "0") || 0;
      payable += parseFloat(result.payableAmount || "0") || 0;
      deposit += parseFloat(result.depositTotal || "0") || 0;
      receiptOffset += resultReceiptCount;
    }

    return {
      items: mergedItems,
      rawText: rawLabels.join(" | "),
      totalAmount: total > 0 ? total.toFixed(2) : "",
      payableAmount: payable > 0 ? payable.toFixed(2) : "",
      depositTotal: deposit > 0 ? deposit.toFixed(2) : "",
      modelUsed: VISION_MODEL,
      receiptCount: Math.max(1, mergedSummaries.length),
      receiptSummaries: enrichReceiptSummariesWithValidation(mergedSummaries, mergedItems),
      retryUsed,
    };
  };

  const combined = await analyzeBatch(imageDataList);
  if (!(imageDataList.length > 1 && combined.items.length === 0)) {
    return combined;
  }

  console.warn("Combined OCR for many images returned no items. Falling back to per-image processing.");
  const perImageResults: Array<ProcessReceiptResult & { retryUsed: boolean }> = [];

  for (const image of imageDataList) {
    const result = await analyzeBatch([image]);
    if (result.items.length > 0 || result.receiptSummaries.some((summary) => summary.totalAmount || summary.payableAmount)) {
      perImageResults.push(result);
    }
  }

  if (perImageResults.length === 0) {
    return combined;
  }

  return mergeBatchResults(perImageResults);
}

async function auditReceiptWithAI(
  ctx: any,
  householdId: string,
  imageDataList: { base64: string; mimeType: string }[],
  compactCategories: string,
  categoriesArray: any[],
  previousJson: string,
  parsed: ProcessReceiptResult,
  suspiciousDuplicateReceipts: number[]
): Promise<ProcessReceiptResult> {
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: [
        "AUDYT PARAGONU.",
        "Wykonaj drugi, rygorystyczny odczyt TYLKO dla pozycji podejrzanych.",
        "Najpierw przeczytaj z obrazu DOSLOWNIE linie produktowe i rabatowe, szczegolnie wzorce typu:",
        '- "3 x 9,99 29,97"',
        '- "OPUST ... -9,98"',
        '- "SUMA PLN 83,99"',
        '- "KAUCJA ... 1,00"',
        '- "DO ZAPLATY 84,99"',
        "Nie wolno zgadywac nazw z innych domen. Jesli na paragonie jest piwo, nie wolno zwracac nawozu.",
        "Jedna linia ilosciowa ma dac jedna pozycje JSON z laczna kwota po uwzglednieniu rabatu.",
        "Jesli rabat jest pokazany jako osobna linia koncowa lub globalna, mozesz zwrocic go jako osobna pozycje z ujemna kwota.",
        "Krzew/roslina/kwiat ma byc kategoryzowany do Dom i mieszkanie -> Ogród i balkon lub zblizonej podkategorii domowej, a nie do zywnosci.",
        "W polu audit.productLines zwroc KAŻDĄ linię produktową w KOLEJNOŚCI z paragonu, przed kategoryzacją. To pole jest ważniejsze niż zwykłe items.",
        "Dla kazdej linii produktowej podaj co najmniej description i total. Przyklad: Nep. 04'2026 piwo -> 19.98, Surowka 300g -> 6.98, Calcium Wit. D tabl. -> 5.59.",
        "",
        `Podejrzane paragony (indeksy 1-based): ${suspiciousDuplicateReceipts.length > 0 ? suspiciousDuplicateReceipts.map((idx) => idx + 1).join(", ") : "brak, ale suma nadal sie nie zgadza"}.`,
        "Poprzedni JSON do korekty:",
        previousJson,
        "",
        "Zwróć TYLKO poprawny JSON zgodny z glownym schematem oraz dodatkowo pole audit:",
        `{ "audit": { "transcribedLines": ["doslowna linia 1", "doslowna linia 2"], "productLines": [{ "description": "Nep. 04'2026 piwo", "quantityText": "2 x 9,99", "total": "19.98" }, { "description": "Surowka 300g", "quantityText": "2 x 3,49", "total": "6.98" }] }, "rawText": "Lidl 2026-04-11", "currency": "PLN", "totalAmount": "83.99", "payableAmount": "84.99", "depositTotal": "1.00", "receiptCount": 1, "receipts": [] }`,
        "",
        "KATEGORIE:",
        compactCategories,
      ].join("\n"),
    },
  ];

  for (const img of imageDataList) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`,
      },
    });
  }

  const resp = await createGroqCompletionWithRetry({
    model: VISION_MODEL,
    temperature: 0.0,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contentParts },
    ],
  }, `vision-audit:${imageDataList.length}`);

  const content = resp.choices[0].message.content ?? "{}";
  const audited = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);

  console.log("Receipt audit response:", {
    previousItems: parsed.items.length,
    auditedItems: audited.items.length,
    receiptsWithMismatch: audited.receiptSummaries.filter((receipt) => receipt.mismatchType !== "ok").length,
  });

  return audited;
}

// ── AI Processing: Text ───────────────────────────────────────────

async function processTextWithAI(
  ctx: any,
  householdId: string,
  text: string,
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult & { retryUsed: boolean }> {
  const prompt = buildPrompt(compactCategories, text.slice(0, 8000));

  const resp = await createGroqCompletionWithRetry({
    model: VISION_MODEL, // Vision model can also accept pure text
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  }, "text-ocr");

  const content = resp.choices[0].message.content ?? "{}";
  const parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
  return { ...parsed, retryUsed: false };
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
    householdId: v.id("households"),
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
        ctx,
        args.householdId,
        imageDataList,
        compactCategories,
        categoriesArray
      );

      const ms = Date.now() - startTime;
      
      // Calculate match rate for logging
      const sumMatchedTotal = result.receiptSummaries.length > 0
        ? result.receiptSummaries.every((receipt) => receipt.mismatchType === "ok")
        : false;

      // Log the scan observability (Step 1 Implementation)
      await ctx.runMutation(internal.ocrLogs.logScan, {
        householdId: args.householdId,
        imageCount: args.storageIds.length,
        modelUsed: VISION_MODEL,
        itemCount: result.items.length,
        totalAmount: result.totalAmount,
        sumMatchedTotal,
        retryUsed: result.retryUsed,
        latencyMs: ms,
      });

      console.log(`=== DONE === ${result.items.length} items in ${ms}ms`);
      return result;
    } catch (error: any) {
      console.error("=== ERROR ===", error.message);
      throw error;
    }
  },
});


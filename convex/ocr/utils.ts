"use node";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const clean = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (clean.startsWith("{") || clean.startsWith("[")) return clean;
  const firstObject = clean.indexOf("{");
  const lastObject = clean.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    return clean.slice(firstObject, lastObject + 1);
  }
  const firstArray = clean.indexOf("[");
  const lastArray = clean.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    return clean.slice(firstArray, lastArray + 1);
  }
  return clean;
}

export function parseAmountNumber(value: unknown): number | null {
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

export function normalizeAmount(value: unknown): string {
  const parsed = parseAmountNumber(value);
  if (parsed === null || parsed <= 0) return "";
  return parsed.toFixed(2);
}

export function scaleAmountForCurrency(amount: string, exchangeRate: number): string {
  if (!amount) return "";
  const parsed = Number.parseFloat(amount);
  if (!(parsed > 0)) return "";
  return exchangeRate !== 1 ? (parsed * exchangeRate).toFixed(2) : parsed.toFixed(2);
}

export function normalizeExpectedTotals(
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
    const inferredDeposit = Number.parseFloat(payableAmount) - Number.parseFloat(totalAmount);
    if (inferredDeposit > 0.05) {
      depositTotal = inferredDeposit.toFixed(2);
    }
  }

  if (!totalAmount && payableAmount && depositTotal) {
    const inferredTotal = Number.parseFloat(payableAmount) - Number.parseFloat(depositTotal);
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

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/Ĺ‚/g, "l")
    .replace(/Ä‘/g, "d")
    .replace(/Ăź/g, "ss")
    .replace(/Ă¦/g, "ae")
    .replace(/Ă¸/g, "o")
    .replace(/Ä…/g, "a")
    .replace(/Ä‡/g, "c")
    .replace(/Ä™/g, "e")
    .replace(/Ĺ„/g, "n")
    .replace(/Ăł/g, "o")
    .replace(/Ĺ›/g, "s")
    .replace(/Ĺş/g, "z")
    .replace(/ĹĽ/g, "z");
}

export function tokenizeDescription(description: string): string[] {
  const normalized = stripDiacritics(description)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const stopWords = new Set([
    "rabat",
    "promocja",
    "promocji",
    "opust",
    "kupon",
    "aplikacja",
    "aplikacji",
    "program",
    "klienta",
    "karta",
    "minus",
    "znizka",
    "bonifikata",
    "paragon",
  ]);

  return normalized
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

export function normalizeDescriptionKey(description: string): string {
  return stripDiacritics(description)
    .replace(/\b\d+(?:[.,]\d+)?\s*(ml|l|g|kg|szt|tab|tbl|cl)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanupReceiptLineDescription(description: string): string {
  return description
    .replace(/\s+[A-Z]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

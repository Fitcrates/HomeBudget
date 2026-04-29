"use node";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to repair truncated JSON by closing open braces/brackets.
 * Returns null if the input is not salvageable.
 */
function tryRepairTruncatedJson(text: string): string | null {
  // Count open vs close braces and brackets
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") braceDepth++;
    else if (char === "}") braceDepth--;
    else if (char === "[") bracketDepth++;
    else if (char === "]") bracketDepth--;
  }

  if (braceDepth === 0 && bracketDepth === 0) {
    return null; // Not truncated
  }

  // If we're inside a string, close it first
  let repaired = text;
  if (inString) {
    repaired += '"';
  }

  // Remove any trailing partial key/value (e.g., `"descri` or `: `)
  repaired = repaired.replace(/,\s*"[^"]*$/, "");
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ': ""');

  // Close open brackets and braces
  while (bracketDepth > 0) {
    repaired += "]";
    bracketDepth--;
  }
  while (braceDepth > 0) {
    repaired += "}";
    braceDepth--;
  }

  return repaired;
}

export interface ExtractJsonResult {
  json: string;
  wasTruncated: boolean;
}

export function extractJsonBlock(text: string): string {
  return extractJsonBlockWithMeta(text).json;
}

export function extractJsonBlockWithMeta(text: string): ExtractJsonResult {
  const trimmed = text.trim();
  if (!trimmed) return { json: "", wasTruncated: false };

  const clean = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let candidate: string;

  if (clean.startsWith("{") || clean.startsWith("[")) {
    candidate = clean;
  } else {
    const firstObject = clean.indexOf("{");
    const lastObject = clean.lastIndexOf("}");
    if (firstObject !== -1 && lastObject > firstObject) {
      candidate = clean.slice(firstObject, lastObject + 1);
    } else {
      const firstArray = clean.indexOf("[");
      const lastArray = clean.lastIndexOf("]");
      if (firstArray !== -1 && lastArray > firstArray) {
        candidate = clean.slice(firstArray, lastArray + 1);
      } else {
        // Might be a truncated block
        if (firstObject !== -1) {
          candidate = clean.slice(firstObject);
        } else if (firstArray !== -1) {
          candidate = clean.slice(firstArray);
        } else {
          return { json: clean, wasTruncated: false };
        }
      }
    }
  }

  // Try to parse directly first
  try {
    JSON.parse(candidate);
    return { json: candidate, wasTruncated: false };
  } catch {
    // Attempt repair
    const repaired = tryRepairTruncatedJson(candidate);
    if (repaired) {
      try {
        JSON.parse(repaired);
        console.warn("[OCR] JSON was truncated and repaired. Some items may be missing.");
        return { json: repaired, wasTruncated: true };
      } catch {
        // Repair failed, return original and let caller handle
        return { json: candidate, wasTruncated: true };
      }
    }
    return { json: candidate, wasTruncated: false };
  }
}

export function parseAmountNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const trailingMinus = compact.endsWith("-");
  const match = compact.match(/-?[\d.,]+/);
  if (!match) return null;

  let normalized = match[0];
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  let parsed = Number.parseFloat(normalized);
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
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/ą/g, "a")
    .replace(/ć/g, "c")
    .replace(/ę/g, "e")
    .replace(/ń/g, "n")
    .replace(/ó/g, "o")
    .replace(/ś/g, "s")
    .replace(/ź/g, "z")
    .replace(/ż/g, "z");
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

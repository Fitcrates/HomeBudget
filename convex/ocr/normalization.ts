"use node";

import { ProcessedReceiptItem, ReceiptSummary } from "./types";
import {
  asString,
  cleanupReceiptLineDescription,
  normalizeDescriptionKey,
  parseAmountNumber,
  stripDiacritics,
  tokenizeDescription,
} from "./utils";

export function isDiscountLikeDescription(description: string): boolean {
  const text = stripDiacritics(description);
  return /(rabat|opust|promoc|kupon|coupon|bonifikat|znizk|obnizk|program|lojalnosc|aplikacj|karta|taniej|minus)/i.test(text);
}

export function isDepositLikeDescription(description: string): boolean {
  const text = stripDiacritics(description);
  return /(kaucj|opakowan|zwrotn|butelk|puszk)/i.test(text);
}

export function isTechnicalLine(description: string): boolean {
  const text = stripDiacritics(description);
  return /(suma|podsuma|sprzedaz|sprzedaz opodatkowana|ptu|rozliczenie|platnosc|karta|gotowka|paragon|fiskalny|nip|adres)/i.test(text);
}

export function findBestDiscountCandidate(
  normalizedItems: ProcessedReceiptItem[],
  receiptIndex: number,
  discountDescription: string,
  discountInPln: number
): ProcessedReceiptItem | null {
  const discountTokens = tokenizeDescription(discountDescription);

  let bestCandidate: ProcessedReceiptItem | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < normalizedItems.length; i++) {
    const candidate = normalizedItems[i];
    if (candidate.receiptIndex !== receiptIndex) continue;

    const candidateAmount = Number.parseFloat(candidate.amount);
    if (!(candidateAmount > discountInPln + 0.001)) continue;

    const candidateTokens = tokenizeDescription(candidate.originalRawDescription || candidate.description);
    const overlap = discountTokens.length > 0
      ? discountTokens.filter((token) => candidateTokens.includes(token)).length
      : 0;

    const distanceFromEnd = normalizedItems.length - 1 - i;
    const recencyBonus = Math.max(0, 5 - distanceFromEnd) * 0.5;
    const amountClosenessBonus = Math.max(0, 3 - Math.abs(candidateAmount - discountInPln));
    const score = overlap * 10 + recencyBonus + amountClosenessBonus;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return normalizedItems
    .filter((item) => item.receiptIndex === receiptIndex)
    .sort((left, right) => Number.parseFloat(right.amount) - Number.parseFloat(left.amount))[0] ?? null;
}

export function buildDiscountLineItem(
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

export function enrichReceiptSummariesWithValidation(
  summaries: ReceiptSummary[],
  items: ProcessedReceiptItem[]
): ReceiptSummary[] {
  return summaries.map((summary) => {
    const itemsTotal = items
      .filter((item) => item.receiptIndex === summary.receiptIndex)
      .reduce((accumulator, item) => accumulator + Number.parseFloat(item.amount || "0"), 0);

    const expected = Number.parseFloat(summary.totalAmount || "0");
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

export function collapseLikelyDuplicateItems(
  items: ProcessedReceiptItem[],
  summaries: ReceiptSummary[]
): ProcessedReceiptItem[] {
  let nextItems = [...items];

  for (const summary of summaries) {
    const expected = Number.parseFloat(summary.totalAmount || "0");
    if (!(expected > 0)) continue;

    let receiptItems = nextItems.filter((item) => item.receiptIndex === summary.receiptIndex);
    let currentTotal = receiptItems.reduce((sum, item) => sum + Number.parseFloat(item.amount || "0"), 0);
    const currentDiff = Math.abs(currentTotal - expected);
    if (currentDiff <= 0.05) continue;

    const groups = new Map<string, ProcessedReceiptItem[]>();
    for (const item of receiptItems) {
      const key = `${normalizeDescriptionKey(item.originalRawDescription || item.description)}|${item.amount}`;
      const grouped = groups.get(key) ?? [];
      grouped.push(item);
      groups.set(key, grouped);
    }

    for (const [, group] of groups) {
      if (group.length <= 1) continue;

      const amount = Number.parseFloat(group[0].amount || "0");
      if (!(amount > 0)) continue;

      const candidateTotal = currentTotal - amount * (group.length - 1);
      const candidateDiff = Math.abs(candidateTotal - expected);
      if (candidateDiff + 0.01 >= currentDiff) continue;

      const idsToRemove = new Set(
        group.slice(1).map((item) =>
          item.description + item.amount + item.receiptIndex + (item.originalRawDescription || "")
        )
      );

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
      currentTotal = receiptItems.reduce((sum, item) => sum + Number.parseFloat(item.amount || "0"), 0);
    }
  }

  return nextItems;
}

function parseAuditedPricedLine(line: string): { description: string; amount: number } | null {
  const quantityMatch = line.match(/^(.*?)(?:\s+[A-Z])?\s+(\d+)\s*x\s*(\d+[.,]\d{2})\s+(-?\d+[.,]\d{2})(?:[A-Z])?$/i);
  if (quantityMatch) {
    const description = cleanupReceiptLineDescription(quantityMatch[1] || "");
    const amount = parseAmountNumber(quantityMatch[4]);
    if (description && amount !== null) {
      return { description, amount };
    }
  }

  const simpleMatch = line.match(/^(.*\D)\s+(-?\d+[.,]\d{2})(?:[A-Z])?$/);
  if (simpleMatch) {
    const description = cleanupReceiptLineDescription(simpleMatch[1] || "");
    const amount = parseAmountNumber(simpleMatch[2]);
    if (description && amount !== null) {
      return { description, amount };
    }
  }

  return null;
}

export function parseAuditedTranscribedLines(
  lines: string[],
  receiptIndex: number,
  receiptLabel: string,
  sourceImageIndex: number | null,
  exchangeRate: number
): ProcessedReceiptItem[] {
  const items: ProcessedReceiptItem[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = asString(lines[index]);
    if (!line) continue;

    const normalizedLine = line.replace(/\s+/g, " ").trim();
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

    if (/^-?\d+[.,]\d{2}[A-Z]?$/.test(normalizedLine)) {
      continue;
    }

    let pricedLine = parseAuditedPricedLine(normalizedLine);
    if (!pricedLine && index + 1 < lines.length) {
      const nextLine = asString(lines[index + 1]).replace(/\s+/g, " ").trim();
      if (
        nextLine &&
        /^-?\d+[.,]\d{2}[A-Z]?$/.test(nextLine) &&
        !isTechnicalLine(normalizedLine) &&
        !isDiscountLikeDescription(normalizedLine) &&
        !isDepositLikeDescription(normalizedLine)
      ) {
        pricedLine = {
          description: cleanupReceiptLineDescription(normalizedLine),
          amount: parseAmountNumber(nextLine) ?? 0,
        };
        index++;
      }
    }

    if (!pricedLine || !(pricedLine.amount > 0) || !pricedLine.description) {
      continue;
    }
    if (
      isDiscountLikeDescription(pricedLine.description) ||
      isDepositLikeDescription(pricedLine.description) ||
      isTechnicalLine(pricedLine.description)
    ) {
      continue;
    }

    const amount = exchangeRate !== 1 ? pricedLine.amount * exchangeRate : pricedLine.amount;
    items.push({
      description: pricedLine.description,
      originalRawDescription: pricedLine.description,
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

export function parseAuditedProductLines(
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
    const amount = parseAmountNumber(row.total);

    if (!description || amount === null || amount <= 0) continue;
    if (isTechnicalLine(description) || isDepositLikeDescription(description) || isDiscountLikeDescription(description)) {
      continue;
    }

    const scaledAmount = exchangeRate !== 1 ? amount * exchangeRate : amount;
    items.push({
      description,
      originalRawDescription: description,
      amount: scaledAmount.toFixed(2),
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

/**
 * Only flag receipts with duplicates when those duplicates actually cause a total mismatch.
 * Previously, ANY duplicate (even valid "bought 2 of the same item") triggered expensive retry passes.
 */
export function findSuspiciousDuplicateReceipts(
  items: ProcessedReceiptItem[],
  summaries?: ReceiptSummary[]
): number[] {
  const duplicates = new Set<number>();
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = `${item.receiptIndex}|${normalizeDescriptionKey(item.originalRawDescription || item.description)}|${item.amount}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Collect receipt indices that have any duplicated items
  const receiptsWithDuplicates = new Set<number>();
  for (const [key, count] of counts) {
    if (count <= 1) continue;
    receiptsWithDuplicates.add(Number.parseInt(key.split("|")[0] || "0", 10));
  }

  // Only flag as suspicious if the receipt's total actually mismatches
  // (i.e. removing the duplicates would bring the total closer to expected)
  if (summaries && summaries.length > 0) {
    for (const receiptIndex of receiptsWithDuplicates) {
      const summary = summaries.find((s) => s.receiptIndex === receiptIndex);
      if (!summary) {
        duplicates.add(receiptIndex);
        continue;
      }
      const expected = Number.parseFloat(summary.totalAmount || "0");
      if (!(expected > 0)) {
        duplicates.add(receiptIndex);
        continue;
      }
      const receiptItems = items.filter((item) => item.receiptIndex === receiptIndex);
      const currentTotal = receiptItems.reduce((sum, item) => sum + Number.parseFloat(item.amount || "0"), 0);
      const diff = Math.abs(currentTotal - expected);
      // Only flag if there's a meaningful mismatch (>0.05 PLN)
      if (diff > 0.05) {
        duplicates.add(receiptIndex);
      }
    }
  } else {
    // No summaries available, flag all duplicates (legacy behavior)
    for (const receiptIndex of receiptsWithDuplicates) {
      duplicates.add(receiptIndex);
    }
  }

  return [...duplicates];
}

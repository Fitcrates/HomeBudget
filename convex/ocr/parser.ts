"use node";

import { internal } from "../_generated/api";
import { resolveCategoryNames, resolveHeuristicCategory } from "./categories";
import {
  buildDiscountLineItem,
  collapseLikelyDuplicateItems,
  findBestDiscountCandidate,
  isDepositLikeDescription,
  isDiscountLikeDescription,
  parseAuditedProductLines,
  parseAuditedTranscribedLines,
  enrichReceiptSummariesWithValidation,
} from "./normalization";
import { AuditedLineCandidate, ProcessReceiptResult, ProcessedReceiptItem, ReceiptSummary } from "./types";
import { asString, extractJsonBlockWithMeta, normalizeExpectedTotals, parseAmountNumber, stripDiacritics } from "./utils";

async function fetchExchangeRate(currencyCode: string): Promise<number> {
  const code = currencyCode.toUpperCase();
  if (code === "PLN" || !code) return 1;

  try {
    const response = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`);
    if (!response.ok) return 1;

    const data = await response.json();
    return data?.rates?.[0]?.mid || 1;
  } catch (error) {
    console.error(`Failed to fetch exchange rate for ${code}`, error);
    return 1;
  }
}

function shouldPreferAuditedItems(
  preliminaryItems: ProcessedReceiptItem[],
  auditedItems: ProcessedReceiptItem[],
  expectedTotal: number
): boolean {
  if (auditedItems.length === 0) return false;
  if (preliminaryItems.length === 0) return true;
  if (!(expectedTotal > 0)) {
    return auditedItems.length > preliminaryItems.length;
  }

  const preliminarySum = preliminaryItems.reduce((sum, item) => sum + Number.parseFloat(item.amount || "0"), 0);
  const auditedSum = auditedItems.reduce((sum, item) => sum + Number.parseFloat(item.amount || "0"), 0);
  const preliminaryDiff = Math.abs(preliminarySum - expectedTotal);
  const auditedDiff = Math.abs(auditedSum - expectedTotal);

  if (auditedDiff + 0.01 < preliminaryDiff) {
    return true;
  }

  return preliminaryDiff > 0.05 &&
    auditedDiff <= preliminaryDiff + 0.01 &&
    auditedItems.length > preliminaryItems.length;
}

const GENERIC_HEURISTIC_SUBCATEGORY_NAMES = new Set([
  "supermarket",
  "dyskont",
  "delikatesy",
  "higiena osobista",
  "wyposazenie",
  "marketplace",
  "rozne",
]);

function findFallbackCategory(categoriesArray: any[]): { categoryId: string | null; subcategoryId: string | null } {
  const category =
    categoriesArray.find((entry: any) => stripDiacritics(asString(entry?.name)) === "inne") ??
    categoriesArray[categoriesArray.length - 1];
  const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const subcategory =
    subcategories.find((entry: any) => stripDiacritics(asString(entry?.name)) === "rozne") ??
    subcategories[0];

  return {
    categoryId: category?._id ?? null,
    subcategoryId: subcategory?._id ?? null,
  };
}

function findSubcategoryNameById(categoriesArray: any[], subcategoryId: string | null | undefined): string | null {
  if (!subcategoryId) return null;

  for (const category of categoriesArray) {
    const subcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
    const match = subcategories.find((entry: any) => String(entry?._id) === String(subcategoryId));
    if (match?.name) {
      return asString(match.name) || null;
    }
  }

  return null;
}

function isGenericHeuristicFallback(categoriesArray: any[], subcategoryId: string | null | undefined): boolean {
  const subcategoryName = findSubcategoryNameById(categoriesArray, subcategoryId);
  if (!subcategoryName) return false;
  return GENERIC_HEURISTIC_SUBCATEGORY_NAMES.has(stripDiacritics(subcategoryName));
}

export async function parseAndNormalizeResponse(
  ctx: any,
  householdId: string,
  content: string,
  categoriesArray: any[],
  modelUsed: string,
  traceLabel = "ocr"
): Promise<ProcessReceiptResult & { wasTruncated: boolean }> {
  const parseStart = Date.now();
  try {
    const jsonParseStart = Date.now();
    const { json: extracted, wasTruncated } = extractJsonBlockWithMeta(content);
    const parsed = JSON.parse(extracted || "{}");

    if (wasTruncated) {
      console.warn(`[OCR][${traceLabel}] JSON output was TRUNCATED. Some items may be missing. Content length: ${content.length}`);
    }

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

    // Primary source: receipts[].items (structured per-receipt format)
    // Fallback: top-level items[] or root array (legacy/flat format)
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
    const globalReceiptContext = asString(parsed?.rawText);
    const receiptContextByIndex = new Map<number, string>();

    if (receiptEntries.length > 0) {
      receiptEntries.forEach((receipt: any, idx: number) => {
        const contextParts = [
          asString(receipt?.receiptLabel),
          asString(receipt?.rawText),
          asString(receipt?.merchant),
          asString(receipt?.storeName),
          globalReceiptContext,
        ].filter(Boolean);
        receiptContextByIndex.set(idx, contextParts.join(" "));
      });
    } else {
      receiptContextByIndex.set(0, globalReceiptContext);
    }

    const jsonParseMs = Date.now() - jsonParseStart;

    const exchangeRateStart = Date.now();
    const currency = asString(parsed?.currency).toUpperCase();
    const exchangeRate = await fetchExchangeRate(currency);
    const exchangeRateMs = Date.now() - exchangeRateStart;

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

    const normalizationStart = Date.now();
    const normalizedTopLevelTotals = normalizeExpectedTotals(
      parsed?.totalAmount,
      parsed?.payableAmount,
      parsed?.depositTotal,
      exchangeRate
    );
    const totalAmount = normalizedTopLevelTotals.totalAmount;
    const payableAmount = normalizedTopLevelTotals.payableAmount;
    const depositTotal = normalizedTopLevelTotals.depositTotal;

    console.log(`AI returned ${parsedItems.length} raw items (Currency: ${currency}, Rate: ${exchangeRate}, Total: ${totalAmount}, Payable: ${payableAmount}, Deposit: ${depositTotal}, Truncated: ${wasTruncated})`);

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
        amount *= exchangeRate;
      }

      const resolvedDescription = originalRawDesc;
      const description = exchangeRate !== 1
        ? `${resolvedDescription} (${Math.abs(parsedAmount).toFixed(2)} ${currency})`
        : resolvedDescription;

      normalizedItems.push({
        description,
        originalRawDescription: originalRawDesc,
        amount: amount.toFixed(2),
        categoryId: null,
        subcategoryId: null,
        fromMapping: false,
        receiptIndex: entry.receiptIndex,
        receiptLabel: entry.receiptLabel,
        sourceImageIndex: entry.sourceImageIndex,
      });
    }

    const normalizeAiItemsMs = Date.now() - normalizationStart;

    const mappingLookupStart = Date.now();
    const mappingRawDescriptions = [
      ...new Set(
        [
          ...normalizedItems,
          ...auditedLineCandidates.map((entry) => entry.item),
        ]
          .filter((item) => Number.parseFloat(item.amount || "0") >= 0 && Boolean(item.originalRawDescription))
          .map((item) => item.originalRawDescription!)
      ),
    ];
    const mappingResults = mappingRawDescriptions.length > 0
      ? await ctx.runQuery(internal.productMappings.lookupMappingsBatch, {
          householdId: householdId as any,
          rawDescriptions: mappingRawDescriptions,
        })
      : [];
    const mappingByRawDescription = new Map<string, any>(
      mappingResults.map((entry: any) => [entry.rawDescription, entry.mapping])
    );
    const mappingLookupMs = Date.now() - mappingLookupStart;

    const categoryResolutionStart = Date.now();
    let mappedFromHistoryCount = 0;
    let resolvedFromAiCategoryCount = 0;
    let resolvedByHeuristicCount = 0;

    const assignCategoriesToItems = (
      itemsToCategorize: ProcessedReceiptItem[],
      allowAiCategoryResolution: boolean
    ) => {
      for (const item of itemsToCategorize) {
        if (Number.parseFloat(item.amount || "0") < 0) continue;
        if (!item.originalRawDescription) continue;

        try {
          const mapping = mappingByRawDescription.get(item.originalRawDescription);

          if (mapping) {
            item.categoryId = mapping.categoryId;
            item.subcategoryId = mapping.subcategoryId;
            if (exchangeRate === 1) {
              item.description = mapping.correctedDescription;
            }
            item.fromMapping = true;
            mappedFromHistoryCount++;
            continue; // mapping has highest priority, skip other resolution
          }
          
          // Try AI category resolution
          if (allowAiCategoryResolution) {
            const originalAiCategory = parsedItemsWithMeta.find((entry) =>
              entry.receiptIndex === item.receiptIndex &&
              asString(entry.item?.description) === item.originalRawDescription
            )?.item ?? parsedItems.find((entry: any) => asString(entry?.description) === item.originalRawDescription);

            const resolved = resolveCategoryNames(
              asString(originalAiCategory?.category),
              asString(originalAiCategory?.subcategory),
              categoriesArray
            );

            item.categoryId = resolved.categoryId;
            item.subcategoryId = resolved.subcategoryId;
            if (resolved.categoryId && resolved.subcategoryId) {
              resolvedFromAiCategoryCount++;
            }
          }

          // Try heuristic — always run, can upgrade generic AI categories
          const heuristicCategory = resolveHeuristicCategory(
            item.originalRawDescription || item.description,
            categoriesArray,
            receiptContextByIndex.get(item.receiptIndex) || item.receiptLabel || globalReceiptContext
          );

          if (heuristicCategory?.categoryId && heuristicCategory?.subcategoryId) {
            const hasExistingResolution = Boolean(item.categoryId && item.subcategoryId);
            
            // Check if current category is a generic fallback
            const currentIsGeneric = hasExistingResolution && isGenericHeuristicFallback(
              categoriesArray,
              item.subcategoryId
            );

            // Apply heuristic if: no resolution yet OR current is generic fallback
            if (!hasExistingResolution || currentIsGeneric) {
              item.categoryId = heuristicCategory.categoryId;
              item.subcategoryId = heuristicCategory.subcategoryId;
              resolvedByHeuristicCount++;
            }
          }

          if (!item.categoryId || !item.subcategoryId) {
            const fallback = findFallbackCategory(categoriesArray);
            item.categoryId = fallback.categoryId;
            item.subcategoryId = fallback.subcategoryId;
          }
        } catch {
          // Ignore mapping lookup failures and keep OCR result usable.
        }
      }
    };

    assignCategoriesToItems(normalizedItems, true);

    const categoryResolutionMs = Date.now() - categoryResolutionStart;

    const discountLinkingStart = Date.now();
    const assignDiscountCategories = (itemsToCategorize: ProcessedReceiptItem[]) => {
      for (const item of itemsToCategorize) {
        const amountValue = Number.parseFloat(item.amount || "0");
        if (!(amountValue < 0)) continue;

        const linkedCandidate = findBestDiscountCandidate(
          itemsToCategorize.filter((candidate) =>
            candidate.receiptIndex === item.receiptIndex && Number.parseFloat(candidate.amount || "0") > 0
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

        const previousPositive = [...itemsToCategorize]
          .reverse()
          .find((candidate) =>
            candidate.receiptIndex === item.receiptIndex &&
            Number.parseFloat(candidate.amount || "0") > 0
          );

        if (previousPositive?.categoryId) {
          item.categoryId = previousPositive.categoryId;
          item.subcategoryId = previousPositive.subcategoryId;
        }

        if (!item.categoryId || !item.subcategoryId) {
          const fallback = findFallbackCategory(categoriesArray);
          item.categoryId = fallback.categoryId;
          item.subcategoryId = fallback.subcategoryId;
        }
      }
    };

    assignDiscountCategories(normalizedItems);
    const discountLinkingMs = Date.now() - discountLinkingStart;

    const preliminaryItems = normalizedItems.filter(
      (item) => item.amount || item.description !== "Nieznana pozycja"
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

    const dedupeStart = Date.now();
    let candidateItems = preliminaryItems;
    if (auditedLineCandidates.length > 0) {
      const auditedItems = auditedLineCandidates.map((entry) => entry.item);
      const expectedTotal = Number.parseFloat(totalAmount || receiptSummariesBase[0]?.totalAmount || "0");

      if (shouldPreferAuditedItems(preliminaryItems, auditedItems, expectedTotal)) {
        assignCategoriesToItems(auditedItems, false);
        assignDiscountCategories(auditedItems);
        candidateItems = auditedItems;
      }
    }

    const dedupedItems = collapseLikelyDuplicateItems(candidateItems, receiptSummariesBase);
    const receiptSummaries = enrichReceiptSummariesWithValidation(receiptSummariesBase, dedupedItems);
    const dedupeValidationMs = Date.now() - dedupeStart;
    const totalParseMs = Date.now() - parseStart;
    const categorizedCount = dedupedItems.filter((item) => item.categoryId && item.subcategoryId).length;

    console.log(
      `Normalized: ${dedupedItems.length} items in ${receiptSummaries.length} receipt group(s) (model: ${modelUsed})`
    );
    console.log(`[OCR TIMING][${traceLabel}] parseAndNormalizeResponse`, {
      jsonParseMs,
      exchangeRateMs,
      normalizeAiItemsMs,
      mappingLookupMs,
      categoryResolutionMs,
      discountLinkingMs,
      dedupeValidationMs,
      totalParseMs,
      wasTruncated,
      rawItems: parsedItems.length,
      normalizedItems: normalizedItems.length,
      finalItems: dedupedItems.length,
      categorizedCount,
      unresolvedCount: Math.max(dedupedItems.length - categorizedCount, 0),
      mappedFromHistoryCount,
      resolvedFromAiCategoryCount,
      resolvedByHeuristicCount,
      auditedLineCandidates: auditedLineCandidates.length,
      receiptGroups: receiptSummaries.length,
    });

    return {
      items: dedupedItems,
      rawText: asString(parsed?.rawText),
      totalAmount: totalAmount || "",
      payableAmount: payableAmount || "",
      depositTotal: depositTotal || "",
      modelUsed,
      receiptCount: Math.max(1, receiptSummaries.length),
      receiptSummaries,
      wasTruncated,
    };
  } catch (error) {
    console.error("Failed to parse AI JSON:", error);
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
      wasTruncated: false,
    };
  }
}

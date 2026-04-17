"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildCompactCategoryList } from "./ocr/categories";
import { createGroqCompletionWithRetry } from "./ocr/groq";
import {
  enrichReceiptSummariesWithValidation,
  findSuspiciousDuplicateReceipts,
} from "./ocr/normalization";
import { parseAndNormalizeResponse } from "./ocr/parser";
import { buildAuditPrompt, buildPrompt, SYSTEM_PROMPT, VISION_MODEL } from "./ocr/prompt";
import { ProcessReceiptResult, ProcessedReceiptItem, ReceiptSummary } from "./ocr/types";

type ImageInput = {
  base64: string;
  mimeType: string;
};

async function processImagesWithAI(
  ctx: any,
  householdId: string,
  imageDataList: ImageInput[],
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult & { retryUsed: boolean }> {
  const analyzeBatch = async (
    batch: ImageInput[]
  ): Promise<ProcessReceiptResult & { retryUsed: boolean }> => {
    const prompt = buildPrompt(compactCategories);
    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: prompt },
    ];

    for (const image of batch) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      });
    }

    console.log(`→ Groq vision (${VISION_MODEL}):`, {
      imageCount: batch.length,
      promptLength: prompt.length,
    });

    let response = await createGroqCompletionWithRetry({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    }, `vision-batch:${batch.length}`);

    let content = response.choices[0].message.content ?? "{}";
    console.log("Vision response:", {
      len: content.length,
      model: response.model,
    });

    let parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
    let retryUsed = false;

    const suspiciousDuplicateReceipts = findSuspiciousDuplicateReceipts(parsed.items);
    const mismatchReceipts = parsed.receiptSummaries.filter((receipt) => {
      const expected = Number.parseFloat(receipt.totalAmount || "0");
      const diff = Number.parseFloat(receipt.difference || "0");
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
          const diff = Math.abs(Number.parseFloat(receipt.difference || "0"));
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

      response = await createGroqCompletionWithRetry({
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentParts },
          { role: "assistant", content },
          {
            role: "user",
            content: `Wykryto rozbieznosci per paragon: ${mismatchHint}.${duplicateHint} Sprawdz osobne linie OPUST/RABAT/PRZECENA oraz KAUCJA/OPAKOWANIA ZWROTNE. Jesli rabat jest pokazany jako osobna linia, wolno zwrocic go jako osobna pozycje z UJEMNA kwota zamiast odejmowac od pierwszego produktu. Jedna linia z iloscia ma dawac jedna pozycje JSON z laczna kwota, a nie kilka duplikatow. Nie zmieniaj nazwy produktu na niepowiazany rzeczownik, jesli na paragonie widac np. piwo, nie wolno zwracac nawozu. totalAmount ma odpowiadac sumie items, a payableAmount moze byc wyzsze przez kaucje. Zwroc POPRAWIONY, PELNY JSON.`,
          },
        ],
      }, `vision-retry:${batch.length}`);

      content = response.choices[0].message.content ?? "{}";
      parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
    }

    const stillNeedsAudit = parsed.receiptSummaries.some((receipt) => {
      const expected = Number.parseFloat(receipt.totalAmount || "0");
      const diff = Math.abs(Number.parseFloat(receipt.difference || "0"));
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

      total += Number.parseFloat(result.totalAmount || "0") || 0;
      payable += Number.parseFloat(result.payableAmount || "0") || 0;
      deposit += Number.parseFloat(result.depositTotal || "0") || 0;
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
  imageDataList: ImageInput[],
  compactCategories: string,
  categoriesArray: any[],
  previousJson: string,
  parsed: ProcessReceiptResult,
  suspiciousDuplicateReceipts: number[]
): Promise<ProcessReceiptResult> {
  const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: buildAuditPrompt(compactCategories, previousJson, suspiciousDuplicateReceipts),
    },
  ];

  for (const image of imageDataList) {
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    });
  }

  const response = await createGroqCompletionWithRetry({
    model: VISION_MODEL,
    temperature: 0.0,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contentParts },
    ],
  }, `vision-audit:${imageDataList.length}`);

  const content = response.choices[0].message.content ?? "{}";
  const audited = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);

  console.log("Receipt audit response:", {
    previousItems: parsed.items.length,
    auditedItems: audited.items.length,
    receiptsWithMismatch: audited.receiptSummaries.filter((receipt) => receipt.mismatchType !== "ok").length,
  });

  return audited;
}

async function processTextWithAI(
  ctx: any,
  householdId: string,
  text: string,
  compactCategories: string,
  categoriesArray: any[]
): Promise<ProcessReceiptResult & { retryUsed: boolean }> {
  const prompt = buildPrompt(compactCategories, text.slice(0, 8000));
  const response = await createGroqCompletionWithRetry({
    model: VISION_MODEL,
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  }, "text-ocr");

  const content = response.choices[0].message.content ?? "{}";
  const parsed = await parseAndNormalizeResponse(ctx, householdId, content, categoriesArray, VISION_MODEL);
  return { ...parsed, retryUsed: false };
}

async function listCategoriesForHouseholdInternal(ctx: any, householdId: string) {
  return await ctx.runQuery(internal.categories.listForHouseholdInternal, {
    householdId,
  });
}

function installPdfJsNodeShims() {
  const globalScope = globalThis as any;

  if (typeof globalScope.DOMMatrix === "undefined") {
    class MinimalDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      is2D = true;
      isIdentity = true;

      constructor(init?: string | number[]) {
        if (Array.isArray(init)) {
          [
            this.a = 1,
            this.b = 0,
            this.c = 0,
            this.d = 1,
            this.e = 0,
            this.f = 0,
          ] = init.map((value) => Number(value) || 0);
        }
        this.#refreshFlags();
      }

      multiplySelf(other: MinimalDOMMatrix | number[]) {
        const matrix = MinimalDOMMatrix.#from(other);
        return this.#set(
          this.a * matrix.a + this.c * matrix.b,
          this.b * matrix.a + this.d * matrix.b,
          this.a * matrix.c + this.c * matrix.d,
          this.b * matrix.c + this.d * matrix.d,
          this.a * matrix.e + this.c * matrix.f + this.e,
          this.b * matrix.e + this.d * matrix.f + this.f
        );
      }

      preMultiplySelf(other: MinimalDOMMatrix | number[]) {
        const matrix = MinimalDOMMatrix.#from(other);
        return this.#set(
          matrix.a * this.a + matrix.c * this.b,
          matrix.b * this.a + matrix.d * this.b,
          matrix.a * this.c + matrix.c * this.d,
          matrix.b * this.c + matrix.d * this.d,
          matrix.a * this.e + matrix.c * this.f + matrix.e,
          matrix.b * this.e + matrix.d * this.f + matrix.f
        );
      }

      translate(tx = 0, ty = 0) {
        return this.multiplySelf([1, 0, 0, 1, tx, ty]);
      }

      scale(scaleX = 1, scaleY = scaleX) {
        return this.multiplySelf([scaleX, 0, 0, scaleY, 0, 0]);
      }

      invertSelf() {
        const determinant = this.a * this.d - this.b * this.c;
        if (!determinant) {
          return this.#set(NaN, NaN, NaN, NaN, NaN, NaN);
        }

        return this.#set(
          this.d / determinant,
          -this.b / determinant,
          -this.c / determinant,
          this.a / determinant,
          (this.c * this.f - this.d * this.e) / determinant,
          (this.b * this.e - this.a * this.f) / determinant
        );
      }

      #set(a: number, b: number, c: number, d: number, e: number, f: number) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
        this.#refreshFlags();
        return this;
      }

      #refreshFlags() {
        this.isIdentity =
          this.a === 1 &&
          this.b === 0 &&
          this.c === 0 &&
          this.d === 1 &&
          this.e === 0 &&
          this.f === 0;
      }

      static #from(input: MinimalDOMMatrix | number[]) {
        return input instanceof MinimalDOMMatrix ? input : new MinimalDOMMatrix(input);
      }
    }

    globalScope.DOMMatrix = MinimalDOMMatrix;
  }

  if (typeof globalScope.ImageData === "undefined") {
    class MinimalImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(dataOrWidth: Uint8ClampedArray | number, width: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = width;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
          return;
        }

        this.data = dataOrWidth;
        this.width = width;
        this.height = height ?? Math.floor(dataOrWidth.length / 4 / Math.max(width, 1));
      }
    }

    globalScope.ImageData = MinimalImageData;
  }

  if (typeof globalScope.Path2D === "undefined") {
    class MinimalPath2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      rect() {}
    }

    globalScope.Path2D = MinimalPath2D;
  }
}

async function extractTextFromPdfBlob(blob: Blob) {
  installPdfJsNodeShims();
  const globalScope = globalThis as any;

  if (!globalScope.pdfjsWorker?.WorkerMessageHandler) {
    globalScope.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const document = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n").trim();
}

function remapProcessResult(
  result: ProcessReceiptResult,
  receiptOffset: number,
  sourceImageIndex: number | null
): ProcessReceiptResult {
  const fallbackSummary = {
    receiptIndex: 0,
    receiptLabel: sourceImageIndex ? `Załącznik ${sourceImageIndex}` : "Mail",
    totalAmount: result.totalAmount || "",
    payableAmount: result.payableAmount || "",
    depositTotal: result.depositTotal || "",
    sourceImageIndex,
  };

  const summaries = (result.receiptSummaries.length > 0 ? result.receiptSummaries : [fallbackSummary]).map((summary) => ({
    ...summary,
    receiptIndex: summary.receiptIndex + receiptOffset,
    receiptLabel: summary.receiptLabel || (sourceImageIndex ? `Załącznik ${sourceImageIndex}` : "Mail"),
    sourceImageIndex,
  }));

  const items = result.items.map((item) => ({
    ...item,
    receiptIndex: item.receiptIndex + receiptOffset,
    receiptLabel: item.receiptLabel || summaries[0]?.receiptLabel || (sourceImageIndex ? `Załącznik ${sourceImageIndex}` : "Mail"),
    sourceImageIndex,
  }));

  return {
    ...result,
    items,
    receiptSummaries: summaries,
    receiptCount: summaries.length,
  };
}

function mergeProcessResults(results: ProcessReceiptResult[]): ProcessReceiptResult {
  const mergedItems: ProcessedReceiptItem[] = [];
  const mergedSummaries: ReceiptSummary[] = [];
  const rawLabels: string[] = [];
  let total = 0;
  let payable = 0;
  let deposit = 0;

  for (const result of results) {
    if (result.rawText) {
      rawLabels.push(result.rawText);
    }
    mergedItems.push(...result.items);
    mergedSummaries.push(...result.receiptSummaries);
    total += Number.parseFloat(result.totalAmount || "0") || 0;
    payable += Number.parseFloat(result.payableAmount || "0") || 0;
    deposit += Number.parseFloat(result.depositTotal || "0") || 0;
  }

  return {
    items: mergedItems,
    rawText: rawLabels.join(" | "),
    totalAmount: total > 0 ? total.toFixed(2) : "",
    payableAmount: payable > 0 ? payable.toFixed(2) : "",
    depositTotal: deposit > 0 ? deposit.toFixed(2) : "",
    modelUsed: results.some((result) => result.modelUsed && result.modelUsed !== VISION_MODEL) ? "mixed" : VISION_MODEL,
    receiptCount: mergedSummaries.length || 1,
    receiptSummaries: enrichReceiptSummariesWithValidation(mergedSummaries, mergedItems),
  };
}

export const processEmailAttachments = internalAction({
  args: {
    storageIds: v.array(v.id("_storage")),
    mimeTypes: v.array(v.string()),
    householdId: v.id("households"),
    fallbackText: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ProcessReceiptResult> => {
    const categoriesArray = await listCategoriesForHouseholdInternal(ctx, args.householdId);
    if (categoriesArray.length === 0) {
      throw new Error("Brak kategorii dla gospodarstwa.");
    }

    const compactCategories = buildCompactCategoryList(categoriesArray);
    const partialResults: ProcessReceiptResult[] = [];
    let receiptOffset = 0;

    for (let index = 0; index < args.storageIds.length; index++) {
      const storageId = args.storageIds[index];
      const mimeType = args.mimeTypes[index] || "application/octet-stream";
      const blob = await ctx.storage.get(storageId);
      if (!blob) continue;

      let result: ProcessReceiptResult | null = null;

      if (mimeType.startsWith("image/")) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        result = await processImagesWithAI(
          ctx,
          args.householdId,
          [{ base64: buffer.toString("base64"), mimeType }],
          compactCategories,
          categoriesArray
        );
      } else if (mimeType === "application/pdf") {
        const extractedText = await extractTextFromPdfBlob(blob);
        if (extractedText) {
          result = await processTextWithAI(
            ctx,
            args.householdId,
            extractedText,
            compactCategories,
            categoriesArray
          );
        }
      }

      if (!result) continue;

      const remapped = remapProcessResult(result, receiptOffset, index + 1);
      partialResults.push(remapped);
      receiptOffset += Math.max(1, remapped.receiptSummaries.length || remapped.receiptCount || 1);
    }

    if (partialResults.length === 0 && args.fallbackText?.trim()) {
      return await processTextWithAI(
        ctx,
        args.householdId,
        args.fallbackText,
        compactCategories,
        categoriesArray
      );
    }

    if (partialResults.length === 0) {
      return {
        items: [],
        rawText: "",
        totalAmount: "",
        payableAmount: "",
        depositTotal: "",
        modelUsed: VISION_MODEL,
        receiptCount: 1,
        receiptSummaries: [{
          receiptIndex: 0,
          receiptLabel: "Mail",
          totalAmount: "",
          payableAmount: "",
          depositTotal: "",
          sourceImageIndex: null,
        }],
      };
    }

    return mergeProcessResults(partialResults);
  },
});

export const processEmailBodyText = internalAction({
  args: {
    householdId: v.id("households"),
    text: v.string(),
  },
  handler: async (ctx, args): Promise<ProcessReceiptResult> => {
    const categoriesArray = await listCategoriesForHouseholdInternal(ctx, args.householdId);
    if (categoriesArray.length === 0) {
      throw new Error("Brak kategorii dla gospodarstwa.");
    }

    const compactCategories = buildCompactCategoryList(categoriesArray);
    return await processTextWithAI(ctx, args.householdId, args.text, compactCategories, categoriesArray);
  },
});

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

      const categoriesArray = Array.isArray(args.categories) ? args.categories : [];
      if (categoriesArray.length === 0) {
        throw new Error("Brak kategorii.");
      }

      const compactCategories = buildCompactCategoryList(categoriesArray);
      const imageDataList: ImageInput[] = [];

      for (const storageId of args.storageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (!url) continue;

        const fileResponse = await fetch(url);
        if (!fileResponse.ok) continue;

        const arrayBuffer = await fileResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = (fileResponse.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
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
      const sumMatchedTotal = result.receiptSummaries.length > 0
        ? result.receiptSummaries.every((receipt) => receipt.mismatchType === "ok")
        : false;

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

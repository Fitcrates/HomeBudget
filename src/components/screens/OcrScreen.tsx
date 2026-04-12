import { useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ScannerIcon } from "../ui/icons/ScannerIcon";
import { FileText, Image } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import catLottie from "../../assets/Cat playing animation.lottie?url";

// Set pdf.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface Props {
  storageIds: Id<"_storage">[];
  mimeTypes?: string[];
  householdId: Id<"households">;
  onDone: () => void;
  onAddMoreImages?: (ids: Id<"_storage">[]) => void;
}

function isAmountUncertain(amount: string) {
  return !amount.trim();
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

interface ParsedItem {
  id: string;
  description: string;
  originalRawDescription?: string;
  amount: string;
  categoryId: Id<"categories"> | null;
  subcategoryId: Id<"subcategories"> | null;
  fromMapping?: boolean;
  receiptIndex: number;
  receiptLabel?: string;
  sourceImageIndex?: number | null;
}

interface ReceiptSummary {
  receiptIndex: number;
  receiptLabel: string;
  totalAmount: string;
  sourceImageIndex: number | null;
  itemsTotal?: string;
  difference?: string;
  mismatchType?: "ok" | "missing_items" | "missing_discounts" | "unknown";
}

interface ProcessReceiptResult {
  items: Array<{
    description?: string;
    originalRawDescription?: string;
    amount?: string;
    categoryId?: Id<"categories"> | null;
    subcategoryId?: Id<"subcategories"> | null;
    fromMapping?: boolean;
    receiptIndex?: number;
    receiptLabel?: string;
    sourceImageIndex?: number | null;
  }>;
  rawText?: string;
  totalAmount?: string;
  modelUsed?: string;
  receiptCount?: number;
  receiptSummaries?: ReceiptSummary[];
}

const PDF_MIME = "application/pdf";
const OCR_CACHE_VERSION = "v1";
const OCR_CACHE_PREFIX = `homebudget:ocr-cache:${OCR_CACHE_VERSION}:`;
const OCR_CACHE_INDEX_KEY = `${OCR_CACHE_PREFIX}index`;
const OCR_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const OCR_CACHE_MAX_ENTRIES = 20;

interface CachedOcrPayload {
  createdAt: number;
  key: string;
  result: ProcessReceiptResult;
}

async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const data = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cleanupOcrCache(now: number) {
  try {
    const rawIndex = localStorage.getItem(OCR_CACHE_INDEX_KEY);
    const parsedIndex = rawIndex ? (JSON.parse(rawIndex) as Array<{ key: string; createdAt: number }>) : [];
    const fresh = parsedIndex
      .filter((entry) => now - entry.createdAt <= OCR_CACHE_TTL_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, OCR_CACHE_MAX_ENTRIES);

    const freshKeys = new Set(fresh.map((entry) => entry.key));
    for (const entry of parsedIndex) {
      if (!freshKeys.has(entry.key)) {
        localStorage.removeItem(entry.key);
      }
    }

    localStorage.setItem(OCR_CACHE_INDEX_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore cache maintenance failures
  }
}

function readCachedOcrResult(cacheKey: string, now: number): ProcessReceiptResult | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOcrPayload;
    if (!parsed?.createdAt || !parsed?.result) return null;
    if (now - parsed.createdAt > OCR_CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCachedOcrResult(cacheKey: string, result: ProcessReceiptResult, now: number) {
  try {
    const payload: CachedOcrPayload = {
      createdAt: now,
      key: cacheKey,
      result,
    };
    localStorage.setItem(cacheKey, JSON.stringify(payload));

    const rawIndex = localStorage.getItem(OCR_CACHE_INDEX_KEY);
    const parsedIndex = rawIndex ? (JSON.parse(rawIndex) as Array<{ key: string; createdAt: number }>) : [];
    const merged = [{ key: cacheKey, createdAt: now }, ...parsedIndex.filter((entry) => entry.key !== cacheKey)];
    localStorage.setItem(OCR_CACHE_INDEX_KEY, JSON.stringify(merged));
    cleanupOcrCache(now);
  } catch {
    // Ignore cache write failures
  }
}

export function OcrScreen({ storageIds, mimeTypes, householdId, onDone }: Props) {
  const [processing, setProcessing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [expectedTotal, setExpectedTotal] = useState<string>("");
  const [receiptSummaries, setReceiptSummaries] = useState<ReceiptSummary[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const initialPreviews = storageIds.map((id, index) => {
    return (mimeTypes && mimeTypes[index] === PDF_MIME) ? "pdf" : "";
  });
  const [previewUrls, setPreviewUrls] = useState<string[]>(initialPreviews.filter(Boolean));
  const [previewTypes, setPreviewTypes] = useState<string[]>(mimeTypes || []);
  const [uploading, setUploading] = useState(false);
  const [currentStorageIds, setCurrentStorageIds] = useState<Id<"_storage">[]>(storageIds);
  const [currentMimeTypes, setCurrentMimeTypes] = useState<string[]>(mimeTypes || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processAI = useAction(api.ocr.processReceiptWithAI);
  const getFileUrl = useAction(api.ocr.getFileUrl);
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const createExpensesMany = useMutation(api.expenses.createMany);
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);
  const upsertMapping = useMutation(api.productMappings.upsertMapping);

  const hasPdf = currentMimeTypes.some((t) => t === PDF_MIME) ||
    previewTypes.some((t) => t === PDF_MIME);

  async function computeCategoriesChecksum() {
    const categorySignature = (categories || []).map((cat) => ({
      id: String(cat._id),
      name: cat.name,
      subIds: (cat.subcategories || []).map((sub: any) => String(sub._id)),
    }));
    return sha256Hex(JSON.stringify(categorySignature));
  }

  async function computeOcrFingerprint(categoriesChecksum: string) {
    const parts: string[] = [
      `household:${String(householdId)}`,
      `categories:${categoriesChecksum}`,
      `count:${currentStorageIds.length}`,
    ];

    for (let i = 0; i < currentStorageIds.length; i++) {
      const storageId = currentStorageIds[i];
      const mime = currentMimeTypes[i] || previewTypes[i] || "unknown";
      try {
        const url = await getFileUrl({ storageId });
        if (!url) {
          parts.push(`${i}:${String(storageId)}:${mime}:missing-url`);
          continue;
        }
        const res = await fetch(url);
        if (!res.ok) {
          parts.push(`${i}:${String(storageId)}:${mime}:http-${res.status}`);
          continue;
        }
        const data = await res.arrayBuffer();
        const fileHash = await sha256Hex(data);
        parts.push(`${i}:${mime}:${data.byteLength}:${fileHash}`);
      } catch {
        parts.push(`${i}:${String(storageId)}:${mime}:fetch-error`);
      }
    }

    return sha256Hex(parts.join("|"));
  }

  function applyOcrResult(result: ProcessReceiptResult, fromCache: boolean) {
    const detectedItems = Array.isArray(result?.items) ? result.items : [];
    setRawText(result?.rawText || "");
    setExpectedTotal(result?.totalAmount || "");
    setReceiptSummaries(Array.isArray(result?.receiptSummaries) ? result.receiptSummaries : []);

    if (detectedItems.length === 0) {
      toast.error(fromCache ? "Brak pozycji w zapisanym wyniku OCR." : "AI nie znalazło żadnych dopasowań.");
      setItems([
        {
          id: crypto.randomUUID(),
          description: "Nieznany koszt",
          amount: "",
          categoryId: null,
          subcategoryId: null,
          receiptIndex: 0,
        },
      ]);
      return;
    }

    const generatedItems: ParsedItem[] = detectedItems.map((row) => ({
      id: crypto.randomUUID(),
      description: row.description || "Brak nazwy",
      originalRawDescription: row.originalRawDescription,
      amount: row.amount || "0",
      categoryId: row.categoryId || null,
      subcategoryId: row.subcategoryId || null,
      fromMapping: row.fromMapping,
      receiptIndex: Number.isFinite(row.receiptIndex) ? (row.receiptIndex as number) : 0,
      receiptLabel: row.receiptLabel,
      sourceImageIndex: row.sourceImageIndex ?? null,
    }));
    setItems(generatedItems);

    const learnedCount = generatedItems.filter((i) => i.fromMapping).length;
    const receiptsDetected = result?.receiptCount || 1;

    if (fromCache) {
      toast.success(`Wczytano zapisany wynik OCR (${generatedItems.length} pozycji) bez ponownej analizy AI.`);
      return;
    }

    const modelName = result?.modelUsed || "gpt-4o";
    if (receiptsDetected > 1) {
      toast.success(`Wykryto ${receiptsDetected} paragony. Pozycje są już podzielone i zapiszą się w kolejce.`);
    }
    if (learnedCount > 0) {
      toast.success(`AI dopasowało ${generatedItems.length} pozycji (w tym ${learnedCount} z Twojej bazy wiedzy)!`);
    } else {
      toast.success(`AI (${modelName}) dopasowało ${generatedItems.length} pozycji!`);
    }
  }

  async function handleAddImages(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(e.target.files ?? []);
    if (rawFiles.length === 0) return;
    setUploading(true);
    try {
      const processedBlobs: { blob: Blob; type: string }[] = [];

      for (const file of rawFiles) {
        if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = Math.min(3, pdf.numPages); // Limit to 3 pages

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (!context) continue;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, canvas, viewport }).promise;

            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
            if (blob) processedBlobs.push({ blob, type: "image/jpeg" });
          }
        } else {
          processedBlobs.push({ blob: file, type: file.type });
        }
      }

      const toUpload = processedBlobs.slice(0, 3 - currentStorageIds.length);
      if (toUpload.length === 0) {
        toast.error("Osiągnięto limit 3 stron/plików.");
        setUploading(false);
        return;
      }

      const newIds: Id<"_storage">[] = [];
      const newPreviews: string[] = [];
      const newTypes: string[] = [];

      for (const item of toUpload) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": item.type },
          body: item.blob,
        });
        const { storageId } = await res.json();
        newIds.push(storageId as Id<"_storage">);
        newTypes.push(item.type);
        newPreviews.push(URL.createObjectURL(item.blob));
      }

      setCurrentStorageIds((prev) => [...prev, ...newIds]);
      setCurrentMimeTypes((prev) => [...prev, ...newTypes]);
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
      setPreviewTypes((prev) => [...prev, ...newTypes]);
      toast.success(`Dodano ${newIds.length} plik(i).`);
    } catch (err: any) {
      console.error(err);
      toast.error("Błąd przetwarzania pliku. Spróbuj powtórzyć.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExtract() {
    if (!categories) {
      toast.error("Kategorie jeszcze się ładują. Spróbuj za chwilę.");
      return;
    }
    setProcessing(true);
    const startTime = Date.now();
    try {
      const now = Date.now();
      cleanupOcrCache(now);
      const categoriesChecksum = await computeCategoriesChecksum();
      const fingerprint = await computeOcrFingerprint(categoriesChecksum);
      const cacheKey = `${OCR_CACHE_PREFIX}${fingerprint}`;
      const cachedResult = readCachedOcrResult(cacheKey, now);

      if (cachedResult) {
        applyOcrResult(cachedResult, true);
        return;
      }

      const result = (await processAI({
        storageIds: currentStorageIds,
        categories,
        householdId,
        isPdf: false,
      })) as ProcessReceiptResult;

      writeCachedOcrResult(cacheKey, result, now);
      applyOcrResult(result, false);
    } catch (err: any) {
      toast.error(err.message || "Błąd podczas łączenia z AI.");
      setItems([
        {
          id: crypto.randomUUID(),
          description: "Błąd AI",
          amount: "",
          categoryId: null,
          subcategoryId: null,
          receiptIndex: 0,
        },
      ]);
      setReceiptSummaries([]);
    } finally {
      const elapsed = Date.now() - startTime;
      const minLoadingTime = 2000;
      if (elapsed < minLoadingTime) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsed));
      }
      setProcessing(false);
    }
  }

  async function handleSaveAll() {
    if (!items || items.length === 0) return;

    // Validate each item and give specific feedback
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pos = i + 1;
      const amountNum = parseFloat((item.amount || "").replace(",", "."));

      if (!item.amount || !item.amount.trim() || isNaN(amountNum) || amountNum <= 0) {
        toast.error(`Pozycja ${pos} ("${item.description}"): uzupełnij kwotę.`);
        return;
      }
      if (!item.categoryId) {
        toast.error(`Pozycja ${pos} ("${item.description}"): wybierz kategorię.`);
        return;
      }
      if (!item.subcategoryId) {
        toast.error(`Pozycja ${pos} ("${item.description}"): wybierz podkategorię.`);
        return;
      }
    }

    setSaving(true);
    let successCount = 0;
    let processedReceipts = 0;
    try {
      const sortedItems = [...items].sort((a, b) => {
        if (a.receiptIndex !== b.receiptIndex) return a.receiptIndex - b.receiptIndex;
        return a.description.localeCompare(b.description);
      });

      let currentReceiptIndex: number | null = null;

      const payloadItems: Array<{
        categoryId: Id<"categories">;
        subcategoryId: Id<"subcategories">;
        amount: number;
        date: number;
        description: string;
        receiptImageId?: Id<"_storage">;
        ocrRawText?: string;
      }> = [];

      for (const item of sortedItems) {
        if (item.receiptIndex !== currentReceiptIndex) {
          currentReceiptIndex = item.receiptIndex;
          processedReceipts++;
          toast.info(`Zapisywanie: ${item.receiptLabel || `Paragon ${item.receiptIndex + 1}`}`);
        }

        const sourceIdx = item.sourceImageIndex && item.sourceImageIndex > 0
          ? item.sourceImageIndex - 1
          : 0;
        const receiptImageId = currentStorageIds[sourceIdx] || currentStorageIds[0];
        const amountNum = parseFloat(item.amount.replace(",", "."));

        payloadItems.push({
          categoryId: item.categoryId!,
          subcategoryId: item.subcategoryId!,
          amount: Math.round(amountNum * 100),
          date: new Date(date).getTime(),
          description: item.description,
          receiptImageId,
          ocrRawText: rawText,
        });

        successCount++;
      }

      await createExpensesMany({
        householdId,
        items: payloadItems,
      });

      for (const item of sortedItems) {
        // Loop: Save user corrections for future auto-mapping
        if (item.originalRawDescription) {
           await upsertMapping({
             householdId,
             rawDescription: item.originalRawDescription,
             correctedDescription: item.description,
             categoryId: item.categoryId!,
             subcategoryId: item.subcategoryId!
           });
        }
      }

      const receiptLabel = processedReceipts > 1
        ? `${processedReceipts} paragonów`
        : "paragonu";
      toast.success(`Zapisano pomyślnie ${successCount} wydatków z ${receiptLabel}!`);
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateItem(id: string, updates: Partial<ParsedItem>) {
    setItems(items ? items.map((i) => (i.id === id ? { ...i, ...updates } : i)) : null);
  }

  function removeItem(id: string) {
    setItems(items ? items.filter((i) => i.id !== id) : null);
  }

  const cardStyle =
    "bg-[#fdf9f1] w-full rounded-[2rem] p-6 shadow-[0_8px_24px_rgba(180,120,80,0.15)] space-y-3";
  const labelStyle =
    "block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1";
  const inputStyle =
    "w-full text-sm bg-white border border-[#f5e5cf] rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] transition-colors text-[#2b180a] font-bold";

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onDone}
            className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none mb-0.5"
          >
            ←
          </button>
          <ScannerIcon className="w-8 h-8 text-[#c76823]" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a]">
            Skaner Paragonów
          </h2>
        </div>
      </div>

      {/* ── IMAGE / PDF UPLOAD SECTION ── */}
      <div className={cardStyle}>
        <label className={labelStyle}>
          Zdjęcia / PDF ({currentStorageIds.length}/3)
        </label>

        {/* Thumbnails row */}
        {previewUrls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative">
                {url === "pdf" ? (
                  <div className="h-20 w-20 rounded-xl border-2 border-[#f2d6bf] shadow-sm bg-[#fff8f2] flex flex-col items-center justify-center gap-1">
                    <FileText className="w-8 h-8 text-[#cf833f]" />
                    <span className="text-[9px] font-bold text-[#cf833f]">PDF</span>
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={`Plik ${i + 1}`}
                    className="h-20 w-20 object-cover rounded-xl border-2 border-[#f2d6bf] shadow-sm"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrls((p) => p.filter((_, idx) => idx !== i));
                    setPreviewTypes((p) => p.filter((_, idx) => idx !== i));
                    setCurrentStorageIds((p) => p.filter((_, idx) => idx !== i));
                    setCurrentMimeTypes((p) => p.filter((_, idx) => idx !== i));
                  }}
                  className="absolute -top-1.5 -right-1.5 bg-white text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs border border-red-200 shadow-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload buttons */}
        <div className="flex gap-3">
          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${currentStorageIds.length >= 3
              ? "border-[#e0d0c0] opacity-40 cursor-not-allowed"
              : "border-[#8bc5a0] bg-[#ebf7ef]/60 hover:border-[#67a57e] hover:bg-[#d8eedf]"
              }`}
          >
            <ScannerIcon className="w-6 h-6 text-[#46825d]" />
            <span className="text-xs font-bold text-[#46825d]">
              {uploading ? "Przesyłanie..." : "Aparat"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleAddImages}
              disabled={uploading || currentStorageIds.length >= 3}
            />
          </label>

          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${currentStorageIds.length >= 3
              ? "border-[#e0d0c0] opacity-40 cursor-not-allowed"
              : "border-[#d2bcad] bg-white/40 hover:border-orange-400 hover:bg-orange-50/50"
              }`}
          >
            <Image className="w-6 h-6 text-[#8a7262]" />
            <span className="text-xs font-bold text-[#8a7262]">
              {uploading ? "Przesyłanie..." : "Galeria"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddImages}
              disabled={uploading || currentStorageIds.length >= 3}
            />
          </label>

          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${currentStorageIds.length >= 3
              ? "border-[#e0d0c0] opacity-40 cursor-not-allowed"
              : "border-[#b8a8d8] bg-[#f5f0ff]/60 hover:border-[#8b6fd4] hover:bg-[#ede8ff]"
              }`}
          >
            <FileText className="w-6 h-6 text-[#6b4fa8]" />
            <span className="text-xs font-bold text-[#6b4fa8]">
              {uploading ? "Przesyłanie..." : "Dokument"}
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleAddImages}
              disabled={uploading || currentStorageIds.length >= 3}
            />
          </label>
        </div>

        {hasPdf && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f5f0ff] border border-[#d8ccf5] text-xs font-bold text-[#6b4fa8]">
            <FileText className="w-4 h-4" />
            <span>PDF wykryty — AI wyciągnie tekst i pozycje automatycznie</span>
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 justify-center py-1">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
            Przesyłanie...
          </div>
        )}

        {/* Analyse button & Animation loading state */}
        {!items && (
          <div className="flex flex-col items-center">
            <button
              onClick={handleExtract}
              disabled={processing || !categories || currentStorageIds.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-extrabold text-[15px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50 mt-1"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  Przetwarzanie AI... 🤖
                </span>
              ) : (
                `🔍 Analizuj paragony/faktury`
              )}
            </button>
            {processing && (
              <div className="mt-4 flex flex-col items-center justify-center gap-4">
                <div className="w-32 h-32 relative flex items-center justify-center bg-[#fff8f2] rounded-full shadow-inner border border-[#f2d6bf]">
                  <div className="absolute inset-0 border-[4px] border-t-transparent border-[#de9241] rounded-full animate-spin" />
                  <div className="absolute inset-2 border-[4px] border-b-transparent border-[#ca782a] rounded-full animate-spin direction-reverse" />
                  <div className="w-24 h-24 rounded-full overflow-hidden absolute">
                    <DotLottieReact src={catLottie} loop autoplay />
                  </div>
                </div>
                <p className="text-[#8a7262] font-bold text-sm animate-pulse">
                  Czytanie dokumentu z Groq Llama 4 Scout...
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RESULTS SECTION ── */}
      {items && (
        <div className="space-y-6">
          <div className={cardStyle}>
            <label className={labelStyle}>Data paragonu</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputStyle}
            />
          </div>

          {/* Re-analyse button */}
          <button
            onClick={() => { setItems(null); setReceiptSummaries([]); }}
            className="w-full py-2.5 border-2 border-dashed border-[#d2bcad] text-[#8a7262] rounded-2xl font-bold text-sm hover:border-[#cf833f] hover:text-[#cf833f] transition-colors"
          >
            ↩ Skanuj ponownie
          </button>

          {(receiptSummaries.length > 1 || items.some((i) => i.receiptIndex > 0)) && (
            <div className="bg-[#eef4ff] border border-[#c8d8ff] rounded-2xl p-3 text-xs font-bold text-[#3856a8]">
              Wykryto wiele paragonów. Zapis nastąpi sekwencyjnie, paragon po paragonie.
            </div>
          )}

          {receiptSummaries.length > 0 && (
            <div className="space-y-2">
              {receiptSummaries.map((receipt) => {
                const itemsSum = parseFloat((receipt.itemsTotal || "").replace(",", "."));
                const expected = parseFloat((receipt.totalAmount || "").replace(",", "."));
                const diffValue = parseFloat((receipt.difference || "0").replace(",", "."));
                const diff = Math.abs(diffValue);
                const isMismatch = receipt.mismatchType !== "ok" && expected > 0 && diff > 0.05;

                if (!(expected > 0)) {
                  return (
                    <div
                      key={receipt.receiptIndex}
                      className="bg-[#f8f1e8] border border-[#ead8c5] rounded-xl p-3 text-xs font-bold text-[#7e6149]"
                    >
                      {receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`}: brak wykrytej sumy końcowej. Sprawdź pozycje ręcznie.
                    </div>
                  );
                }

                return (
                  <div
                    key={receipt.receiptIndex}
                    className={isMismatch
                      ? "bg-[#fff2ec] border border-[#ffc2af] rounded-xl p-3"
                      : "bg-[#ebf7ef] border border-[#8bc5a0] rounded-xl p-3"
                    }
                  >
                    <p className={isMismatch
                      ? "text-[#a94d22] text-xs font-bold leading-relaxed"
                      : "text-[#46825d] text-xs font-bold"
                    }>
                      {isMismatch ? "⚠️" : "✅"} {receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`}: suma pozycji ({formatAmount(itemsSum)}) vs suma paragonu ({formatAmount(expected)}).
                      {isMismatch && (
                        <>
                          <br />
                          {diffValue > 0
                            ? `Pozycje są wyższe o ${formatAmount(diff)} — zwykle brakuje uwzględnionego rabatu/promocji.`
                            : `Pozycje są niższe o ${formatAmount(diff)} — prawdopodobnie brakuje pozycji.`}
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="bg-white/40 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(180,120,80,0.2)] rounded-[2rem] p-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-white/10 pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-[14px] font-extrabold text-[#3e2815] p-4 pb-2">
                  OCR: Tekst wyodrębniony! ({items.length})
                </h3>
                
                {expectedTotal && receiptSummaries.length === 0 && (
                  (() => {
                    const sum = items.reduce((acc, curr) => {
                      const val = parseFloat((curr.amount || "").replace(",", "."));
                      return acc + (isNaN(val) ? 0 : val);
                    }, 0);
                    const expected = parseFloat(expectedTotal.replace(",", "."));
                    const diffValue = sum - expected;
                    const diff = Math.abs(diffValue);
                    
                    if (diff > 0.05) {
                      const overByDiscount = diffValue > 0;
                      return (
                        <div className="mx-4 mb-4 bg-[#fff2ec] border border-[#ffc2af] rounded-xl p-3 shadow-sm">
                          <p className="text-[#a94d22] text-xs font-bold leading-relaxed">
                            ⚠️ Suma pozycji ({sum.toFixed(2)}) nie zgadza się z sumą paragonu ({expected.toFixed(2)}).
                            <br />
                            {overByDiscount
                              ? `Pozycje są wyższe o ${diff.toFixed(2)} — najczęściej oznacza to brak uwzględnionych rabatów/promocji.`
                              : `Pozycje są niższe o ${diff.toFixed(2)} — możliwe, że brakuje jednej lub więcej pozycji.`}
                          </p>
                        </div>
                      );
                    }
                    return (
                        <div className="mx-4 mb-4 bg-[#ebf7ef] border border-[#8bc5a0] rounded-xl p-3 shadow-sm">
                          <p className="text-[#46825d] text-xs font-bold">
                            ✅ Suma pozycji ({sum.toFixed(2)}) zgadza się z sumą paragonu!
                          </p>
                        </div>
                    );
                  })()
                )}

                <div className="space-y-4">
                  {items.map((item, index) => {
                    const selectedCat = categories?.find((c) => c._id === item.categoryId);
                    const uncertainPrice = isAmountUncertain(item.amount);
                    return (
                      <div
                        key={item.id}
                        className="bg-white/60 backdrop-blur-md rounded-[1.5rem] p-2 shadow-sm border border-white/60"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-[#b89b87] bg-[#f5e5cf]/50 px-2 py-1 rounded-lg">
                              Pozycja {index + 1}
                            </span>
                            {(receiptSummaries.length > 1 || item.receiptIndex > 0) && (
                              <span className="text-[10px] font-bold text-[#3856a8] bg-[#eef4ff] border border-[#c8d8ff] px-2 py-1 rounded-lg">
                                {item.receiptLabel || `Paragon ${item.receiptIndex + 1}`}
                              </span>
                            )}
                            {item.fromMapping && (
                              <span className="text-[10px] font-bold text-[#46825d] bg-[#ebf7ef] border border-[#8bc5a0] px-2 py-1 rounded-lg">
                                Z historii 🧠
                              </span>
                            )}
                            {uncertainPrice && (
                              <span className="text-[10px] font-bold text-[#9a2b00] bg-[#ffe1d6] border border-[#ffc2af] px-2 py-1 rounded-lg">
                                Niepewna cena
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-400 hover:text-red-500 text-xs font-bold p-1"
                          >
                            Usuń
                          </button>
                        </div>

                        <div className="flex gap-2 mb-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                            className="flex-1 text-sm bg-white border border-[#f5e5cf] rounded-xl px-3 py-2 outline-none focus:border-[#cf833f] font-bold text-[#3e2815]"
                            placeholder="Opis produktu"
                          />
                          <div className="relative w-[8.5rem]">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.amount}
                              onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                              className={`w-full text-[15px] bg-white border rounded-xl px-3 py-2.5  outline-none font-bold text-right tabular-nums ${uncertainPrice
                                ? "border-[#f3a086] text-[#b74210] focus:border-[#d95d27]"
                                : "border-[#f5e5cf] text-[#cf833f] focus:border-[#cf833f]"
                                }`}
                              placeholder="0.00"
                            />


                          </div>
                        </div>

                        {uncertainPrice && (
                          <p className="text-[11px] font-semibold text-[#a94d22] bg-[#fff2ec] border border-[#ffd4c4] rounded-lg px-2 py-1 mb-2">
                            OCR nie był pewny kwoty. Uzupełnij ręcznie przed zapisem.
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <select
                            className="w-full text-xs bg-white border border-[#f5e5cf] rounded-xl px-2 py-2.5 outline-none font-bold text-[#6d4d38]"
                            value={item.categoryId || ""}
                            onChange={(e) =>
                              updateItem(item.id, {
                                categoryId: e.target.value as Id<"categories">,
                                subcategoryId: null,
                              })
                            }
                          >
                            <option value="" disabled>
                              Wybierz kateg...
                            </option>
                            {categories?.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="w-full text-xs bg-white border border-[#f5e5cf] rounded-xl px-2 py-2.5 outline-none font-bold text-[#6d4d38]"
                            value={item.subcategoryId || ""}
                            onChange={(e) =>
                              updateItem(item.id, {
                                subcategoryId: e.target.value as Id<"subcategories">,
                              })
                            }
                            disabled={!item.categoryId}
                          >
                            <option value="" disabled>
                              Podkategoria...
                            </option>
                            {selectedCat?.subcategories.map((s: any) => (
                              <option key={s._id} value={s._id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() =>
                    setItems([
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        description: "",
                        amount: "",
                        categoryId: null,
                        subcategoryId: null,
                        receiptIndex: 0,
                      },
                    ])
                  }
                  className="mt-4 w-full py-3 border-2 border-dashed border-[#d2bcad]/60 text-[#8a7262] bg-white/30 rounded-2xl font-bold text-sm hover:border-[#cf833f]/50 hover:bg-white/50 transition-colors"
                >
                  + Dodaj kolejną pozycję ręcznie
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={saving || items.length === 0}
            className="w-full py-4 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-extrabold text-[16px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none mt-2 disabled:opacity-50"
          >
            {saving ? "Poczekaj..." : `💾 Zapisz ${items.length} wydatków`}
          </button>
        </div>
      )}
    </div>
  );
}

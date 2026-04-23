import { useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ScannerIcon } from "../ui/icons/ScannerIcon";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  Image,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { ScreenHeader } from "../ui/ScreenHeader";
import { AppCard } from "../ui/AppCard";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { FormSelect } from "../ui/FormSelect";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ButtonSecondary } from "../ui/ButtonSecondary";
import { CatLoader } from "../ui/CatLoader";
import { CompactTable } from "../ui/CompactTable";
import { AlertBanner } from "../ui/AlertBanner";
import { Spinner } from "../ui/Spinner";
import { prepareOcrUploads } from "../../lib/ocrUpload";

import catLottie from "../../assets/Cat playing animation.lottie?url";

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
  payableAmount?: string;
  depositTotal?: string;
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
  payableAmount?: string;
  depositTotal?: string;
  modelUsed?: string;
  receiptCount?: number;
  receiptSummaries?: ReceiptSummary[];
}

const PDF_MIME = "application/pdf";
const OCR_CACHE_VERSION = "v4";
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

type ProcessingStage = "idle" | "cache" | "uploading" | "ai" | "categorizing" | "done";

const STAGE_LABELS: Record<ProcessingStage, string> = {
  idle: "",
  cache: "Sprawdzanie pamięci podręcznej...",
  uploading: "Przygotowanie zdjęć...",
  ai: "Analiza AI — odczyt paragonu...",
  categorizing: "Dopasowanie kategorii...",
  done: "Gotowe!",
};

export function OcrScreen({ storageIds, mimeTypes, householdId, onDone }: Props) {
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
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
  const [pendingRemoveItemId, setPendingRemoveItemId] = useState<string | null>(null);
  const [openBulkMenuId, setOpenBulkMenuId] = useState<string | null>(null);
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
    // Use storageIds directly as cache key — they are already unique identifiers.
    // No need to re-download images just to hash them.
    const parts: string[] = [
      `household:${String(householdId)}`,
      `categories:${categoriesChecksum}`,
      `count:${currentStorageIds.length}`,
      ...currentStorageIds.map((id, i) => {
        const mime = currentMimeTypes[i] || previewTypes[i] || "unknown";
        return `${i}:${String(id)}:${mime}`;
      }),
    ];

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
      const preparedUploads = await prepareOcrUploads(rawFiles);
      const toUpload = preparedUploads.slice(0, 3 - currentStorageIds.length);
      if (toUpload.length === 0) {
        toast.error("Osiągnięto limit 3 stron/plików.");
        setUploading(false);
        return;
      }

      const newIds: Id<"_storage">[] = [];
      const newPreviews: string[] = [];

      for (const item of toUpload) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": item.type },
          body: item.blob,
        });
        const { storageId } = await res.json();
        newIds.push(storageId as Id<"_storage">);
        newPreviews.push(URL.createObjectURL(item.blob));
      }

      setCurrentStorageIds((prev) => [...prev, ...newIds]);
      setCurrentMimeTypes((prev) => [...prev, ...toUpload.map((item) => item.type)]);
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
      setPreviewTypes((prev) => [...prev, ...toUpload.map((item) => item.type)]);
      const optimized = {
        optimizedCount: newIds.length,
        savedBytes: 0,
        storageIds: newIds,
      };

      if (optimized.optimizedCount > 0 && optimized.savedBytes > 0) {
        const savedMb = (optimized.savedBytes / (1024 * 1024)).toFixed(2);
        toast.success(`Dodano ${optimized.storageIds.length} plik(i). Oszczędzono ${savedMb} MB dzięki kompresji.`);
      } else {
        toast.success(`Dodano ${optimized.storageIds.length} plik(i).`);
      }
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
    setProcessingStage("cache");
    try {
      const now = Date.now();
      cleanupOcrCache(now);
      const categoriesChecksum = await computeCategoriesChecksum();
      const fingerprint = await computeOcrFingerprint(categoriesChecksum);
      const cacheKey = `${OCR_CACHE_PREFIX}${fingerprint}`;
      const cachedResult = readCachedOcrResult(cacheKey, now);
      const cachedHasMismatch = Array.isArray(cachedResult?.receiptSummaries)
        ? cachedResult!.receiptSummaries.some((receipt) => receipt.mismatchType && receipt.mismatchType !== "ok")
        : false;

      if (cachedResult && !cachedHasMismatch) {
        setProcessingStage("done");
        applyOcrResult(cachedResult, true);
        return;
      }

      setProcessingStage("ai");
      const result = (await processAI({
        storageIds: currentStorageIds,
        categories,
        householdId,
        isPdf: false,
      })) as ProcessReceiptResult;

      setProcessingStage("categorizing");
      writeCachedOcrResult(cacheKey, result, now);
      setProcessingStage("done");
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
      setProcessing(false);
      setProcessingStage("idle");
    }
  }

  async function handleSaveAll() {
    if (!items || items.length === 0) return;

    // Validate each item and give specific feedback
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pos = i + 1;
      const amountNum = parseFloat((item.amount || "").replace(",", "."));

      if (!item.amount || !item.amount.trim() || isNaN(amountNum) || amountNum === 0) {
        toast.error(`Pozycja ${pos} ("${item.description}"): uzupełnij kwotę inną niż 0.`);
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

  function applyCategoryToRemainingItems(sourceItemId: string) {
    if (!items) return;

    const sourceItem = items.find((item) => item.id === sourceItemId);
    if (!sourceItem?.categoryId || !sourceItem?.subcategoryId) {
      toast.error("Najpierw wybierz kategorię i podkategorię dla tej pozycji.");
      return;
    }

    const targetItems = items.filter((item) => item.id !== sourceItemId);
    const changedCount = targetItems.filter(
      (item) =>
        item.categoryId !== sourceItem.categoryId ||
        item.subcategoryId !== sourceItem.subcategoryId
    ).length;

    if (changedCount === 0) {
      toast.info("Pozostałe pozycje mają już to przypisanie.");
      return;
    }

    setItems(
      items.map((item) => {
        if (item.id === sourceItemId) {
          return item;
        }

        return {
          ...item,
          categoryId: sourceItem.categoryId,
          subcategoryId: sourceItem.subcategoryId,
        };
      })
    );

    toast.success(`Przypisano kategorię do ${changedCount} pozostałych pozycji.`);
  }

  function removeItem(id: string) {
    setItems(items ? items.filter((i) => i.id !== id) : null);
  }

  const itemCount = items?.length ?? 0;
  const uncertainItemsCount = items?.filter((item) => isAmountUncertain(item.amount)).length ?? 0;
  const mappedItemsCount = items?.filter((item) => item.fromMapping).length ?? 0;
  const multiReceiptDetected = Boolean(items && (receiptSummaries.length > 1 || items.some((i) => i.receiptIndex > 0)));
  const expectedComparison = items && expectedTotal && receiptSummaries.length === 0
    ? (() => {
      const sum = items.reduce((acc, curr) => {
        const val = parseFloat((curr.amount || "").replace(",", "."));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      const expected = parseFloat(expectedTotal.replace(",", "."));
      const diffValue = sum - expected;
      const diff = Math.abs(diffValue);
      return {
        sum,
        expected,
        diffValue,
        diff,
        isMismatch: diff > 0.05,
      };
    })()
    : null;

  return (
    <div className="space-y-6 pb-4">
      <ScreenHeader
        icon={<ScannerIcon className="w-8 h-8 text-[#c76823]" />}
        title="Skaner Paragonów"
        subtitle="Jeden prosty flow: dodaj plik, uruchom OCR i popraw wynik przed zapisem."
        onBack={onDone}
      />

      <AppCard padding="md">
        <div className="mb-4 space-y-3">
          <div>
            <FormLabel>Krok 1</FormLabel>
            <h3 className="mt-2 text-lg font-semibold text-[#2b180a]">Dodaj źródła do analizy</h3>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-[#8a7262]">
              Wgraj zdjęcia albo PDF. Jeśli paragon jest długi, dodaj kolejne ujęcie dopiero po pierwszym.
            </p>
          </div>
          <div className="rounded-xl border border-[#f2dfcb] bg-[#fff8f2] px-3 py-2 text-xs font-bold text-[#8a7262]">
            Zdjęcia / PDF ({currentStorageIds.length}/3)
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleAddImages}
          disabled={uploading || currentStorageIds.length >= 3}
        />

        {previewUrls.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative rounded-xl border border-white/60 bg-white/60 p-2 shadow-sm">
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
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {currentStorageIds.length > 0 && currentStorageIds.length < 3 && (
          <div className="mb-4 space-y-2">
            <ButtonSecondary
              variant="dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              icon={<Plus className="h-4 w-4" />}
            >
              Dodaj kolejny kadr / plik
            </ButtonSecondary>
            <p className="text-[11px] font-bold text-[#8a7262] leading-relaxed">
              Dodaj kolejny kadr dopiero po pierwszym zdjęciu, jeśli paragon nie mieści się na jednym ujęciu.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <label
            className={`flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-4 transition-colors cursor-pointer ${currentStorageIds.length >= 3
              ? "border-[#e0d0c0] opacity-40 cursor-not-allowed"
              : "border-[#8bc5a0] bg-[#ebf7ef]/60 hover:border-[#67a57e] hover:bg-[#d8eedf]"
              }`}
          >
            <ScannerIcon className="w-6 h-6 text-[#46825d]" />
            <span className="text-xs font-bold text-[#46825d]">
              {uploading ? "Przesyłanie..." : "Aparat"}
            </span>
            <input
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
            className={`flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-4 transition-colors cursor-pointer ${currentStorageIds.length >= 3
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
            className={`flex min-h-[112px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-4 transition-colors cursor-pointer ${currentStorageIds.length >= 3
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
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#d8ccf5] bg-[#f5f0ff] px-3 py-2 text-xs font-bold text-[#6b4fa8]">
            <FileText className="w-4 h-4" />
            <span>PDF wykryty — AI wyciągnie tekst i pozycje automatycznie</span>
          </div>
        )}

        {uploading && <Spinner className="py-3" size="sm" />}

        {!items && (
          <div className="mt-5 rounded-xl border border-[#f2dfcb] bg-white/55 p-4">
            <div className="mb-4 space-y-2">
              <div>
                <FormLabel>Krok 2</FormLabel>
                <h4 className="mt-1 text-base font-semibold text-[#2b180a]">Uruchom analizę OCR</h4>
              </div>
              <div className="text-xs font-bold text-[#8a7262]">
                AI spróbuje rozpoznać pozycje, kwoty i podpowiedzieć kategorie
              </div>
            </div>
            {processing && (
              <div className="mb-4 space-y-3">
                <CatLoader message={STAGE_LABELS[processingStage] || "Przetwarzanie..."} />
                <div className="space-y-1.5">
                  {(["cache", "ai", "categorizing"] as const).map((stage) => {
                    const stageOrder = ["cache", "uploading", "ai", "categorizing", "done"] as const;
                    const currentIdx = stageOrder.indexOf(processingStage);
                    const thisIdx = stageOrder.indexOf(stage);
                    const isActive = processingStage === stage;
                    const isDone = currentIdx > thisIdx;
                    return (
                      <div
                        key={stage}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                          isActive
                            ? "bg-[#fff1e4] text-[#cf833f] border border-[#f2d6bf]"
                            : isDone
                              ? "bg-[#ebf7ef] text-[#46825d] border border-[#8bc5a0]"
                              : "bg-[#f8f1e8]/60 text-[#c4aa90] border border-transparent"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : isActive ? (
                          <span className="relative flex h-3.5 w-3.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#cf833f] opacity-40" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#cf833f]" />
                          </span>
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#d8ccba]" />
                        )}
                        <span>{STAGE_LABELS[stage]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <ButtonPrimary
              onClick={handleExtract}
              disabled={processing || !categories || currentStorageIds.length === 0}
              loading={processing}
              icon={processing ? <Bot className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            >
              {processing ? "Przetwarzanie AI..." : "Analizuj paragony/faktury"}
            </ButtonPrimary>

          </div>
        )}
      </AppCard>

      {items && (
        <div className="space-y-6">
          <AppCard padding="md">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <FormLabel>Krok 2</FormLabel>
                  <h3 className="mt-1 text-lg font-semibold text-[#2b180a]">
                    Sprawdź wynik OCR ({items.length} pozycji)
                  </h3>
                </div>

              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <FormLabel>Data paragonu</FormLabel>
                  <FormInput
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    inputSize="sm"
                  />
                </div>
                <div className="flex items-end">
                  <ButtonSecondary
                    variant="dashed"
                    onClick={() => { setItems(null); setReceiptSummaries([]); setOpenBulkMenuId(null); }}
                    icon={<RefreshCcw className="h-4 w-4" />}
                    className="h-[38px]"
                  >
                    Skanuj ponownie
                  </ButtonSecondary>
                </div>
              </div>
            </div>

            {expectedComparison && (
              expectedComparison.isMismatch ? (
                <AlertBanner variant="error" icon={<AlertTriangle />}>
                  Suma pozycji ({expectedComparison.sum.toFixed(2)}) nie zgadza się z sumą towarów ({expectedComparison.expected.toFixed(2)}).
                  {expectedComparison.diffValue > 0
                    ? ` Pozycje są wyższe o ${expectedComparison.diff.toFixed(2)} — najczęściej oznacza to brak uwzględnionych rabatów/promocji.`
                    : ` Pozycje są niższe o ${expectedComparison.diff.toFixed(2)} — możliwe, że brakuje jednej lub więcej pozycji.`}
                </AlertBanner>
              ) : (
                <AlertBanner variant="success" icon={<CheckCircle2 />}>
                  Suma pozycji ({expectedComparison.sum.toFixed(2)}) zgadza się z sumą towarów.
                </AlertBanner>
              )
            )}

            <div className="flex flex-col">
              {items.map((item, index) => {
                const selectedCat = categories?.find((c) => c._id === item.categoryId);
                const uncertainPrice = isAmountUncertain(item.amount);
                const amountNum = parseFloat((item.amount || "").replace(",", "."));
                const isDiscountRow = !isNaN(amountNum) && amountNum < 0;

                return (
                  <div
                    key={item.id}
                    className={`relative py-4 border-b border-[#ebd8c8]/60 last:border-0 ${openBulkMenuId === item.id ? "z-30" : "z-0"
                      }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="inline-flex h-8 items-center justify-center rounded-lg bg-[#f5e5cf]/60 px-2.5 text-xs font-bold text-[#8a7262]">
                          #{index + 1}
                        </span>
                        {(receiptSummaries.length > 1 || item.receiptIndex > 0) && (
                          <span className="inline-flex max-w-full items-center rounded-lg border border-[#c8d8ff] bg-[#eef4ff] px-2 py-1 text-[10px] font-bold text-[#3856a8]">
                            {item.receiptLabel || `Paragon ${item.receiptIndex + 1}`}
                          </span>
                        )}
                      </div>

                      <div className="relative z-20 flex shrink-0 items-center gap-2">
                        {items.length > 1 && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenBulkMenuId(openBulkMenuId === item.id ? null : item.id)}
                              disabled={!item.categoryId || !item.subcategoryId}
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#ead8c5] bg-[#fff8f2] px-2 text-[11px] font-bold text-[#8a7262] transition-colors hover:border-[#cf833f] hover:text-[#cf833f] disabled:opacity-40"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span className="hidden min-[360px]:inline">Akcje</span>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>

                            {openBulkMenuId === item.id && item.categoryId && item.subcategoryId && (
                              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-[#efd9c2] bg-[#fffaf4] p-1.5 shadow-[0_10px_24px_rgba(180,120,80,0.18)]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    applyCategoryToRemainingItems(item.id);
                                    setOpenBulkMenuId(null);
                                  }}
                                  className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#fff1e4]"
                                >
                                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#cf833f]" />
                                  <span>
                                    <span className="block text-[11px] font-bold text-[#6d4d38]">
                                      Przypisz do pozostałych
                                    </span>
                                    <span className="block text-[10px] font-medium leading-relaxed text-[#9c806c]">
                                      Skopiuj kategorię i podkategorię do reszty pozycji z tego skanu.
                                    </span>
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <IconTrashButton
                          onClick={() => setPendingRemoveItemId(item.id)}
                          title="Usuń pozycję"
                          className="h-8 w-8 shrink-0 self-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_6.8rem] gap-2">
                      <div>
                        <FormLabel className="mb-1">Opis</FormLabel>
                        <FormInput
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, { description: e.target.value })}
                          placeholder="Opis produktu"
                          inputSize="sm"
                        />
                      </div>

                      <div>
                        <FormLabel className="mb-1">Kwota</FormLabel>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                          className={`w-full rounded-xl border bg-white/60 px-3 py-2 text-sm font-bold text-right tabular-nums outline-none ${uncertainPrice
                            ? "border-[#f3a086] text-[#b74210] focus:border-[#d95d27]"
                            : isDiscountRow
                              ? "border-[#9bd1af] text-[#2c7a4b] focus:border-[#4f9a6e]"
                              : "border-[#f5e5cf] text-[#cf833f] focus:border-[#cf833f]"
                            }`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.fromMapping && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#8bc5a0] bg-[#ebf7ef] px-2 py-1 text-[10px] font-bold text-[#46825d]">
                          <Brain className="h-3 w-3" />
                          Z historii
                        </span>
                      )}
                      {uncertainPrice && (
                        <span className="rounded-lg border border-[#ffc2af] bg-[#ffe1d6] px-2 py-1 text-[10px] font-bold text-[#9a2b00]">
                          Niepewna cena
                        </span>
                      )}
                      {isDiscountRow && (
                        <span className="rounded-lg border border-[#9bd1af] bg-[#e8f6ed] px-2 py-1 text-[10px] font-bold text-[#2c7a4b]">
                          Rabat / opust
                        </span>
                      )}
                    </div>

                    {uncertainPrice && (
                      <p className="mt-2 rounded-xl border border-[#ffd4c4] bg-[#fff2ec] px-2 py-1 text-[10px] font-medium text-[#a94d22]">
                        OCR nie był pewny kwoty.
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <div>
                        <FormLabel className="mb-1">Kategoria</FormLabel>
                        <FormSelect
                          selectSize="sm"
                          value={item.categoryId || ""}
                          onChange={(e) =>
                            updateItem(item.id, {
                              categoryId: e.target.value as Id<"categories">,
                              subcategoryId: null,
                            })
                          }
                        >
                          <option value="" disabled>
                            Wybierz kategorię
                          </option>
                          {categories?.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </FormSelect>
                      </div>

                      <div>
                        <FormLabel className="mb-1">Podkategoria</FormLabel>
                        <FormSelect
                          selectSize="sm"
                          value={item.subcategoryId || ""}
                          onChange={(e) =>
                            updateItem(item.id, {
                              subcategoryId: e.target.value as Id<"subcategories">,
                            })
                          }
                          disabled={!item.categoryId}
                        >
                          <option value="" disabled>
                            Wybierz podkategorię
                          </option>
                          {selectedCat?.subcategories.map((s: any) => (
                            <option key={s._id} value={s._id}>
                              {s.name}
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#f2dfcb] p-4">
              <ButtonSecondary
                variant="dashed"
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
                icon={<Plus className="h-4 w-4" />}
              >
                Dodaj kolejną pozycję ręcznie
              </ButtonSecondary>
            </div>
          </AppCard>

          {multiReceiptDetected && (
            <AlertBanner variant="info">
              Wykryto wiele paragonów. Zapis nastąpi sekwencyjnie, paragon po paragonie.
            </AlertBanner>
          )}

          {receiptSummaries.length > 0 && (
            <div className="space-y-2">
              {receiptSummaries.map((receipt) => {
                const itemsSum = parseFloat((receipt.itemsTotal || "").replace(",", "."));
                const expected = parseFloat((receipt.totalAmount || "").replace(",", "."));
                const payable = parseFloat((receipt.payableAmount || "").replace(",", "."));
                const deposit = parseFloat((receipt.depositTotal || "").replace(",", "."));
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
                    <div className="flex items-start gap-2.5">
                      {isMismatch ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a94d22]" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#46825d]" />
                      )}
                      <p className={isMismatch
                        ? "text-[#a94d22] text-xs font-bold leading-relaxed"
                        : "text-[#46825d] text-xs font-bold leading-relaxed"
                      }>
                        {receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`}: suma pozycji ({formatAmount(itemsSum)}) vs suma towarów ({formatAmount(expected)}).
                        {payable > 0 && (
                          <>
                            <br />
                            Kwota do zapłaty: {formatAmount(payable)}
                            {deposit > 0 ? `, w tym kaucja ${formatAmount(deposit)}` : ""}.
                          </>
                        )}
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
                  </div>
                );
              })}
            </div>
          )}

          <ButtonPrimary
            onClick={handleSaveAll}
            disabled={saving || items.length === 0}
            loading={saving}
            size="lg"
            icon={<Save className="h-4 w-4" />}
            className="mt-2"
          >
            {saving ? "Poczekaj..." : `Zapisz ${items.length} wydatków`}
          </ButtonPrimary>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemoveItemId)}
        title="Usunąć pozycję?"
        description="Ta pozycja nie zostanie zapisana jako wydatek."
        confirmLabel="Usuń"
        onCancel={() => setPendingRemoveItemId(null)}
        onConfirm={() => {
          if (!pendingRemoveItemId) return;
          removeItem(pendingRemoveItemId);
          setPendingRemoveItemId(null);
        }}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ScannerIcon } from "../ui/icons/ScannerIcon";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileText,
  Image,
  Plus,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { AppCard } from "../ui/AppCard";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { FormSelect } from "../ui/FormSelect";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ButtonSecondary } from "../ui/ButtonSecondary";
import { CatLoader } from "../ui/CatLoader";
import { FilterChip } from "../ui/FilterChip";
import { AlertBanner } from "../ui/AlertBanner";
import { Spinner } from "../ui/Spinner";
import { prepareOcrUploads } from "../../lib/ocrUpload";

interface Props {
  storageIds: Id<"_storage">[];
  mimeTypes?: string[];
  householdId: Id<"households">;
  tripTarget?: {
    type: "trip";
    tripId: Id<"trips">;
    tripName?: string;
  };
  onDone: () => void;
  onOpenReviewQueue?: () => void;
  onAddMoreImages?: (ids: Id<"_storage">[]) => void;
}

function isAmountUncertain(amount: string) {
  return !amount.trim();
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function formatDateSummary(iso: string) {
  const today = new Date().toISOString().split("T")[0];
  if (iso === today) return "Dziś";
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

interface ParsedItem {
  id: string;
  description: string;
  originalRawDescription?: string;
  amount: string;
  categoryId: Id<"categories"> | null;
  subcategoryId: Id<"subcategories"> | null;
  fromMapping?: boolean;
  categorySource?: "mapping" | "ai" | "heuristic" | "fallback" | "discount";
  initialDescription: string;
  initialCategoryId: Id<"categories"> | null;
  initialSubcategoryId: Id<"subcategories"> | null;
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
    categorySource?: "mapping" | "ai" | "heuristic" | "fallback" | "discount";
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
const OCR_CACHE_VERSION = "v6";
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
  const items = Array.isArray(result?.items) ? result.items : [];
  if (items.length === 0) return;

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

export function OcrScreen({ storageIds, mimeTypes, householdId, tripTarget, onDone, onOpenReviewQueue }: Props) {
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
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
  // Ustawienia zapisu sa zwiniete — poza wyjazdem, gdzie podzial kosztow trzeba potwierdzic.
  const [settingsOpen, setSettingsOpen] = useState(Boolean(tripTarget));
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [tripPaidByMemberId, setTripPaidByMemberId] = useState("");
  const [tripParticipantIds, setTripParticipantIds] = useState<string[]>([]);

  const processAI = useAction(api.ocr.processReceiptFastOrQueue);
  const processAIDirect = useAction(api.ocr.processReceiptWithAI);
  const discardReceiptUploads = useAction(api.ocr.discardReceiptUploads);
  const getFileUrl = useAction(api.ocr.getFileUrl);
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const tripDetails = useQuery(
    api.trips.getDetails,
    tripTarget ? { tripId: tripTarget.tripId } : "skip"
  ) as any | undefined;
  const createExpensesMany = useMutation(api.expenses.createMany);
  const createTripExpensesFromOcr = useMutation(api.trips.createExpensesFromOcr);
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);
  const upsertMappingsBatch = useMutation(api.productMappings.upsertMappingsBatch);
  const hasSavedRef = useRef(false);
  const isTripTarget = tripTarget?.type === "trip";

  useEffect(() => {
    if (!tripDetails) return;
    setTripPaidByMemberId((current) => current || String(tripDetails.myMemberId));
    setTripParticipantIds((current) =>
      current.length > 0 ? current : tripDetails.members.map((member: any) => String(member._id))
    );
  }, [tripDetails]);

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
          initialDescription: "Nieznany koszt",
          initialCategoryId: null,
          initialSubcategoryId: null,
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
      categorySource: row.categorySource,
      initialDescription: row.description || "Brak nazwy",
      initialCategoryId: row.categoryId || null,
      initialSubcategoryId: row.subcategoryId || null,
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
      // Reset pola, zeby ponowny wybor tego samego pliku znow odpalil onChange.
      e.target.value = "";
    }
  }

  async function handleDiscardAndDone() {
    if (!hasSavedRef.current && currentStorageIds.length > 0) {
      try {
        await discardReceiptUploads({ storageIds: currentStorageIds });
      } catch (err) {
        console.warn("OCR discard failed", err);
      }
    }

    onDone();
  }

  async function handleExtract() {
    if (!categories) {
      toast.error("Kategorie jeszcze się ładują. Spróbuj za chwilę.");
      return;
    }
    setProcessing(true);
    setQueuedNotice(null);
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
      const response = isTripTarget
        ? ({
            status: "ready" as const,
            result: await processAIDirect({
              storageIds: currentStorageIds,
              householdId,
              isPdf: false,
            }) as ProcessReceiptResult,
          })
        : (await processAI({
            storageIds: currentStorageIds,
            mimeTypes: currentMimeTypes,
            householdId,
            isPdf: false,
          })) as
            | { status: "ready"; result: ProcessReceiptResult }
            | { status: "queued"; pendingId: string; message: string };

      if (response.status === "queued") {
        hasSavedRef.current = true;
        setQueuedNotice(response.message);
        toast.info("Paragon przetwarza się w tle. Zachowaj papierowy paragon do czasu sprawdzenia wyniku.");
        return;
      }

      const result = response.result;

      setProcessingStage("categorizing");
      const resultHasMismatch = Array.isArray(result?.receiptSummaries)
        ? result.receiptSummaries.some((receipt) => receipt.mismatchType && receipt.mismatchType !== "ok")
        : false;
      if (!resultHasMismatch) {
        writeCachedOcrResult(cacheKey, result, now);
      }
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
          initialDescription: "Błąd AI",
          initialCategoryId: null,
          initialSubcategoryId: null,
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
      if (!isTripTarget && !item.categoryId) {
        toast.error(`Pozycja ${pos} ("${item.description}"): wybierz kategorię.`);
        return;
      }
      if (!isTripTarget && !item.subcategoryId) {
        toast.error(`Pozycja ${pos} ("${item.description}"): wybierz podkategorię.`);
        return;
      }
    }

    if (isTripTarget && (!tripTarget || !tripDetails || !tripPaidByMemberId || tripParticipantIds.length === 0)) {
      toast.error("Wybierz osobę płacącą i uczestników podziału.");
      return;
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

      const expenseItems: Array<{
        categoryId: Id<"categories">;
        subcategoryId: Id<"subcategories">;
        amount: number;
        date: number;
        description: string;
        receiptImageId?: Id<"_storage">;
        ocrRawText?: string;
      }> = [];
      const tripItems: Array<{
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

        const payloadItem = {
          amount: Math.round(amountNum * 100),
          date: new Date(date).getTime(),
          description: item.description,
          receiptImageId,
          ocrRawText: rawText,
        };

        if (isTripTarget) {
          tripItems.push(payloadItem);
        } else {
          expenseItems.push({
            ...payloadItem,
            categoryId: item.categoryId!,
            subcategoryId: item.subcategoryId!,
          });
        }

        successCount++;
      }

      if (isTripTarget && tripTarget) {
        await createTripExpensesFromOcr({
          tripId: tripTarget.tripId,
          paidByMemberId: tripPaidByMemberId as Id<"trip_members">,
          participantIds: tripParticipantIds as Id<"trip_members">[],
          items: tripItems,
        });
      } else {
        await createExpensesMany({
          householdId,
          items: expenseItems,
        });
      }

      const correctedMappingItems = sortedItems.filter((item) =>
        Boolean(item.originalRawDescription) &&
        Boolean(item.categoryId) &&
        Boolean(item.subcategoryId) &&
        (
          item.description.trim() !== item.initialDescription.trim() ||
          item.categoryId !== item.initialCategoryId ||
          item.subcategoryId !== item.initialSubcategoryId
        )
      );

      if (!isTripTarget) {
        await upsertMappingsBatch({
          householdId,
          items: correctedMappingItems
            .map((item) => ({
              rawDescription: item.originalRawDescription!,
              correctedDescription: item.description,
              categoryId: item.categoryId!,
              subcategoryId: item.subcategoryId!,
            })),
        });
      }

      hasSavedRef.current = true;
      const receiptLabel = processedReceipts > 1
        ? `${processedReceipts} paragonów`
        : "paragonu";
      if (isTripTarget) {
        toast.success(`Dopisano ${successCount} pozycji z ${receiptLabel} do wyjazdu.`);
      } else {
        toast.success(`Zapisano pomyślnie ${successCount} wydatków z ${receiptLabel}!`);
      }
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

  function toggleTripParticipant(memberId: string) {
    setTripParticipantIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  const itemsSum = items
    ? items.reduce((acc, curr) => {
      const val = parseFloat((curr.amount || "").replace(",", "."));
      return acc + (isNaN(val) ? 0 : val);
    }, 0)
    : 0;
  const needsAttention = (item: ParsedItem) =>
    isAmountUncertain(item.amount) || (!isTripTarget && (!item.categoryId || !item.subcategoryId));
  const attentionCount = items?.filter(needsAttention).length ?? 0;
  // Gdy uzytkownik poprawi ostatnia pozycje, filtr sam wraca do pelnej listy —
  // inaczej zostalby z pusta lista i bez widocznego przelacznika.
  const showOnlyIssues = onlyIssues && attentionCount > 0;
  const visibleItems = items ? (showOnlyIssues ? items.filter(needsAttention) : items) : [];
  const multiReceiptDetected = Boolean(items && (receiptSummaries.length > 1 || items.some((i) => i.receiptIndex > 0)));
  const expectedComparison = items && expectedTotal && receiptSummaries.length === 0
    ? (() => {
      const expected = parseFloat(expectedTotal.replace(",", "."));
      const diffValue = itemsSum - expected;
      const diff = Math.abs(diffValue);
      return {
        sum: itemsSum,
        expected,
        diffValue,
        diff,
        isMismatch: diff > 0.05,
      };
    })()
    : null;

  function resetToCapture() {
    setItems(null);
    setReceiptSummaries([]);
    setOpenBulkMenuId(null);
    setOnlyIssues(false);
  }

  const tileClass = (accent: string) =>
    `flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-3 transition-colors cursor-pointer ${currentStorageIds.length >= 3
      ? "border-orange-200 dark:border-white/10 opacity-40 cursor-not-allowed"
      : accent
    }`;

  return (
    <div className="space-y-4 pb-2">
      {/* Pasek kontekstu. Tytul ekranu jest juz w naglowku aplikacji, wiec go nie powtarzamy. */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleDiscardAndDone}
          className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-bold text-orange-900/70 transition-colors duration-700 hover:bg-white/60 hover:text-orange-950 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć
        </button>

        <div className="flex min-w-0 items-center gap-2">
          {isTripTarget && (
            <span className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-700 transition-colors duration-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tripTarget?.tripName || "Wyjazd"}</span>
            </span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-orange-200/60 bg-white/60 px-2.5 py-1.5 text-[11px] font-bold text-orange-900/60 transition-colors duration-700 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            <ScannerIcon className="h-3.5 w-3.5" />
            {items ? `${items.length} pozycji` : `${currentStorageIds.length}/3 plików`}
          </span>
        </div>
      </div>

      {!items ? (
        /* ── FAZA 1: zrodla + analiza ─────────────────────────────── */
        <>
          <AppCard padding="md" className="space-y-3">
            {previewUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previewUrls.map((url, i) => (
                  <div key={i} className="relative rounded-xl border border-white/60 bg-white/60 p-1.5 shadow-sm transition-colors duration-700 dark:border-white/10 dark:bg-white/5">
                    {url === "pdf" ? (
                      <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border-2 border-orange-200/50 bg-orange-50 shadow-sm transition-colors duration-700 dark:border-white/10 dark:bg-white/5">
                        <FileText className="h-6 w-6 text-orange-500 transition-colors duration-700 dark:text-indigo-400" />
                        <span className="text-[9px] font-bold text-orange-500 transition-colors duration-700 dark:text-indigo-400">PDF</span>
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={`Plik ${i + 1}`}
                        className="h-16 w-16 rounded-lg border-2 border-orange-200/50 object-cover shadow-sm transition-colors duration-700 dark:border-white/10"
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
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-200 bg-white text-xs text-red-500 shadow-sm dark:border-red-500/40 dark:bg-[#1a1a22] dark:text-red-400"
                      aria-label={`Usuń plik ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <label className={tileClass("border-emerald-500/40 bg-emerald-50/60 hover:bg-emerald-100/60 hover:border-emerald-500 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:hover:border-emerald-400")}>
                <ScannerIcon className="h-6 w-6 text-emerald-700 transition-colors duration-700 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 transition-colors duration-700 dark:text-emerald-400">
                  {uploading ? "Wysyłam..." : "Aparat"}
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

              <label className={tileClass("border-orange-300 dark:border-indigo-500/40 bg-white/40 dark:bg-white/5 hover:border-orange-400 dark:hover:border-indigo-400 hover:bg-orange-50/50 dark:hover:bg-indigo-500/10")}>
                <Image className="h-6 w-6 text-orange-900/60 transition-colors duration-700 dark:text-white/50" />
                <span className="text-xs font-bold text-orange-900/60 transition-colors duration-700 dark:text-white/50">
                  {uploading ? "Wysyłam..." : "Galeria"}
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

              <label className={tileClass("border-violet-300 dark:border-violet-500/40 bg-violet-50/60 dark:bg-violet-500/10 hover:border-violet-500 dark:hover:border-violet-400 hover:bg-violet-100/60 dark:hover:bg-violet-500/20")}>
                <FileText className="h-6 w-6 text-violet-700 transition-colors duration-700 dark:text-violet-400" />
                <span className="text-xs font-bold text-violet-700 transition-colors duration-700 dark:text-violet-400">
                  {uploading ? "Wysyłam..." : "PDF"}
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

            {currentStorageIds.length > 0 && currentStorageIds.length < 3 && (
              <p className="text-[11px] font-bold leading-relaxed text-orange-900/55 transition-colors duration-700 dark:text-white/45">
                Paragon nie zmieścił się w kadrze? Dodaj kolejne ujęcie — AI połączy je w jeden wynik.
              </p>
            )}

            {hasPdf && (
              <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition-colors duration-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400">
                <FileText className="h-4 w-4" />
                <span>PDF wykryty — AI wyciągnie tekst i pozycje automatycznie</span>
              </div>
            )}

            {uploading && <Spinner className="py-2" size="sm" />}
          </AppCard>

          {queuedNotice && (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition-colors duration-700 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 transition-colors duration-700 dark:text-emerald-400" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-900 transition-colors duration-700 dark:text-emerald-100">Paragon trafił do kolejki</p>
                  <p className="text-xs font-medium leading-relaxed text-emerald-800 transition-colors duration-700 dark:text-emerald-200">
                    {queuedNotice} Zachowaj papierowy paragon do czasu sprawdzenia wyniku.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ButtonSecondary onClick={onOpenReviewQueue ?? onDone} icon={<Search className="h-4 w-4" />}>
                  Otwórz kolejkę
                </ButtonSecondary>
                <ButtonSecondary onClick={onDone} icon={<CheckCircle2 className="h-4 w-4" />}>
                  Wróć do wydatków
                </ButtonSecondary>
              </div>
            </div>
          )}

          {processing && (
            <AppCard padding="md" className="space-y-3">
              <CatLoader message={STAGE_LABELS[processingStage] || "Przetwarzanie..."} />
              <div className="space-y-1.5">
                {(["cache", "ai", "categorizing"] as const).map((stage) => {
                  const stageOrder = ["cache", "uploading", "ai", "categorizing", "done"] as const;
                  const currentIdx = stageOrder.indexOf(processingStage as typeof stageOrder[number]);
                  const thisIdx = stageOrder.indexOf(stage);
                  const isActive = processingStage === stage;
                  const isDone = currentIdx > thisIdx;
                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-700 ${isActive
                        ? "bg-orange-100 dark:bg-indigo-500/20 text-orange-600 dark:text-indigo-400 border border-orange-200 dark:border-indigo-500/30"
                        : isDone
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                          : "bg-orange-50/60 dark:bg-white/5 text-orange-900/40 dark:text-white/40 border border-transparent"
                        }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : isActive ? (
                        <span className="relative flex h-3.5 w-3.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-600 opacity-40 transition-colors duration-700 dark:bg-indigo-400" />
                          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-orange-600 transition-colors duration-700 dark:bg-indigo-400" />
                        </span>
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-orange-200 transition-colors duration-700 dark:border-white/20" />
                      )}
                      <span>{STAGE_LABELS[stage]}</span>
                    </div>
                  );
                })}
              </div>
            </AppCard>
          )}

          {!queuedNotice && (
            <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#fcf8f2] via-[#fcf8f2] to-transparent px-3 pb-0 pt-3 transition-colors duration-700 dark:from-[#0a0a0a] dark:via-[#0a0a0a] sm:-mx-4 sm:px-4">
              <p className="mb-2 text-center text-[11px] font-bold text-orange-900/55 transition-colors duration-700 dark:text-white/45">
                {currentStorageIds.length === 0
                  ? "Dodaj zdjęcie lub PDF, aby uruchomić analizę"
                  : "AI odczyta pozycje, kwoty i podpowie kategorie"}
              </p>
              <ButtonPrimary
                onClick={handleExtract}
                disabled={processing || !categories || currentStorageIds.length === 0}
                loading={processing}
                size="lg"
                icon={processing ? <Bot className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              >
                {processing ? "Przetwarzanie AI..." : "Analizuj paragon"}
              </ButtonPrimary>
            </div>
          )}
        </>
      ) : (
        /* ── FAZA 2: weryfikacja wyniku ───────────────────────────── */
        <>
          {/* Werdykt na gorze: to on decyduje, czy w ogole trzeba czegos szukac w liscie. */}
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

          {receiptSummaries.length > 0 && (
            <div className="space-y-2">
              {receiptSummaries.map((receipt) => {
                const receiptItemsSum = parseFloat((receipt.itemsTotal || "").replace(",", "."));
                const expected = parseFloat((receipt.totalAmount || "").replace(",", "."));
                const payable = parseFloat((receipt.payableAmount || "").replace(",", "."));
                const deposit = parseFloat((receipt.depositTotal || "").replace(",", "."));
                const diffValue = parseFloat((receipt.difference || "0").replace(",", "."));
                const diff = Math.abs(diffValue);
                const isMismatch = receipt.mismatchType !== "ok" && expected > 0 && diff > 0.05;

                if (!(expected > 0)) {
                  return (
                    <AlertBanner key={receipt.receiptIndex} variant="info">
                      {receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`}: brak wykrytej sumy końcowej. Sprawdź pozycje ręcznie.
                    </AlertBanner>
                  );
                }

                return (
                  <div
                    key={receipt.receiptIndex}
                    className={isMismatch
                      ? "rounded-xl border border-red-200 bg-red-50 p-3 transition-colors duration-700 dark:border-red-500/30 dark:bg-red-500/10"
                      : "rounded-xl border border-emerald-200 bg-emerald-50 p-3 transition-colors duration-700 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      {isMismatch ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 transition-colors duration-700 dark:text-red-400" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 transition-colors duration-700 dark:text-emerald-400" />
                      )}
                      <p className={isMismatch
                        ? "text-xs font-bold leading-relaxed text-red-700 transition-colors duration-700 dark:text-red-400"
                        : "text-xs font-bold leading-relaxed text-emerald-700 transition-colors duration-700 dark:text-emerald-400"
                      }>
                        {receipt.receiptLabel || `Paragon ${receipt.receiptIndex + 1}`}: suma pozycji ({formatAmount(receiptItemsSum)}) vs suma towarów ({formatAmount(expected)}).
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

          {multiReceiptDetected && (
            <AlertBanner variant="info">
              Wykryto wiele paragonów. Zapis nastąpi sekwencyjnie, paragon po paragonie.
            </AlertBanner>
          )}

          {/* Ustawienia zapisu — zwiniete, bo domyslne wartosci sa zwykle poprawne. */}
          <div className="overflow-hidden rounded-[16px] border border-orange-200/60 bg-white/50 shadow-sm transition-colors duration-700 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 p-3.5 text-left outline-none"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-orange-700/70 dark:text-indigo-300/80" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-orange-950 transition-colors duration-700 dark:text-white">Ustawienia zapisu</p>
                  <p className="truncate text-[11px] font-bold text-orange-900/55 transition-colors duration-700 dark:text-white/45">
                    {formatDateSummary(date)} · {currentStorageIds.length} {currentStorageIds.length === 1 ? "plik" : "pliki"}
                    {isTripTarget ? ` · podział na ${tripParticipantIds.length} os.` : ""}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-orange-700 transition-transform duration-300 dark:text-indigo-300 ${settingsOpen ? "rotate-180" : ""}`} />
            </button>

            {settingsOpen && (
              <div className="space-y-3 border-t border-orange-200/60 p-3.5 dark:border-white/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
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
                      onClick={resetToCapture}
                      icon={<RefreshCcw className="h-4 w-4" />}
                      className="h-[38px] py-0"
                    >
                      Skanuj ponownie
                    </ButtonSecondary>
                  </div>
                </div>

                {isTripTarget && (
                  <div className="rounded-2xl border border-orange-200/60 bg-orange-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-600 dark:text-indigo-400" />
                      <p className="text-sm font-bold text-orange-950 dark:text-white">Dopisz do rachunku wyjazdu</p>
                    </div>
                    {!tripDetails ? (
                      <Spinner className="py-3" size="sm" />
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <FormLabel className="mb-1">Zapłacił(a)</FormLabel>
                          <FormSelect
                            selectSize="sm"
                            value={tripPaidByMemberId}
                            onChange={(event) => setTripPaidByMemberId(event.target.value)}
                          >
                            {tripDetails.members.map((member: any) => (
                              <option key={member._id} value={member._id}>
                                {member.displayName}
                              </option>
                            ))}
                          </FormSelect>
                        </div>
                        <div>
                          <FormLabel className="mb-2">Podziel pomiędzy</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {tripDetails.members.map((member: any) => {
                              const selected = tripParticipantIds.includes(String(member._id));
                              return (
                                <button
                                  key={member._id}
                                  type="button"
                                  onClick={() => toggleTripParticipant(String(member._id))}
                                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selected
                                    ? "bg-orange-500 text-white dark:bg-indigo-500"
                                    : "bg-white/70 text-orange-800 dark:bg-white/5 dark:text-white/55"
                                    }`}
                                >
                                  {member.displayName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {attentionCount > 0 && (
            <div className="flex items-center gap-2">
              <FilterChip
                label={`Wszystkie (${items.length})`}
                active={!showOnlyIssues}
                onClick={() => setOnlyIssues(false)}
              />
              <FilterChip
                label={`Do poprawy (${attentionCount})`}
                active={showOnlyIssues}
                onClick={() => setOnlyIssues(true)}
                icon={<AlertTriangle className="h-3 w-3" />}
              />
            </div>
          )}

          <AppCard padding="sm">
            <div className="flex flex-col">
              {visibleItems.map((item) => {
                const index = items.indexOf(item);
                const selectedCat = categories?.find((c) => c._id === item.categoryId);
                const uncertainPrice = isAmountUncertain(item.amount);
                const amountNum = parseFloat((item.amount || "").replace(",", "."));
                const isDiscountRow = !isNaN(amountNum) && amountNum < 0;

                return (
                  <div
                    key={item.id}
                    className={`relative border-b border-orange-200/60 py-3 transition-colors duration-700 last:border-0 dark:border-white/10 ${openBulkMenuId === item.id ? "z-30" : "z-0"}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="inline-flex h-7 items-center justify-center rounded-lg bg-orange-100/60 px-2 text-[11px] font-bold text-orange-900/60 transition-colors duration-700 dark:bg-white/10 dark:text-white/50">
                          #{index + 1}
                        </span>
                        {(receiptSummaries.length > 1 || item.receiptIndex > 0) && (
                          <span className="inline-flex max-w-full items-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition-colors duration-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                            {item.receiptLabel || `Paragon ${item.receiptIndex + 1}`}
                          </span>
                        )}
                        {item.fromMapping && (
                          <span
                            title="Dopasowane na podstawie Twoich wcześniejszych poprawek"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700 transition-colors duration-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                          >
                            <Brain className="h-3 w-3" />
                          </span>
                        )}
                        {isDiscountRow && (
                          <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 transition-colors duration-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                            Rabat
                          </span>
                        )}
                        {uncertainPrice && (
                          <span className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-800 transition-colors duration-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                            Sprawdź kwotę
                          </span>
                        )}
                      </div>

                      <div className="relative z-20 flex shrink-0 items-center gap-1">
                        {!isTripTarget && items.length > 1 && (
                          <div className="relative">
                            <button
                              type="button"
                              title="Przypisz tę kategorię do pozostałych pozycji"
                              onClick={() => setOpenBulkMenuId(openBulkMenuId === item.id ? null : item.id)}
                              disabled={!item.categoryId || !item.subcategoryId}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-900/60 transition-colors duration-700 hover:border-orange-500 hover:text-orange-500 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </button>

                            {openBulkMenuId === item.id && item.categoryId && item.subcategoryId && (
                              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-orange-200 bg-white p-1.5 shadow-xl transition-colors duration-700 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black">
                                <button
                                  type="button"
                                  onClick={() => {
                                    applyCategoryToRemainingItems(item.id);
                                    setOpenBulkMenuId(null);
                                  }}
                                  className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors duration-700 hover:bg-orange-50 dark:hover:bg-white/5"
                                >
                                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500 transition-colors duration-700 dark:text-indigo-400" />
                                  <span>
                                    <span className="block text-[11px] font-bold text-orange-900 transition-colors duration-700 dark:text-white/80">
                                      Przypisz do pozostałych
                                    </span>
                                    <span className="block text-[10px] font-medium leading-relaxed text-orange-900/50 transition-colors duration-700 dark:text-white/50">
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
                          className="h-8 w-8 shrink-0 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                      <FormInput
                        type="text"
                        aria-label={`Opis pozycji ${index + 1}`}
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Opis produktu"
                        inputSize="sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Kwota pozycji ${index + 1}`}
                        value={item.amount}
                        onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                        className={`w-full rounded-xl border bg-white/60 px-3 py-2 text-right text-sm font-bold tabular-nums outline-none transition-colors duration-700 dark:bg-white/5 ${uncertainPrice
                          ? "border-red-300 text-red-700 focus:border-red-500 dark:border-red-500/50 dark:text-red-400"
                          : isDiscountRow
                            ? "border-emerald-300 text-emerald-700 focus:border-emerald-500 dark:border-emerald-500/50 dark:text-emerald-400"
                            : "border-orange-200/50 text-orange-950 focus:border-orange-500 dark:border-white/10 dark:text-white dark:focus:border-indigo-400"
                          }`}
                        placeholder="0.00"
                      />
                    </div>

                    {!isTripTarget && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <FormSelect
                          selectSize="sm"
                          aria-label={`Kategoria pozycji ${index + 1}`}
                          className={!item.categoryId ? "!border-red-300 dark:!border-red-500/50" : ""}
                          value={item.categoryId || ""}
                          onChange={(e) =>
                            updateItem(item.id, {
                              categoryId: e.target.value as Id<"categories">,
                              subcategoryId: null,
                            })
                          }
                        >
                          <option value="" disabled>
                            Kategoria
                          </option>
                          {categories?.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </FormSelect>

                        <FormSelect
                          selectSize="sm"
                          aria-label={`Podkategoria pozycji ${index + 1}`}
                          className={item.categoryId && !item.subcategoryId ? "!border-red-300 dark:!border-red-500/50" : ""}
                          value={item.subcategoryId || ""}
                          onChange={(e) =>
                            updateItem(item.id, {
                              subcategoryId: e.target.value as Id<"subcategories">,
                            })
                          }
                          disabled={!item.categoryId}
                        >
                          <option value="" disabled>
                            Podkategoria
                          </option>
                          {selectedCat?.subcategories.map((s: any) => (
                            <option key={s._id} value={s._id}>
                              {s.name}
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleItems.length === 0 && (
                <p className="py-6 text-center text-xs font-bold text-orange-900/50 transition-colors duration-700 dark:text-white/40">
                  Brak pozycji — dodaj je ręcznie lub zeskanuj paragon ponownie.
                </p>
              )}
            </div>

            <ButtonSecondary
              variant="dashed"
              className="mt-3"
              onClick={() => {
                setOnlyIssues(false);
                setItems([
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    description: "",
                    amount: "",
                    categoryId: null,
                    subcategoryId: null,
                    initialDescription: "",
                    initialCategoryId: null,
                    initialSubcategoryId: null,
                    receiptIndex: 0,
                  },
                ]);
              }}
              icon={<Plus className="h-4 w-4" />}
            >
              Dodaj pozycję ręcznie
            </ButtonSecondary>
          </AppCard>

          {/* Zapis zawsze pod kciukiem — bez scrollowania na koniec listy. */}
          <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#fcf8f2] via-[#fcf8f2] to-transparent px-3 pb-0 pt-3 transition-colors duration-700 dark:from-[#0a0a0a] dark:via-[#0a0a0a] sm:-mx-4 sm:px-4">
            {attentionCount > 0 && (
              <p className="mb-2 text-center text-[11px] font-bold text-red-600 transition-colors duration-700 dark:text-red-400">
                {attentionCount} {attentionCount === 1 ? "pozycja wymaga" : "pozycje wymagają"} uzupełnienia
              </p>
            )}
            <ButtonPrimary
              onClick={handleSaveAll}
              disabled={saving || items.length === 0}
              loading={saving}
              size="lg"
              icon={<Save className="h-4 w-4" />}
            >
              {saving
                ? "Poczekaj..."
                : isTripTarget
                  ? `Dopisz ${items.length} poz. · ${itemsSum.toFixed(2)}`
                  : `Zapisz ${items.length} wydatków · ${itemsSum.toFixed(2)}`}
            </ButtonPrimary>
          </div>
        </>
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

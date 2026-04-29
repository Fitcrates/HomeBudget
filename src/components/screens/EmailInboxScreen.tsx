import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  FileImage,
  FileText,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";
import { AppCard } from "../ui/AppCard";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { FormSelect } from "../ui/FormSelect";
import { ButtonPrimary } from "../ui/ButtonPrimary";

interface Props {
  householdId: Id<"households">;
  currency: string;
  onBack?: () => void;
  hideHeader?: boolean;
}

interface ReviewItem {
  description: string;
  amount: number;
  amountInput?: string;
  categoryId: Id<"categories"> | null;
  subcategoryId: Id<"subcategories"> | null;
  confidence?: string;
  sourceStorageId?: Id<"_storage">;
}

export function EmailInboxScreen({ householdId, currency, onBack, hideHeader }: Props) {
  const pending = useQuery(api.pendingExpenses.listPending, { householdId });
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const approve = useMutation(api.pendingExpenses.approve);
  const reject = useMutation(api.pendingExpenses.reject);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<Record<string, ReviewItem[]>>({});
  const [reviewDates, setReviewDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function initReview(pendingId: string, items: any[]) {
    if (reviewItems[pendingId]) return;

    setReviewItems((prev) => ({
      ...prev,
      [pendingId]: items.map((item: any) => ({
        description: item.description,
        amount: item.amount,
        amountInput: amountToInput(item.amount),
        categoryId: item.categoryId || null,
        subcategoryId: item.subcategoryId || null,
        confidence: item.confidence,
        sourceStorageId: item.sourceStorageId,
      })),
    }));

    setReviewDates((prev) => ({
      ...prev,
      [pendingId]: new Date().toISOString().split("T")[0],
    }));
  }

  function updateReviewItem(pendingId: string, idx: number, updates: Partial<ReviewItem>) {
    setReviewItems((prev) => ({
      ...prev,
      [pendingId]: (prev[pendingId] ?? []).map((item, itemIndex) =>
        itemIndex === idx ? { ...item, ...updates } : item
      ),
    }));
  }

  function addReviewItem(pendingId: string) {
    setReviewItems((prev) => ({
      ...prev,
      [pendingId]: [
        ...(prev[pendingId] ?? []),
        {
          description: "",
          amount: 0,
          amountInput: "",
          categoryId: null,
          subcategoryId: null,
        },
      ],
    }));
  }

  function removeReviewItem(pendingId: string, idx: number) {
    setReviewItems((prev) => ({
      ...prev,
      [pendingId]: (prev[pendingId] ?? []).filter((_, itemIndex) => itemIndex !== idx),
    }));
  }

  function amountToInput(amount: number) {
    return amount !== 0 ? (amount / 100).toFixed(2) : "";
  }

  function parseAmountInput(value: string) {
    const parsed = Number.parseFloat(value.replace(/\s+/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  function downloadOcrDebugJson(item: any) {
    const fallbackPayload = {
      pendingId: item._id,
      sourceSummary: item.sourceSummary,
      scanStatus: item.scanStatus,
      scanError: item.scanError,
      ocrRawText: item.ocrRawText,
      items: item.items,
    };
    const content = item.ocrDebugJson || JSON.stringify(fallbackPayload, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocr-debug-${String(item._id)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleApprove(pendingId: Id<"pending_email_expenses">) {
    const items = reviewItems[pendingId];
    if (!items) return;

    const normalizedItems = items.map((item, index) => ({
      ...item,
      rowNumber: index + 1,
      parsedAmount: parseAmountInput(item.amountInput ?? amountToInput(item.amount)),
    }));

    const invalid = normalizedItems.find(
      (item) =>
        !item.description.trim() ||
        !item.categoryId ||
        !item.subcategoryId ||
        item.parsedAmount === 0
    );
    if (invalid) {
      const reason = !invalid.description.trim()
        ? "uzupelnij opis"
        : !invalid.categoryId
          ? "wybierz kategorie"
          : !invalid.subcategoryId
            ? "wybierz podkategorie"
            : "kwota musi byc rozna od 0";
      toast.error(`Pozycja #${invalid.rowNumber}: ${reason}.`);
      return;
    }

    setSaving(pendingId);
    try {
      const result = await approve({
        pendingId,
        items: normalizedItems.map((item) => ({
          description: item.description.trim(),
          amount: item.parsedAmount,
          categoryId: item.categoryId!,
          subcategoryId: item.subcategoryId!,
          sourceStorageId: item.sourceStorageId,
        })),
        date: new Date(reviewDates[pendingId] || new Date().toISOString().split("T")[0]).getTime(),
      });

      toast.success(
        result?.alreadyProcessed
          ? "Ten mail był już wcześniej przetworzony. Kolejka została odświeżona."
          : "Wydatki zostały zapisane."
      );
      setExpandedId(null);
    } catch (error: any) {
      toast.error(error.message || "Nie udało się zatwierdzić maila.");
    } finally {
      setSaving(null);
    }
  }

  async function handleReject(pendingId: Id<"pending_email_expenses">) {
    if (!confirm("Odrzucić ten mail i usunąć jego załączniki z kolejki?")) return;

    try {
      await reject({ pendingId });
      toast.success("Mail został odrzucony.");
      setExpandedId(null);
    } catch (error: any) {
      toast.error(error.message || "Nie udało się odrzucić maila.");
    }
  }


  return (
    <div className="space-y-5 pb-6">
      {!hideHeader && (
        <ScreenHeader
          icon={<Inbox />}
          title="Kolejka do sprawdzenia"
          subtitle="Rachunki wykryte z forwardowanych maili czekają tu na ostateczne zatwierdzenie."
          onBack={onBack}
        />
      )}

      {pending === undefined ? (
        <Spinner className="py-12" />
      ) : pending.length === 0 ? (
        <AppCard className="text-center py-10">
          <Mail className="mx-auto mb-4 h-14 w-14 text-[#b89b87]" />
          <p className="text-[#3e2815] font-bold mb-1">Nic tu jeszcze nie czeka</p>
          <p className="text-xs font-medium text-[#8a7262]">
            Zrób forward rachunku na adres gospodarstwa, a po chwili pojawi się tutaj do akceptacji.
          </p>
        </AppCard>
      ) : (
        <div className="space-y-4">
          {pending.map((item) => {
            const isExpanded = expandedId === item._id;
            const review = reviewItems[item._id];
            const isManualScan = item.sourceType === "manual_ocr";
            const isProcessing = item.scanStatus === "processing";
            const isFailed = item.scanStatus === "failed";
            const totalAmount = item.items.reduce((sum: number, row: any) => sum + row.amount, 0);

            return (
              <AppCard
                key={item._id}
                padding="none"
                className="overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full p-5 text-left"
                  onClick={() => {
                    if (!isExpanded) {
                      initReview(item._id, item.items);
                      setExpandedId(item._id);
                    } else {
                      setExpandedId(null);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <RefreshCw className="h-5 w-5 shrink-0 animate-spin text-[#c76823]" />
                        ) : isManualScan ? (
                          <FileImage className="h-5 w-5 shrink-0 text-[#c76823]" />
                        ) : (
                          <Mail className="h-5 w-5 shrink-0 text-[#c76823]" />
                        )}
                        <p className="truncate text-[15px] font-medium text-[#2b180a]">
                          {isManualScan ? "Skan paragonu" : item.emailSubject || "(bez tematu)"}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#8a7262]">
                        <span>{item.emailFrom}</span>
                        <span>→</span>
                        <span>{item.emailTo}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#fff2e2] px-2.5 py-1 text-[10px] font-bold text-[#b86a28]">
                          {item.detectedBy === "ocr" ? "OCR / załączniki" : item.detectedBy === "text" ? "Parser tekstu" : "Do sprawdzenia"}
                        </span>
                        <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[10px] font-bold text-[#3856a8]">
                          {item.attachmentNames.length} załącznik(i)
                        </span>
                        {isFailed && (
                          <span className="rounded-full bg-[#fff0f0] px-2.5 py-1 text-[10px] font-bold text-[#c84f4f]">
                            Do wpisania ręcznie
                          </span>
                        )}
                        <span className="rounded-full bg-[#f7f1ff] px-2.5 py-1 text-[10px] font-bold text-[#7b4bb3]">
                          {new Date(item.emailReceivedAt).toLocaleString("pl-PL")}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-medium text-[#cf833f]">
                        {isProcessing ? "W toku" : formatAmount(totalAmount, currency)}
                      </p>
                      <p className="text-[10px] font-bold text-[#b89b87]">{isProcessing ? "przetwarzanie" : `${item.items.length} pozycji`}</p>
                    </div>
                  </div>
                </button>

                {isExpanded && review && (
                  <div className="space-y-4 border-t border-[#ebd8c8]/50 px-5 pb-5 pt-4">
                    {item.sourceSummary && (
                      <div className="rounded-xl border border-[#dfead2] bg-[#f6fff1] p-3 text-[12px] font-medium text-[#4d6b3c]">
                        {item.sourceSummary}
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <FormLabel>Data zakupu</FormLabel>
                        <FormInput
                          type="date"
                          value={reviewDates[item._id] || ""}
                          onChange={(event) =>
                            setReviewDates((prev) => ({ ...prev, [item._id]: event.target.value }))
                          }
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadOcrDebugJson(item)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d8c4ff] bg-[#fbf8ff] px-4 text-sm font-bold text-[#6d44b8] transition-colors hover:bg-[#f4edff]"
                      >
                        <Download className="h-4 w-4" />
                        Pobierz JSON OCR
                      </button>
                    </div>

                    {item.storageUrls.length > 0 && (
                      <div>
                      <FormLabel>Załączniki</FormLabel>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {item.storageUrls.map((url: string | null, index: number) => (
                            <a
                              key={`${item._id}-${index}`}
                              href={url || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-xl border border-[#ead8c5] bg-[#fffaf4] px-3 py-3 text-sm font-bold text-[#6d4d38] transition-colors hover:border-[#cf833f] hover:text-[#cf833f]"
                            >
                              {item.attachmentNames[index]?.toLowerCase().endsWith(".pdf") ? (
                                <FileText className="h-4 w-4 shrink-0" />
                              ) : (
                                <FileImage className="h-4 w-4 shrink-0" />
                              )}
                              <span className="truncate">{item.attachmentNames[index] || `Załącznik ${index + 1}`}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-[#f2dfcb] bg-[#fffaf4]">
                      <div className="flex items-center justify-between gap-3 border-b border-[#f2dfcb] px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-[#2b180a]">Pozycje do zatwierdzenia</p>
                          <p className="text-[11px] font-medium text-[#8a7262]">Popraw nazwy, kwoty i kategorie przed zapisem.</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-[#cf833f]">
                            {formatAmount(review.reduce((sum, row) => sum + row.amount, 0), currency)}
                          </p>
                          <p className="text-[10px] font-bold text-[#b89b87]">{review.length} pozycji</p>
                        </div>
                      </div>

                      {review.map((reviewItem, index) => {
                        const selectedCategory = categories?.find((category) => category._id === reviewItem.categoryId);
                        const rowAmount = parseAmountInput(reviewItem.amountInput ?? amountToInput(reviewItem.amount));
                        const isDiscountRow = rowAmount < 0;
                        const needsReview =
                          reviewItem.confidence === "low" ||
                          !reviewItem.categoryId ||
                          !reviewItem.subcategoryId ||
                          rowAmount === 0;

                        return (
                          <div
                            key={`${item._id}-${index}`}
                            className="border-b border-[#ebd8c8]/60 px-4 py-4 last:border-0"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="inline-flex h-8 items-center justify-center rounded-lg bg-[#f5e5cf]/80 px-2.5 text-xs font-bold text-[#8a7262]">
                                  #{index + 1}
                                </span>
                                {isDiscountRow && (
                                  <span className="rounded-lg border border-[#9bd1af] bg-[#e8f6ed] px-2 py-1 text-[10px] font-bold text-[#2c7a4b]">
                                    Rabat / opust
                                  </span>
                                )}
                                {needsReview && (
                                  <span className="rounded-lg border border-[#f0c47f] bg-[#fff5df] px-2 py-1 text-[10px] font-bold text-[#a7651e]">
                                    Do sprawdzenia
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeReviewItem(item._id, index)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                aria-label="Usuń pozycję"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-[minmax(0,1fr)_6.8rem] gap-2">
                              <div>
                                <FormLabel className="mb-1">Opis</FormLabel>
                                <FormInput
                                  type="text"
                                  value={reviewItem.description}
                                  onChange={(event) =>
                                    updateReviewItem(item._id, index, { description: event.target.value })
                                  }
                                  placeholder="Opis produktu"
                                  inputSize="sm"
                                />
                              </div>

                              <div>
                                <FormLabel className="mb-1">Kwota</FormLabel>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={reviewItem.amountInput ?? amountToInput(reviewItem.amount)}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    updateReviewItem(item._id, index, {
                                      amountInput: nextValue,
                                      amount: parseAmountInput(nextValue),
                                    });
                                  }}
                                  onBlur={() =>
                                    updateReviewItem(item._id, index, {
                                      amountInput: amountToInput(reviewItem.amount),
                                    })
                                  }
                                  placeholder="0.00"
                                  className={`w-full rounded-xl border bg-white/60 px-3 py-2 text-right text-sm font-bold tabular-nums outline-none ${
                                    isDiscountRow
                                      ? "border-[#9bd1af] text-[#2c7a4b] focus:border-[#4f9a6e]"
                                      : "border-[#f5e5cf] text-[#cf833f] focus:border-[#cf833f]"
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <div>
                                <FormLabel className="mb-1">Kategoria</FormLabel>
                                <FormSelect
                                  selectSize="sm"
                                  value={reviewItem.categoryId || ""}
                                  onChange={(event) =>
                                    updateReviewItem(item._id, index, {
                                      categoryId: event.target.value as Id<"categories">,
                                      subcategoryId: null,
                                    })
                                  }
                                >
                                  <option value="" disabled>
                                    Wybierz kategorię
                                  </option>
                                  {categories?.map((category) => (
                                    <option key={category._id} value={category._id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </FormSelect>
                              </div>

                              <div>
                                <FormLabel className="mb-1">Podkategoria</FormLabel>
                                <FormSelect
                                  selectSize="sm"
                                  value={reviewItem.subcategoryId || ""}
                                  onChange={(event) =>
                                    updateReviewItem(item._id, index, {
                                      subcategoryId: event.target.value as Id<"subcategories">,
                                    })
                                  }
                                  disabled={!reviewItem.categoryId}
                                >
                                  <option value="" disabled>
                                    Wybierz podkategorię
                                  </option>
                                  {selectedCategory?.subcategories.map((subcategory: any) => (
                                    <option key={subcategory._id} value={subcategory._id}>
                                      {subcategory.name}
                                    </option>
                                  ))}
                                </FormSelect>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      <div className="border-t border-[#f2dfcb] p-4">
                        <button
                          type="button"
                          onClick={() => addReviewItem(item._id)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#cf833f]/60 bg-[#fffaf4] px-3 py-3 text-sm font-bold text-[#b86a28] transition-colors hover:bg-[#fff2e2]"
                        >
                          <Plus className="h-4 w-4" />
                          Dodaj kolejną pozycję ręcznie
                        </button>
                      </div>
                    </div>

                    {item.rawEmailText && (
                      <details className="group">
                        <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-[#b89b87] hover:text-[#8a7262]">
                          <FileText className="h-3 w-3" />
                          Pokaż treść maila
                        </summary>
                        <div className="mt-2 rounded-xl border border-[#ebd8c8] bg-[#fffdf9] p-3">
                          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[#6d4d38]">
                            {item.rawEmailText}
                          </p>
                        </div>
                      </details>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleReject(item._id)}
                        className="flex-1 rounded-xl border border-[#ffd2d2] bg-[#fffdf9] py-3 text-sm font-bold text-[#e65a5a] transition-colors hover:bg-[#ffeaea]"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <XCircle className="h-4 w-4" />
                          Odrzuć
                        </span>
                      </button>

                      <ButtonPrimary
                        onClick={() => handleApprove(item._id)}
                        disabled={saving === item._id || isProcessing || review.length === 0}
                        loading={saving === item._id}
                        icon={<CheckCircle className="h-4 w-4" />}
                        rounded="xl"
                        className="flex-[2]"
                      >
                        {saving === item._id ? "Zapisywanie..." : "Zatwierdź i zapisz"}
                      </ButtonPrimary>
                    </div>
                  </div>
                )}
              </AppCard>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-white/50 bg-white/30 p-4 text-[12px] font-medium leading-relaxed text-[#8a7262]">
        Najlepiej działają forwardowane PDF-y z tekstem oraz zdjęcia/skany rachunków. Jeśli parser czegoś nie odczyta
        idealnie, poprawiasz to tutaj przed zapisaniem do kosztów.
      </div>
    </div>
  );
}

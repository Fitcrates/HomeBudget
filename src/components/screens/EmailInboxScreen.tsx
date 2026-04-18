import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  FileImage,
  FileText,
  Inbox,
  Mail,
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
  onBack: () => void;
}

interface ReviewItem {
  description: string;
  amount: number;
  categoryId: Id<"categories"> | null;
  subcategoryId: Id<"subcategories"> | null;
  sourceStorageId?: Id<"_storage">;
}

export function EmailInboxScreen({ householdId, currency, onBack }: Props) {
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
        categoryId: item.categoryId || null,
        subcategoryId: item.subcategoryId || null,
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
      [pendingId]: prev[pendingId].map((item, itemIndex) =>
        itemIndex === idx ? { ...item, ...updates } : item
      ),
    }));
  }

  async function handleApprove(pendingId: Id<"pending_email_expenses">) {
    const items = reviewItems[pendingId];
    if (!items) return;

    const invalid = items.find((item) => !item.categoryId || !item.subcategoryId || item.amount <= 0);
    if (invalid) {
      toast.error("Uzupełnij kategorie i dodatnie kwoty dla wszystkich pozycji.");
      return;
    }

    setSaving(pendingId);
    try {
      await approve({
        pendingId,
        items: items.map((item) => ({
          description: item.description,
          amount: item.amount,
          categoryId: item.categoryId!,
          subcategoryId: item.subcategoryId!,
          sourceStorageId: item.sourceStorageId,
        })),
        date: new Date(reviewDates[pendingId] || new Date().toISOString().split("T")[0]).getTime(),
      });

      toast.success("Wydatki zostały zapisane.");
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
      <ScreenHeader
        icon={<Inbox />}
        title="Kolejka maili"
        subtitle="Rachunki wykryte z forwardowanych maili czekają tu na ostateczne zatwierdzenie."
        onBack={onBack}
      />

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
                        <Mail className="h-5 w-5 shrink-0 text-[#c76823]" />
                        <p className="truncate text-[15px] font-medium text-[#2b180a]">
                          {item.emailSubject || "(bez tematu)"}
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
                        <span className="rounded-full bg-[#f7f1ff] px-2.5 py-1 text-[10px] font-bold text-[#7b4bb3]">
                          {new Date(item.emailReceivedAt).toLocaleString("pl-PL")}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-base font-medium text-[#cf833f]">
                        {formatAmount(totalAmount, currency)}
                      </p>
                      <p className="text-[10px] font-bold text-[#b89b87]">{item.items.length} pozycji</p>
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

                    <div className="space-y-3">
                      {review.map((reviewItem, index) => {
                        const selectedCategory = categories?.find((category) => category._id === reviewItem.categoryId);

                        return (
                          <div
                            key={`${item._id}-${index}`}
                            className="space-y-2 rounded-xl border border-[#f5e5cf] bg-white p-3.5"
                          >
                            <div className="flex gap-2">
                              <FormInput
                                type="text"
                                value={reviewItem.description}
                                onChange={(event) =>
                                  updateReviewItem(item._id, index, { description: event.target.value })
                                }
                                placeholder="Opis"
                                inputSize="sm"
                              />

                              <div className="relative w-28">
                                <FormInput
                                  type="number"
                                  value={reviewItem.amount > 0 ? (reviewItem.amount / 100).toFixed(2) : ""}
                                  onChange={(event) => {
                                    const value = parseFloat(event.target.value);
                                    updateReviewItem(item._id, index, {
                                      amount: Number.isFinite(value) ? Math.round(value * 100) : 0,
                                    });
                                  }}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                  inputSize="sm"
                                  className="text-right text-[#cf833f]"
                                />
                                <span className="pointer-events-none absolute right-3 top-2 text-xs font-bold text-[#b89b87]">
                                  zł
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
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
                                  Kategoria...
                                </option>
                                {categories?.map((category) => (
                                  <option key={category._id} value={category._id}>
                                    {category.name}
                                  </option>
                                ))}
                              </FormSelect>

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
                                  Podkategoria...
                                </option>
                                {selectedCategory?.subcategories.map((subcategory: any) => (
                                  <option key={subcategory._id} value={subcategory._id}>
                                    {subcategory.name}
                                  </option>
                                ))}
                              </FormSelect>
                            </div>
                          </div>
                        );
                      })}
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
                        disabled={saving === item._id}
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

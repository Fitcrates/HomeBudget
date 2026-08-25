import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DynamicIcon } from "../ui/DynamicIcon";
import { toast } from "sonner";
import { ChevronDown, Paperclip, Repeat, SlidersHorizontal } from "lucide-react";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { Spinner } from "../ui/Spinner";
import { ScannerIcon } from "../ui/icons/ScannerIcon";
import { prepareOcrUploads } from "../../lib/ocrUpload";
import { TabBar } from "../ui/TabBar";
import { AppCard } from "../ui/AppCard";
import { EmailInboxScreen } from "./EmailInboxScreen";
import { Plus, Inbox } from "lucide-react";

interface Props {
  householdId: Id<"households">;
  currency: string;
  initialTab?: "fresh" | "queue";
  onSuccess: () => void;
  onOcrCapture: (storageIds: Id<"_storage">[], mimeTypes?: string[]) => void;
  prefillOcrText?: string;
  prefillAmount?: number;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function formatDateSummary(iso: string) {
  if (iso === todayIso()) return "Dziś";
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export function AddExpenseScreen({ householdId, currency, initialTab = "fresh", onSuccess, onOcrCapture, prefillOcrText, prefillAmount }: Props) {
  const [activeTab, setActiveTab] = useState<"fresh" | "queue">(initialTab);
  const [amount, setAmount] = useState(prefillAmount ? String(prefillAmount / 100) : "");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso);
  const [isSubscription, setIsSubscription] = useState(false);
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<Id<"subcategories"> | null>(null);
  // Otwarte na wejsciu: wybor kategorii to druga (po kwocie) decyzja uzytkownika,
  // wiec nie chowamy jej za dodatkowym tapnieciem. Zwija sie po wyborze podkategorii.
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const createExpense = useMutation(api.expenses.create);
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);

  const selectedCategory = categories?.find((c) => c._id === categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find((s: any) => s._id === subcategoryId);
  const hasAmount = Boolean(amount.trim()) && parseFloat(amount.replace(",", ".")) > 0;
  const hasCategory = Boolean(categoryId && subcategoryId);
  const missing = [!hasAmount && "kwotę", !hasCategory && "kategorię"].filter(Boolean) as string[];

  async function uploadFiles(files: File[]) {
    const uploadedStorageIds: Id<"_storage">[] = [];
    const preparedUploads = await prepareOcrUploads(files);
    const toUpload = preparedUploads.slice(0, 3);

    for (const item of toUpload) {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": item.type },
        body: item.blob,
      });
      const { storageId } = await res.json();
      uploadedStorageIds.push(storageId as Id<"_storage">);
    }

    return {
      storageIds: uploadedStorageIds,
      mimeTypes: toUpload.map((item) => item.type),
    };
  }

  async function handleOcrCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    if (files.length === 0) return;

    if ((e.target.files?.length ?? 0) > 3) {
      toast.warning("Maksymalnie 3 pliki na jedno skanowanie. Użyto pierwszych 3.");
    }

    setUploading(true);
    try {
      const { storageIds, mimeTypes } = await uploadFiles(files);
      onOcrCapture(storageIds, mimeTypes);
    } catch (err: any) {
      toast.error("Błąd przesyłania pliku");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !subcategoryId) {
      toast.error("Wybierz kategorię i podkategorię");
      setCategoriesOpen(true);
      return;
    }
    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Podaj prawidłową kwotę");
      return;
    }

    setSaving(true);
    try {
      await createExpense({
        householdId,
        categoryId,
        subcategoryId,
        amount: Math.round(amountNum * 100),
        date: new Date(date).getTime(),
        description,
        ocrRawText: prefillOcrText,
        isSubscription,
      });
      toast.success("Wydatek dodany!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const TABS = [
    { key: "fresh" as const, label: "Nowy Wydatek", icon: Plus },
    { key: "queue" as const, label: "Oczekujące", icon: Inbox },
  ];

  return (
    <div className="space-y-4 pb-2">
      <TabBar tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === "fresh" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Skrot do OCR: jedna linia zamiast calej sekcji "Dowod zakupu" */}
          <div className="flex items-center gap-2">
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-emerald-500/40 bg-emerald-50/70 py-3 text-[13px] font-bold text-emerald-700 shadow-sm transition-colors duration-700 hover:bg-emerald-100/70 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <ScannerIcon className="h-5 w-5" />
              <span>{uploading ? "Przesyłanie..." : "Zeskanuj paragon"}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handleOcrCapture}
                disabled={uploading}
              />
            </label>

            <label
              title="Wgraj zdjęcie lub PDF"
              className={`flex h-[46px] w-[46px] shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-orange-200/60 bg-white/70 text-orange-700 shadow-sm transition-colors duration-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10 ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleOcrCapture}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Kwota — najwazniejsze pole, od razu w polu widzenia */}
          <AppCard padding="md">
            <FormLabel>Kwota</FormLabel>
            <div className="relative flex items-center">
              <FormInput
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputSize="lg"
                className="text-3xl"
                required
              />
              <span className="absolute right-4 text-xl font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                {currency || "PLN"}
              </span>
            </div>
          </AppCard>

          {/* Kategoria */}
          <div className="overflow-hidden rounded-[16px] border border-orange-200/60 bg-white/50 shadow-sm transition-colors duration-700 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setCategoriesOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 p-3.5 text-left outline-none"
            >
              <div className="min-w-0">
                <FormLabel className="mb-1">Kategoria</FormLabel>
                <p className={`truncate text-sm font-bold transition-colors duration-700 ${selectedCategory ? "text-orange-950 dark:text-white" : "text-orange-900/55 dark:text-white/45"}`}>
                  {selectedCategory
                    ? `${selectedCategory.name}${selectedSubcategory ? ` / ${selectedSubcategory.name}` : ""}`
                    : "Wybierz kategorię i podkategorię"}
                </p>
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-orange-700 transition-transform duration-300 dark:text-indigo-300 ${categoriesOpen ? "rotate-180" : ""}`} />
            </button>

            {categoriesOpen && (
              <div className="border-t border-orange-200/60 p-3 dark:border-white/10">
                {categories === undefined ? (
                  <Spinner className="py-6" />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {categories.map((cat) => {
                      const isOpen = categoryId === cat._id;
                      return (
                        <div
                          key={cat._id}
                          className={`overflow-hidden rounded-[16px] border transition-all duration-700 ${isOpen
                            ? "border-orange-400/30 bg-white/80 shadow-sm dark:border-indigo-500/30 dark:bg-white/10"
                            : "border-white/60 bg-white/40 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryId(isOpen ? null : cat._id);
                              setSubcategoryId(null);
                            }}
                            className="flex w-full items-center justify-between p-3.5 outline-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`rounded-[16px] p-2 transition-colors duration-700 ${isOpen ? "bg-orange-100 text-orange-600 dark:bg-indigo-500/20 dark:text-indigo-400" : "text-orange-900/60 dark:text-white/50"}`}>
                                <DynamicIcon name={cat.icon} className="h-5 w-5 drop-shadow-sm" />
                              </div>
                              <span className={`text-[14px] font-bold transition-colors duration-700 ${isOpen ? "text-orange-950 dark:text-white" : "text-orange-900 dark:text-white/80"}`}>
                                {cat.name}
                              </span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-orange-900/40 transition-transform duration-300 dark:text-white/40 ${isOpen ? "rotate-180" : ""}`} />
                          </button>

                          {isOpen && (
                            <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1 animate-in fade-in slide-in-from-top-2">
                              {cat.subcategories.map((sub) => (
                                <button
                                  key={sub._id}
                                  type="button"
                                  onClick={() => {
                                    setSubcategoryId(sub._id);
                                    setCategoriesOpen(false);
                                  }}
                                  className={`flex min-h-[76px] flex-col items-center gap-1.5 rounded-[12px] p-2.5 outline-none transition-all duration-300 ${subcategoryId === sub._id
                                    ? "scale-[1.02] border border-orange-400 bg-orange-100/50 shadow-inner dark:border-indigo-500 dark:bg-indigo-500/20"
                                    : "shadow-sm hover:bg-orange-50/50 dark:hover:bg-white/5"
                                    }`}
                                >
                                  <DynamicIcon name={sub.icon} className={`h-6 w-6 opacity-90 drop-shadow-sm transition-colors duration-700 ${subcategoryId === sub._id ? "text-orange-600 dark:text-indigo-400" : "text-orange-500 dark:text-white/80"}`} />
                                  <div className={`line-clamp-2 text-center text-[10px] font-bold leading-tight transition-colors duration-700 ${subcategoryId === sub._id ? "text-orange-900 dark:text-indigo-200" : "text-orange-900/60 dark:text-white/60"}`}>
                                    {sub.name}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Szczegoly (data, opis, subskrypcja) — rzadko zmieniane, wiec zwiniete */}
          <div className="overflow-hidden rounded-[16px] border border-orange-200/60 bg-white/50 shadow-sm transition-colors duration-700 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 p-3.5 text-left outline-none"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-orange-700/70 dark:text-indigo-300/80" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700">Szczegóły</p>
                  <p className="truncate text-[11px] font-bold text-orange-900/55 dark:text-white/45 transition-colors duration-700">
                    {formatDateSummary(date)}
                    {description.trim() ? ` · ${description.trim()}` : ""}
                    {isSubscription ? " · wydatek stały" : ""}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-orange-700 transition-transform duration-300 dark:text-indigo-300 ${detailsOpen ? "rotate-180" : ""}`} />
            </button>

            {detailsOpen && (
              <div className="space-y-3 border-t border-orange-200/60 p-3.5 dark:border-white/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel>Data</FormLabel>
                    <FormInput
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      inputSize="sm"
                      required
                    />
                  </div>
                  <div>
                    <FormLabel>Opis</FormLabel>
                    <FormInput
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Opcjonalnie"
                      inputSize="sm"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-orange-200/50 bg-white/50 p-3 shadow-sm transition-all duration-700 hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={isSubscription}
                    onChange={(e) => setIsSubscription(e.target.checked)}
                    className="h-5 w-5 rounded-md border-orange-400 bg-white text-orange-600 transition-all focus:ring-orange-500 dark:border-indigo-500 dark:bg-white/10 dark:text-indigo-500 dark:focus:ring-indigo-400"
                  />
                  <span className="flex items-center gap-1.5 text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700">
                    <Repeat className="h-4 w-4 text-orange-600 dark:text-indigo-400" />
                    Wydatek stały (subskrypcja, rachunek)
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* CTA zawsze w zasiegu kciuka — nie trzeba scrollowac na sam dol */}
          <div className="sticky bottom-0 z-20 -mx-3 bg-gradient-to-t from-[#fcf8f2] via-[#fcf8f2] to-transparent px-3 pb-1 pt-4 transition-colors duration-700 dark:from-[#0a0a0a] dark:via-[#0a0a0a] sm:-mx-4 sm:px-4">
            {missing.length > 0 && (
              <p className="mb-2 text-center text-[11px] font-bold text-orange-900/55 dark:text-white/45 transition-colors duration-700">
                Uzupełnij {missing.join(" i ")}, aby zapisać
              </p>
            )}
            <ButtonPrimary
              type="submit"
              loading={saving}
              disabled={!hasCategory || !hasAmount}
              size="lg"
            >
              {saving ? "Zapisywanie..." : "Dodaj wydatek"}
            </ButtonPrimary>
          </div>
        </form>
      ) : (
        <EmailInboxScreen
          householdId={householdId}
          currency={currency}
          hideHeader
        />
      )}
    </div>
  );
}

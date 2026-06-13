import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DynamicIcon } from "../ui/DynamicIcon";
import { toast } from "sonner";
import { DollarSign, CloudUpload, FileText, Image as ImageIcon } from "lucide-react";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";
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

export function AddExpenseScreen({ householdId, currency, initialTab = "fresh", onSuccess, onOcrCapture, prefillOcrText, prefillAmount }: Props) {
  const [activeTab, setActiveTab] = useState<"fresh" | "queue">(initialTab);
  const [amount, setAmount] = useState(prefillAmount ? String(prefillAmount / 100) : "");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubscription, setIsSubscription] = useState(false);
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<Id<"subcategories"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptStorageId, setReceiptStorageId] = useState<Id<"_storage"> | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const createExpense = useMutation(api.expenses.create);
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);

  const selectedCategory = categories?.find((c) => c._id === categoryId);

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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const { storageIds, mimeTypes } = await uploadFiles(files);
      onOcrCapture(storageIds, mimeTypes);
    } catch (err: any) {
      toast.error("Błąd przesyłania pliku");
    } finally {
      setUploading(false);
    }
  }

  async function handleOcrScan(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    if (files.length === 0) return;

    if ((e.target.files?.length ?? 0) > 3) {
      toast.warning("Maksymalnie 3 zdjęcia na jedno skanowanie. Użyto pierwszych 3.");
    }

    setUploading(true);
    try {
      const { storageIds, mimeTypes } = await uploadFiles(files);
      onOcrCapture(storageIds, mimeTypes);
    } catch (err: any) {
      toast.error("Błąd przesyłania pliku");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !subcategoryId) {
      toast.error("Wybierz kategorię i podkategorię");
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
        receiptImageId: receiptStorageId ?? undefined,
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
    <div className="space-y-6 pb-4">
      <ScreenHeader
        icon={activeTab === "fresh" ? <DollarSign /> : <Inbox />}
        title={activeTab === "fresh" ? "Dodaj wydatek" : "Kolejka do sprawdzenia"}
        subtitle={activeTab === "fresh" ? "Wprowadź szczegóły transakcji" : "Oczekujące faktury i maile"}
      />

      <TabBar tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === "fresh" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Receipt / Uploads (Moved to top) */}
          <AppCard className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 dark:from-indigo-500 dark:to-violet-600 p-2 rounded-xl text-white shadow-sm transition-colors duration-700">
                <CloudUpload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-orange-950 dark:text-white transition-colors duration-700">Dowód zakupu</h3>
                <p className="text-[11px] font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">Opcjonalne. AI samo wypełni formularz.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-orange-400/40 dark:border-indigo-500/40 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-sm rounded-[16px] cursor-pointer hover:border-orange-500 dark:hover:border-indigo-400 transition-all shadow-sm group duration-700">
                <div className="bg-orange-100 dark:bg-indigo-500/20 text-orange-600 dark:text-indigo-400 p-3 rounded-full group-hover:scale-110 transition-transform duration-700">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-[13px] font-bold text-orange-900 dark:text-white/80 group-hover:text-orange-600 dark:group-hover:text-indigo-400 transition-colors duration-700">Załącz plik</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>

              <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-emerald-500/40 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-500/10 hover:bg-emerald-100/60 dark:hover:bg-emerald-500/20 backdrop-blur-sm rounded-[16px] cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-400 transition-all shadow-sm group duration-700">
                <div className="bg-emerald-100 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 p-3 rounded-full group-hover:scale-110 transition-transform duration-700">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors duration-700">Skanuj OCR</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={handleOcrScan}
                  disabled={uploading}
                />
              </label>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-indigo-400 justify-center py-3 bg-orange-50 dark:bg-indigo-500/10 rounded-[16px] shadow-inner border border-orange-200 dark:border-indigo-500/30 transition-colors duration-700">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600 dark:border-indigo-400" />
                Przetwarzanie dokumentu...
              </div>
            )}
            {receiptPreview && (
              <div className="relative pt-2">
                <img src={receiptPreview} alt="Paragon" className="w-full rounded-[16px] object-cover max-h-48 border-[4px] border-white/50 dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-black/50 transition-colors duration-700" />
              </div>
            )}
          </AppCard>

          {/* Details Card (Amount, Date, Description, Checkbox) */}
          <AppCard className="space-y-4">
            {/* Amount */}
            <div>
              <FormLabel>Kwota</FormLabel>
              <div className="flex items-center gap-3 relative">
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
                <span className="absolute right-4 text-xl font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">PLN</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <FormLabel>Data</FormLabel>
                <FormInput
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <FormLabel>Opis</FormLabel>
                <FormInput
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Opcjonalnie"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 mt-2 cursor-pointer bg-white/50 dark:bg-white/5 p-3 rounded-[16px] border border-orange-200/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 transition-all shadow-sm duration-700">
              <input
                type="checkbox"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
                className="w-5 h-5 rounded-md border-orange-400 dark:border-indigo-500 text-orange-600 dark:text-indigo-500 focus:ring-orange-500 dark:focus:ring-indigo-400 transition-all bg-white dark:bg-white/10"
              />
              <span className="text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700">
                To jest wydatek stały (subskrypcja, rachunek)
              </span>
            </label>
          </AppCard>

          {/* Categories Accordion */}
          <AppCard className="space-y-3">
            <FormLabel>Kategoria i Podkategoria</FormLabel>
            {categories === undefined ? (
              <Spinner className="py-6" />
            ) : (
              <div className="flex flex-col gap-2.5">
                {categories.map((cat) => {
                  const isOpen = categoryId === cat._id;
                  return (
                    <div
                      key={cat._id}
                      className={`transition-all duration-700 rounded-[16px] border overflow-hidden ${isOpen
                          ? "bg-white/80 dark:bg-white/10 border-orange-400/30 dark:border-indigo-500/30 shadow-sm"
                          : "bg-white/40 dark:bg-white/5 border-white/60 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/10"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryId(isOpen ? null : cat._id);
                          setSubcategoryId(null); // Reset subcategory when toggling main
                        }}
                        className="w-full flex items-center justify-between p-3.5 outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-[16px] transition-colors duration-700 ${isOpen ? "bg-orange-100 dark:bg-indigo-500/20 text-orange-600 dark:text-indigo-400" : "text-orange-900/60 dark:text-white/50"}`}>
                            <DynamicIcon name={cat.icon} className="w-5 h-5 drop-shadow-sm" />
                          </div>
                          <span className={`text-[14px] font-bold transition-colors duration-700 ${isOpen ? "text-orange-950 dark:text-white" : "text-orange-900 dark:text-white/80"}`}>
                            {cat.name}
                          </span>
                        </div>
                        <svg
                          className={`w-5 h-5 transition-transform duration-300 ${isOpen ? "rotate-180 text-orange-600 dark:text-indigo-400" : "text-orange-900/40 dark:text-white/40"}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2">
                          {cat.subcategories.map((sub) => (
                            <button
                              key={sub._id}
                              type="button"
                              onClick={() => setSubcategoryId(sub._id)}
                              className={`p-2.5 rounded-[12px] flex flex-col items-center gap-1.5 transition-all duration-300 outline-none ${subcategoryId === sub._id
                                  ? "border border-orange-400 dark:border-indigo-500 bg-orange-100/50 dark:bg-indigo-500/20 shadow-inner scale-[1.02]"
                                  : "hover:bg-orange-50/50 dark:hover:bg-white/5 shadow-sm"
                                }`}
                            >
                              <DynamicIcon name={sub.icon} className={`w-6 h-6 opacity-90 drop-shadow-sm transition-colors duration-700 ${subcategoryId === sub._id ? "text-orange-600 dark:text-indigo-400" : "text-orange-500 dark:text-white/80"}`} />
                              <div className={`text-[10px] font-bold leading-tight text-center line-clamp-2 transition-colors duration-700 ${subcategoryId === sub._id ? "text-orange-900 dark:text-indigo-200" : "text-orange-900/60 dark:text-white/60"
                                }`}>
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
          </AppCard>

          {/* End of Form */}

          <ButtonPrimary
            type="submit"
            loading={saving}
            disabled={!categoryId || !subcategoryId || !amount}
            size="lg"
            className="mt-4"
          >
            {saving ? "Zapisywanie..." : "Dodaj wydatek"}
          </ButtonPrimary>
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

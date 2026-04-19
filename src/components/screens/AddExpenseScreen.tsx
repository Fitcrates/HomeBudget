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

interface Props {
  householdId: Id<"households">;
  onSuccess: () => void;
  onOcrCapture: (storageIds: Id<"_storage">[], mimeTypes?: string[]) => void;
  prefillOcrText?: string;
  prefillAmount?: number;
}

export function AddExpenseScreen({ householdId, onSuccess, onOcrCapture, prefillOcrText, prefillAmount }: Props) {
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



  return (
    <div className="space-y-6 pb-4">
      <ScreenHeader
        icon={<DollarSign />}
        title="Dodaj wydatek"
        subtitle="Wprowadź szczegóły transakcji"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Receipt / Uploads (Moved to top) */}
        <div className="app-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-gradient-to-br from-[#de9241] to-[#ca782a] p-2 rounded-xl text-white shadow-sm">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-medium text-[#2b180a]">Dowód zakupu</h3>
              <p className="text-[11px] font-bold text-[#8a7262]">Opcjonalne. AI samo wypełni formularz.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-[#de9241]/40 bg-white/60 hover:bg-white backdrop-blur-sm rounded-xl cursor-pointer hover:border-[#de9241] transition-all shadow-sm group">
              <div className="bg-[#fcf4e4] text-[#ca782a] p-3 rounded-full group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[13px] font-medium text-[#6d4d38] group-hover:text-[#ca782a] transition-colors">Załącz plik</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-[#4aad6f]/40 bg-[#f0fbf4]/60 hover:bg-[#ebf7ef] backdrop-blur-sm rounded-xl cursor-pointer hover:border-[#4aad6f] transition-all shadow-sm group">
              <div className="bg-[#dcfce7] text-[#4aad6f] p-3 rounded-full group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-[13px] font-medium text-[#4aad6f] group-hover:text-[#388e57] transition-colors">Skanuj OCR</span>
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
            <div className="flex items-center gap-2 text-sm font-medium text-[#ca782a] justify-center py-3 bg-[#fcf4e4] rounded-xl shadow-inner border border-[#de9241]/20">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ca782a]" />
              Przetwarzanie dokumentu...
            </div>
          )}
          {receiptPreview && (
            <div className="relative pt-2">
              <img src={receiptPreview} alt="Paragon" className="w-full rounded-xl object-cover max-h-48 border-[4px] border-white shadow-[0_4px_16px_rgba(0,0,0,0.1)]" />
            </div>
          )}
        </div>

        {/* Details Card (Amount, Date, Description, Checkbox) */}
        <div className="app-card space-y-3 space-y-4">
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
              <span className="absolute right-4 text-xl font-bold text-[#b89b87]">PLN</span>
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

          <label className="flex items-center gap-3 mt-2 cursor-pointer bg-white/50 p-3 rounded-xl border border-white/60 hover:bg-white/80 transition-all shadow-sm">
            <input
              type="checkbox"
              checked={isSubscription}
              onChange={(e) => setIsSubscription(e.target.checked)}
              className="w-5 h-5 rounded-md border-[#de9241] text-[#ca782a] focus:ring-[#ca782a] transition-all bg-white"
            />
            <span className="text-sm font-bold text-[#6d4d38]">
              To jest wydatek stały (subskrypcja, rachunek)
            </span>
          </label>
        </div>

        {/* Categories Accordion */}
        <div className="app-card space-y-3">
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
                    className={`transition-all rounded-xl border overflow-hidden ${
                      isOpen
                        ? "bg-white/80 border-[#de9241]/30 shadow-sm"
                        : "bg-white/40 border-white/60 hover:bg-white/60"
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
                        <div className={`p-2 rounded-xl ${isOpen ? "bg-[#fcf4e4] text-[#ca782a]" : " text-[#8a7262]"}`}>
                           <DynamicIcon name={cat.icon} className="w-5 h-5 drop-shadow-sm" />
                        </div>
                        <span className={`text-[14px] font-medium ${isOpen ? "text-[#2b180a]" : "text-[#6d4d38]"}`}>
                          {cat.name}
                        </span>
                      </div>
                      <svg 
                        className={`w-5 h-5 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#ca782a]" : "text-[#b89b87]"}`} 
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-2  animate-in fade-in slide-in-from-top-2">
                        {cat.subcategories.map((sub) => (
                          <button
                            key={sub._id}
                            type="button"
                            onClick={() => setSubcategoryId(sub._id)}
                            className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-all outline-none ${
                              subcategoryId === sub._id
                                ? "border border-orange-400 bg-orange-100/50 shadow-inner scale-[1.02]"
                                : " hover:bg-orange-50/50 shadow-sm"
                            }`}
                          >
                            <DynamicIcon name={sub.icon} className="w-6 h-6 text-[#ca782a] opacity-90 drop-shadow-sm" />
                            <div className={`text-[10px] font-bold leading-tight text-center line-clamp-2 ${
                              subcategoryId === sub._id ? "text-orange-900" : "text-[#8a7262]"
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
        </div>

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
    </div>
  );
}

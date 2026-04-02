import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DynamicIcon } from "../ui/DynamicIcon";
import { toast } from "sonner";
import { DollarSign, CloudUpload, FileText, Image as ImageIcon } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Set pdf.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const PDF_MIME = "application/pdf";

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
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<Id<"subcategories"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptStorageId, setReceiptStorageId] = useState<Id<"_storage"> | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useQuery(api.categories.listForHousehold, { householdId });
  const createExpense = useMutation(api.expenses.create);
  const generateUploadUrl = useMutation(api.expenses.generateUploadUrl);

  const selectedCategory = categories?.find((c) => c._id === categoryId);

  async function uploadFiles(files: File[]) {
    const uploadedStorageIds: Id<"_storage">[] = [];
    const mimeTypes: string[] = [];

    const processedBlobs: { blob: Blob; type: string }[] = [];
    for (const file of files) {
      if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = Math.min(3, pdf.numPages);

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

    const toUpload = processedBlobs.slice(0, 3);
    for (const item of toUpload) {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": item.type },
        body: item.blob,
      });
      const { storageId } = await res.json();
      uploadedStorageIds.push(storageId as Id<"_storage">);
      mimeTypes.push(item.type);
    }
    return { storageIds: uploadedStorageIds, mimeTypes };
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
      });
      toast.success("Wydatek dodany!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = "bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)] space-y-3";
  const labelStyle = "block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]";
  const inputStyle = "w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white transition-all text-[#2b180a] font-bold shadow-inner placeholder-[#e0c9b7]";

  return (
    <div className="space-y-6 pb-4">
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign className="w-8 h-8 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Dodaj wydatek</h2>
        </div>
        <p className="text-[#6d4d38] text-[15px] ml-1 font-bold drop-shadow-sm">Wprowadź szczegóły transakcji</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Receipt / Uploads (Moved to top) */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 w-full rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)] space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-gradient-to-br from-[#de9241] to-[#ca782a] p-2 rounded-xl text-white shadow-sm">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold text-[#2b180a]">Dowód zakupu</h3>
              <p className="text-[11px] font-bold text-[#8a7262]">Opcjonalne. AI samo wypełni formularz.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-[#de9241]/40 bg-white/60 hover:bg-white backdrop-blur-sm rounded-2xl cursor-pointer hover:border-[#de9241] transition-all shadow-sm group">
              <div className="bg-[#fcf4e4] text-[#ca782a] p-3 rounded-full group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[13px] font-extrabold text-[#6d4d38] group-hover:text-[#ca782a] transition-colors">Załącz plik</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            <label className="flex-1 flex flex-col items-center justify-center gap-3 py-6 px-2 border-2 border-dashed border-[#4aad6f]/40 bg-[#f0fbf4]/60 hover:bg-[#ebf7ef] backdrop-blur-sm rounded-2xl cursor-pointer hover:border-[#4aad6f] transition-all shadow-sm group">
              <div className="bg-[#dcfce7] text-[#4aad6f] p-3 rounded-full group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-[13px] font-extrabold text-[#4aad6f] group-hover:text-[#388e57] transition-colors">Skanuj OCR</span>
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
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#ca782a] justify-center py-3 bg-[#fcf4e4] rounded-xl shadow-inner border border-[#de9241]/20">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ca782a]" />
              Przetwarzanie dokumentu...
            </div>
          )}
          {receiptPreview && (
            <div className="relative pt-2">
              <img src={receiptPreview} alt="Paragon" className="w-full rounded-2xl object-cover max-h-48 border-[4px] border-white shadow-[0_4px_16px_rgba(0,0,0,0.1)]" />
            </div>
          )}
        </div>

        {/* Amount */}
        <div className={cardStyle}>
          <label className={labelStyle}>
            Kwota
          </label>
          <div className="flex items-center gap-3">


            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 text-4xl font-bold text-[#4a3b32] outline-none bg-transparent w-full placeholder-[#e0c9b7]"
              required
            />
            <span className="text-2xl font-bold text-[#b89b87]">zł</span>
          </div>
        </div>

        {/* Date & Description */}
        <div className={`${cardStyle} space-y-4`}>
          <div>
            <label className={labelStyle}>
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputStyle}
              required
            />
          </div>
          <div>
            <label className={labelStyle}>
              Opis (opcjonalnie)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="np. Zakupy w Biedronce"
              className={inputStyle}
            />
          </div>
        </div>

        {/* Category */}
        <div className={`${cardStyle} space-y-3`}>
          <label className={labelStyle}>
            Kategoria
          </label>
          {categories === undefined ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => { setCategoryId(cat._id); setSubcategoryId(null); }}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all outline-none ${categoryId === cat._id
                    ? "border border-orange-400 bg-orange-100/50 shadow-inner scale-105"
                    : "border border-white/60 bg-white/50 hover:bg-white/80 shadow-sm"
                    }`}
                >
                  <DynamicIcon name={cat.icon} className="w-8 h-8 text-[#ca782a] drop-shadow-sm" />
                  <div className={`text-[10px] font-bold leading-tight text-center line-clamp-2 ${categoryId === cat._id ? "text-orange-900" : "text-[#8a7262]"}`}>{cat.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subcategory */}
        {selectedCategory && (
          <div className={`${cardStyle} space-y-3 animate-in fade-in slide-in-from-top-4`}>
            <label className={labelStyle}>
              Podkategoria
            </label>
            <div className="grid grid-cols-3 gap-3">
              {selectedCategory.subcategories.map((sub) => (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => setSubcategoryId(sub._id)}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all outline-none ${subcategoryId === sub._id
                    ? "border border-orange-400 bg-orange-100/50 shadow-inner scale-105"
                    : "border border-white/60 bg-white/50 hover:bg-white/80 shadow-sm"
                    }`}
                >
                  <DynamicIcon name={sub.icon} className="w-8 h-8 text-[#ca782a] drop-shadow-sm" />
                  <div className={`text-[10px] font-bold leading-tight text-center line-clamp-2 ${subcategoryId === sub._id ? "text-orange-900" : "text-[#8a7262]"}`}>{sub.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* End of Form */}

        <button
          type="submit"
          disabled={saving || !categoryId || !subcategoryId || !amount}
          className="w-full py-4 bg-gradient-to-r from-[#e78b40] to-[#cb621e] text-white rounded-full font-bold text-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all shadow-[0_8px_20px_rgba(200,100,50,0.3)] mt-4 focus:outline-none"
        >
          {saving ? "Zapisywanie..." : "Dodaj wydatek"}
        </button>
      </form>
    </div>
  );
}

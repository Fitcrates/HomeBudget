import { useState } from "react";
import { useQuery, useMutation, useQuery as useQ } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount } from "../../lib/format";
import { toast } from "sonner";

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
      [pendingId]: items.map((i: any) => ({
        description: i.description,
        amount: i.amount,
        categoryId: (i.categoryId as Id<"categories">) || null,
        subcategoryId: (i.subcategoryId as Id<"subcategories">) || null,
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
      [pendingId]: prev[pendingId].map((item, i) =>
        i === idx ? { ...item, ...updates } : item
      ),
    }));
  }

  async function handleApprove(pendingId: Id<"pending_email_expenses">) {
    const items = reviewItems[pendingId];
    if (!items) return;

    const invalid = items.find((i) => !i.categoryId || !i.subcategoryId || i.amount <= 0);
    if (invalid) {
      toast.error("Uzupełnij kategorie i kwoty dla wszystkich pozycji.");
      return;
    }

    setSaving(pendingId);
    try {
      await approve({
        pendingId,
        items: items.map((i) => ({
          description: i.description,
          amount: i.amount,
          categoryId: i.categoryId!,
          subcategoryId: i.subcategoryId!,
        })),
        date: new Date(reviewDates[pendingId] || new Date().toISOString().split("T")[0]).getTime(),
      });
      toast.success("Wydatki zatwierdzone i zapisane!");
      setExpandedId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function handleReject(pendingId: Id<"pending_email_expenses">) {
    if (!confirm("Odrzucić ten email?")) return;
    try {
      await reject({ pendingId });
      toast.success("Email odrzucony.");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const cardClass = "bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";

  return (
    <div className="space-y-6 pb-6">
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onBack}
            className="text-2xl text-[#6d4d38] font-bold hover:text-[#2b180a] leading-none drop-shadow-sm"
          >
            ←
          </button>
          <span className="text-3xl drop-shadow-sm">📧</span>
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">
            Skrzynka e-mail
          </h2>
        </div>
        <p className="text-xs text-[#8a7262] font-semibold ml-10 mt-1">
          Wydatki wykryte z przesłanych maili — zatwierdź lub odrzuć
        </p>
      </div>

      {pending === undefined ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
        </div>
      ) : pending.length === 0 ? (
        <div className={`${cardClass} text-center py-10`}>
          <div className="text-5xl mb-4">📭</div>
          <p className="text-[#3e2815] font-bold mb-1">Brak oczekujących maili</p>
          <p className="text-xs text-[#b89b87] font-semibold">
            Prześlij maila z potwierdzeniem zakupu na swój adres, a pojawi się tutaj.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((p) => {
            const isExpanded = expandedId === p._id;
            const items = reviewItems[p._id];
            const totalAmount = p.items.reduce((s, i) => s + i.amount, 0);

            return (
              <div
                key={p._id}
                className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[24px] shadow-sm overflow-hidden"
              >
                {/* Header row */}
                <button
                  className="w-full p-5 text-left"
                  onClick={() => {
                    if (!isExpanded) {
                      initReview(p._id, p.items);
                      setExpandedId(p._id);
                    } else {
                      setExpandedId(null);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 drop-shadow-sm">
                        <span className="text-[22px]">📧</span>
                        <p className="text-[15px] font-extrabold text-[#2b180a] truncate">
                          {p.emailSubject || "(brak tematu)"}
                        </p>
                      </div>
                      <p className="text-[11px] text-[#8a7262] font-semibold truncate">
                        {p.emailFrom}
                      </p>
                      <p className="text-[10px] text-[#b89b87] font-semibold mt-0.5">
                        {new Date(p.emailReceivedAt).toLocaleString("pl-PL")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-[#cf833f]">
                        {formatAmount(totalAmount, currency)}
                      </p>
                      <p className="text-[10px] text-[#b89b87] font-semibold">
                        {p.items.length} pozycji
                      </p>
                    </div>
                  </div>
                </button>

                {/* Expanded review */}
                {isExpanded && items && (
                  <div className="px-5 pb-5 border-t border-[#ebd8c8]/50 pt-4 space-y-4">
                    {/* Date */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-1.5 ml-1">
                        Data zakupu
                      </label>
                      <input
                        type="date"
                        value={reviewDates[p._id] || ""}
                        onChange={(e) =>
                          setReviewDates((prev) => ({ ...prev, [p._id]: e.target.value }))
                        }
                        className="w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-4 py-2.5 outline-none focus:border-[#cf833f] focus:bg-white text-[#2b180a] font-bold shadow-inner transition-all"
                      />
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      {items.map((item, idx) => {
                        const selectedCat = categories?.find((c) => c._id === item.categoryId);
                        return (
                          <div
                            key={idx}
                            className="bg-white rounded-2xl p-3.5 border border-[#f5e5cf] space-y-2"
                          >
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  updateReviewItem(p._id, idx, { description: e.target.value })
                                }
                                className="flex-1 text-sm bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-3 py-2 outline-none focus:border-[#cf833f] focus:bg-white font-bold text-[#3e2815] shadow-inner transition-all"
                                placeholder="Opis"
                              />
                              <div className="relative w-28">
                                <input
                                  type="number"
                                  value={item.amount > 0 ? (item.amount / 100).toFixed(2) : ""}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    updateReviewItem(p._id, idx, {
                                      amount: isNaN(v) ? 0 : Math.round(v * 100),
                                    });
                                  }}
                                  className="w-full text-sm bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-3 py-2 outline-none focus:border-[#cf833f] focus:bg-white font-bold text-[#cf833f] text-right shadow-inner transition-all"
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-[#b89b87] pointer-events-none">
                                  zł
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="w-full text-xs bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-2 py-2.5 outline-none font-bold text-[#6d4d38] shadow-inner focus:bg-white transition-all"
                                value={item.categoryId || ""}
                                onChange={(e) =>
                                  updateReviewItem(p._id, idx, {
                                    categoryId: e.target.value as Id<"categories">,
                                    subcategoryId: null,
                                  })
                                }
                              >
                                  <option value="" disabled>
                                    Kategoria...
                                  </option>
                                  {categories?.map((c) => (
                                    <option key={c._id} value={c._id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>

                              <select
                                className="w-full text-xs bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-2 py-2.5 outline-none font-bold text-[#6d4d38] shadow-inner focus:bg-white transition-all"
                                value={item.subcategoryId || ""}
                                onChange={(e) =>
                                  updateReviewItem(p._id, idx, {
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

                    {/* Raw email preview */}
                    {p.rawEmailText && (
                      <details className="group">
                        <summary className="text-[11px] font-bold text-[#b89b87] cursor-pointer hover:text-[#8a7262] select-none">
                          📄 Pokaż treść maila
                        </summary>
                        <div className="mt-2 bg-[#fffdf9] rounded-xl p-3 border border-[#ebd8c8]">
                          <p className="text-[10px] text-[#6d4d38] font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                            {p.rawEmailText}
                          </p>
                        </div>
                      </details>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => handleReject(p._id)}
                        className="flex-1 py-3 text-sm text-[#e65a5a] font-bold bg-[#fffdf9] hover:bg-[#ffeaea] rounded-xl transition-colors border border-[#ffd2d2]"
                      >
                        ✕ Odrzuć
                      </button>
                      <button
                        onClick={() => handleApprove(p._id)}
                        disabled={saving === p._id}
                        className="flex-[2] py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-xl font-extrabold text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                      >
                        {saving === p._id ? "Zapisywanie..." : "✓ Zatwierdź i zapisz"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

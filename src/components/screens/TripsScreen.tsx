import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Check, ChevronLeft, Copy, Mail, Plane, Plus, Receipt, Share2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatAmount, formatDate } from "../../lib/format";
import { AppCard } from "../ui/AppCard";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ButtonSecondary } from "../ui/ButtonSecondary";
import { FormInput } from "../ui/FormInput";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Spinner } from "../ui/Spinner";

interface Props {
  householdId?: Id<"households">;
  householdCurrency: string;
  initialTripId?: Id<"trips">;
}

function tripInviteUrl(inviteCode: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("trip", inviteCode);
  return url.toString();
}

function memberName(members: any[], memberId: string) {
  return members.find((member) => String(member._id) === String(memberId))?.displayName ?? "Uczestnik";
}

export function TripsScreen({ householdId, householdCurrency, initialTripId }: Props) {
  const trips = useQuery(api.trips.listMine) as any[] | undefined;
  const categories = useQuery(
    api.categories.listForHousehold,
    householdId ? { householdId } : "skip"
  ) as any[] | undefined;
  const createTrip = useMutation(api.trips.create);
  const joinTrip = useMutation(api.trips.joinByCode);
  const [selectedTripId, setSelectedTripId] = useState<Id<"trips"> | null>(initialTripId ?? null);
  const [tripName, setTripName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreateTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!tripName.trim()) return;
    setBusy(true);
    try {
      const tripId = await createTrip({ name: tripName.trim(), currency: householdCurrency });
      setTripName("");
      setSelectedTripId(tripId);
      toast.success("Wyjazd został utworzony.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinTrip(event: React.FormEvent) {
    event.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const tripId = await joinTrip({ code: joinCode.trim() });
      setJoinCode("");
      setSelectedTripId(tripId);
      toast.success("Dołączono do wyjazdu.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (selectedTripId) {
    return (
      <TripDetails
        tripId={selectedTripId}
        householdId={householdId}
        categories={categories}
        onBack={() => setSelectedTripId(null)}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <ScreenHeader
        icon={<Plane className="h-9 w-9 text-orange-600 dark:text-indigo-400" strokeWidth={2.3} />}
        title="Wspólne wyjazdy"
      />

      <AppCard variant="highlight" className="space-y-3">
        <div>
          <p className="text-lg font-bold text-orange-950 dark:text-white">Rozliczajcie się bez arkusza</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-orange-900/60 dark:text-white/55">
            Dodaj osoby, wpisuj rachunki i od razu zobacz, kto komu powinien oddać.
          </p>
        </div>
        <form onSubmit={handleCreateTrip} className="space-y-3">
          <FormInput value={tripName} onChange={(event) => setTripName(event.target.value)} placeholder="Np. Majówka w Pradze" />
          <ButtonPrimary type="submit" loading={busy} icon={<Plus className="h-4 w-4" />}>
            Utwórz wyjazd
          </ButtonPrimary>
        </form>
      </AppCard>

      <AppCard padding="md" className="space-y-3">
        <p className="font-bold text-orange-950 dark:text-white">Masz kod zaproszenia?</p>
        <form onSubmit={handleJoinTrip} className="flex gap-2">
          <FormInput
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Kod wyjazdu"
            className="uppercase tracking-[0.18em]"
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-xl bg-orange-500 px-4 font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            Dołącz
          </button>
        </form>
      </AppCard>

      <div className="space-y-3">
        <h3 className="px-1 text-sm font-bold uppercase tracking-[0.14em] text-orange-900/50 dark:text-white/40">Twoje wyjazdy</h3>
        {trips === undefined ? (
          <Spinner className="py-10" />
        ) : trips.length === 0 ? (
          <AppCard padding="md" className="text-center">
            <Plane className="mx-auto mb-3 h-12 w-12 text-orange-900/20 dark:text-white/20" />
            <p className="text-sm font-bold text-orange-900/55 dark:text-white/50">Nie masz jeszcze żadnego wyjazdu.</p>
          </AppCard>
        ) : (
          trips.map((trip) => (
            <button key={trip._id} type="button" onClick={() => setSelectedTripId(trip._id)} className="block w-full text-left">
              <AppCard padding="md" variant="inner" className="flex items-center justify-between gap-4 transition-transform hover:scale-[1.01]">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-orange-950 dark:text-white">{trip.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-orange-900/50 dark:text-white/45">
                    <Users className="h-3.5 w-3.5" /> {trip.memberCount} uczestników
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  {trip.status === "active" ? "Aktywny" : "Zamknięty"}
                </span>
              </AppCard>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TripDetails({
  tripId,
  householdId,
  categories,
  onBack,
}: {
  tripId: Id<"trips">;
  householdId?: Id<"households">;
  categories: any[] | undefined;
  onBack: () => void;
}) {
  const details = useQuery(api.trips.getDetails, { tripId }) as any | undefined;
  const addGuest = useMutation(api.trips.addGuest);
  const createExpense = useMutation(api.trips.createExpense);
  const removeExpense = useMutation(api.trips.removeExpense);
  const exportMyShare = useMutation(api.trips.exportMyShare);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidByMemberId, setPaidByMemberId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const memberIdsKey = details?.members.map((member: any) => String(member._id)).join("|") ?? "";
  useEffect(() => {
    if (!details) return;
    setPaidByMemberId((current) => current || String(details.myMemberId));
    setParticipantIds((current) => (current.length > 0 ? current : details.members.map((member: any) => String(member._id))));
  }, [details?.myMemberId, memberIdsKey]);

  const selectedCategory = useMemo(
    () => categories?.find((category) => String(category._id) === categoryId),
    [categories, categoryId]
  );

  if (!details) return <Spinner className="py-20" />;
  const { trip, members, expenses, balances, settlements } = details;

  async function handleAddGuest(event: React.FormEvent) {
    event.preventDefault();
    if (!guestName.trim()) return;
    setBusy(true);
    try {
      await addGuest({ tripId, displayName: guestName.trim(), email: guestEmail.trim() || undefined });
      if (guestEmail.trim()) {
        const subject = encodeURIComponent(`Zaproszenie na wyjazd: ${trip.name}`);
        const body = encodeURIComponent(
          `Cześć!\n\nDołącz do rozliczenia wyjazdu „${trip.name}” w aplikacji Domowe Gniazdo.\n\n${tripInviteUrl(trip.inviteCode)}`
        );
        window.location.href = `mailto:${guestEmail.trim()}?subject=${subject}&body=${body}`;
      }
      setGuestName("");
      setGuestEmail("");
      toast.success("Uczestnik został dodany.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddExpense(event: React.FormEvent) {
    event.preventDefault();
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!description.trim() || !amountCents || !paidByMemberId || participantIds.length === 0) return;
    setBusy(true);
    try {
      await createExpense({
        tripId,
        paidByMemberId: paidByMemberId as Id<"trip_members">,
        participantIds: participantIds as Id<"trip_members">[],
        amount: amountCents,
        date: new Date(`${date}T12:00:00`).getTime(),
        description: description.trim(),
      });
      setDescription("");
      setAmount("");
      toast.success("Wydatek został podzielony.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!householdId) {
      toast.error("Najpierw utwórz domostwo, aby eksportować wydatki.");
      return;
    }
    if (!categoryId || !subcategoryId) {
      toast.error("Wybierz kategorię i podkategorię.");
      return;
    }
    setBusy(true);
    try {
      const exported = await exportMyShare({
        tripId,
        householdId,
        categoryId: categoryId as Id<"categories">,
        subcategoryId: subcategoryId as Id<"subcategories">,
      });
      toast.success(`Dodano ${formatAmount(exported, trip.currency)} do Twoich wydatków.`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(tripInviteUrl(trip.inviteCode));
      toast.success("Link zaproszenia został skopiowany.");
    } catch {
      toast.error("Nie udało się skopiować linku.");
    }
  }

  async function shareInviteLink() {
    const url = tripInviteUrl(trip.inviteCode);
    const shareData = {
      title: `Wyjazd: ${trip.name}`,
      text: `Dołącz do wspólnego rozliczenia wyjazdu „${trip.name}”.`,
      url,
    };

    if ("share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error: any) {
        if (error?.name === "AbortError") return;
      }
    }

    await copyInviteLink();
  }

  return (
    <div className="space-y-5 pb-8">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-orange-700 dark:text-indigo-300">
        <ChevronLeft className="h-4 w-4" /> Wszystkie wyjazdy
      </button>

      <AppCard variant="highlight" className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-orange-950 dark:text-white">{trip.name}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-900/45 dark:text-white/40">Kod: {trip.inviteCode}</p>
          </div>
          <Plane className="h-9 w-9 text-orange-500 dark:text-indigo-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-orange-900/50 dark:text-white/45">Łącznie wydano</p>
            <p className="mt-1 text-lg font-bold text-orange-950 dark:text-white">
              {formatAmount(expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0), trip.currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
            <p className="text-xs font-bold text-orange-900/50 dark:text-white/45">Twój udział</p>
            <p className="mt-1 text-lg font-bold text-orange-950 dark:text-white">{formatAmount(details.myShare, trip.currency)}</p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-orange-200/50 pt-3 dark:border-white/10">
          <ButtonPrimary type="button" onClick={shareInviteLink} icon={<Share2 className="h-4 w-4" />}>
            Udostępnij zaproszenie
          </ButtonPrimary>
          <button
            type="button"
            onClick={copyInviteLink}
            className="flex h-full min-w-12 items-center justify-center rounded-xl border border-orange-200/60 bg-white/70 text-orange-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10"
            aria-label="Kopiuj link zaproszenia"
            title="Kopiuj link"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </AppCard>

      <AppCard padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-600 dark:text-indigo-400" />
          <h3 className="font-bold text-orange-950 dark:text-white">Uczestnicy i salda</h3>
        </div>
        <div className="space-y-2">
          {members.map((member: any) => {
            const balance = balances.find((item: any) => String(item.memberId) === String(member._id));
            return (
              <div key={member._id} className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50/80 px-3 py-2.5 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-orange-950 dark:text-white">{member.displayName}</p>
                  <p className="text-[11px] font-bold text-orange-900/40 dark:text-white/35">
                    {member.userId ? "W aplikacji" : member.email ? "Zaproszenie wysłane" : "Gość"}
                  </p>
                </div>
                <span className={`text-sm font-bold ${(balance?.balance ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {(balance?.balance ?? 0) >= 0 ? "+" : ""}{formatAmount(balance?.balance ?? 0, trip.currency)}
                </span>
              </div>
            );
          })}
        </div>

        {details.myRole === "owner" && (
          <form onSubmit={handleAddGuest} className="space-y-2 border-t border-orange-200/50 pt-3 dark:border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <FormInput value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Imię" />
              <FormInput type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="E-mail (opcjonalnie)" />
            </div>
            <ButtonSecondary type="submit" icon={<UserPlus className="h-4 w-4" />} disabled={busy}>Dodaj lub zaproś osobę</ButtonSecondary>
          </form>
        )}
      </AppCard>

      <AppCard padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-orange-600 dark:text-indigo-400" />
          <h3 className="font-bold text-orange-950 dark:text-white">Dodaj wspólny wydatek</h3>
        </div>
        <form onSubmit={handleAddExpense} className="space-y-3">
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <FormInput value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Np. kolacja" />
            <FormInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Kwota" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={paidByMemberId} onChange={(event) => setPaidByMemberId(event.target.value)} className="rounded-xl border border-orange-200/60 bg-white/70 px-3 py-2 text-sm font-bold text-orange-950 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white">
              {members.map((member: any) => <option key={member._id} value={member._id}>{member.displayName} zapłacił(a)</option>)}
            </select>
            <FormInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-orange-900/50 dark:text-white/40">Podziel pomiędzy</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member: any) => {
                const selected = participantIds.includes(String(member._id));
                return (
                  <button key={member._id} type="button" onClick={() => toggleParticipant(String(member._id))} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${selected ? "bg-orange-500 text-white dark:bg-indigo-500" : "bg-orange-100 text-orange-800 dark:bg-white/5 dark:text-white/55"}`}>
                    {selected && <Check className="h-3.5 w-3.5" />} {member.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          <ButtonPrimary type="submit" loading={busy}>Podziel wydatek po równo</ButtonPrimary>
        </form>
      </AppCard>

      <AppCard padding="md" className="space-y-3">
        <h3 className="font-bold text-orange-950 dark:text-white">Kto komu oddaje</h3>
        {settlements.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Check className="h-4 w-4" /> Wszystkie rachunki są wyrównane.
          </div>
        ) : settlements.map((settlement: any, index: number) => (
          <div key={`${settlement.fromMemberId}-${settlement.toMemberId}-${index}`} className="rounded-2xl border border-orange-200/50 bg-white/60 px-3 py-3 text-sm dark:border-white/10 dark:bg-white/5">
            <span className="font-bold text-orange-950 dark:text-white">{memberName(members, settlement.fromMemberId)}</span>
            <span className="text-orange-900/50 dark:text-white/45"> oddaje </span>
            <span className="font-bold text-orange-950 dark:text-white">{memberName(members, settlement.toMemberId)}</span>
            <span className="float-right font-bold text-orange-600 dark:text-indigo-300">{formatAmount(settlement.amount, trip.currency)}</span>
          </div>
        ))}
      </AppCard>

      <AppCard padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-orange-600 dark:text-indigo-400" />
          <h3 className="font-bold text-orange-950 dark:text-white">Wydatki wyjazdu</h3>
        </div>
        {expenses.length === 0 ? (
          <p className="py-3 text-center text-sm font-bold text-orange-900/45 dark:text-white/40">Jeszcze nic tu nie ma.</p>
        ) : expenses.map((expense: any) => (
          <div key={expense._id} className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50/80 px-3 py-3 dark:bg-white/5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-orange-950 dark:text-white">{expense.description}</p>
              <p className="mt-0.5 text-[11px] font-bold text-orange-900/45 dark:text-white/40">
                {memberName(members, expense.paidByMemberId)} · {formatDate(expense.date)} · {expense.participantIds.length} os.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-sm font-bold text-orange-600 dark:text-indigo-300">{formatAmount(expense.amount, trip.currency)}</span>
              <button type="button" onClick={async () => {
                try { await removeExpense({ expenseId: expense._id }); toast.success("Wydatek usunięty."); }
                catch (error: any) { toast.error(error.message); }
              }} className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Usuń wydatek">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </AppCard>

      {householdId && <AppCard padding="md" variant="highlight" className="space-y-3">
        <div>
          <h3 className="font-bold text-orange-950 dark:text-white">Dodaj mój udział do budżetu domowego</h3>
          <p className="mt-1 text-xs font-medium text-orange-900/55 dark:text-white/45">
            Zapisz {formatAmount(details.myShare, trip.currency)} jako jeden osobisty wydatek. Ponowny eksport zaktualizuje kwotę.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} className="rounded-xl border border-orange-200/60 bg-white/70 px-3 py-2 text-sm font-bold text-orange-950 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white">
            <option value="">Kategoria</option>
            {categories?.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
          <select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!selectedCategory} className="rounded-xl border border-orange-200/60 bg-white/70 px-3 py-2 text-sm font-bold text-orange-950 outline-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white">
            <option value="">Podkategoria</option>
            {selectedCategory?.subcategories.map((subcategory: any) => <option key={subcategory._id} value={subcategory._id}>{subcategory.name}</option>)}
          </select>
        </div>
        <ButtonPrimary type="button" onClick={handleExport} loading={busy} icon={<Mail className="h-4 w-4" />}>
          {details.exportedAmount === null ? "Dodaj do wydatków" : "Zaktualizuj w wydatkach"}
        </ButtonPrimary>
      </AppCard>}
    </div>
  );
}

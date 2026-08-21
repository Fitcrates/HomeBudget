import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileSettingsScreen } from "./ProfileSettingsScreen";
import { BadgesScreen } from "./BadgesScreen";
import { BudgetSettingsScreen } from "./BudgetSettingsScreenV2";
import { EmailSetupCard } from "./EmailSetupCard";
import { FireIcon } from "../ui/icons/FireIcon";
import { AvatarMaleIcon } from "../ui/icons/AvatarMaleIcon";
import { AvatarFemaleIcon } from "../ui/icons/AvatarFemaleIcon";
import { AvatarGirlIcon } from "../ui/icons/AvatarGirlIcon";
import { Home, Award, User, Clipboard, RefreshCw, UserPlus, Target } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { TabBar } from "../ui/TabBar";
import { StatusBadge } from "../ui/StatusBadge";
import { AppCard } from "../ui/AppCard";
import { Spinner } from "../ui/Spinner";
import { ScreenHeader } from "../ui/ScreenHeader";
import { financialRoleLabel, financialRoleBadgeVariant } from "../../lib/financialRole";

interface Household {
  _id: Id<"households">;
  name: string;
  currency: string;
  inviteCode: string;
  role: "owner" | "member";
  financialRole?: "parent" | "partner" | "child";
}

interface Props {
  household: Household;
  households: Household[];
  onSwitchHousehold: (id: string) => void;
  onOpenInbox: () => void;
}

type Tab = "household" | "budget" | "badges" | "profile";

export function HouseholdScreen({ household, households, onSwitchHousehold, onOpenInbox }: Props) {
  const [tab, setTab] = useState<Tab>("household");
  const members = useQuery(api.households.getMembers, { householdId: household._id });
  const memberBudgetOverview = useQuery(api.analytics.memberBudgetOverview, { householdId: household._id });
  const myMembership = useQuery(api.households.getMyMembership, { householdId: household._id });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<Id<"users"> | null>(null);

  const inviteByEmail = useMutation(api.households.inviteByEmail);
  const removeMember = useMutation(api.households.removeMember);
  const regenerateCode = useMutation(api.households.regenerateInviteCode);
  const updateFinancialRole = useMutation(api.households.updateFinancialRole);
  const canManageFinancialRoles =
    myMembership?.role === "owner" || myMembership?.financialRole === "parent";
  const memberBudgetMap = new Map(
    (memberBudgetOverview ?? []).map((member) => [String(member.userId), member])
  );

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteByEmail({ householdId: household._id, email: inviteEmail.trim() });

      const subject = encodeURIComponent("Zaproszenie do Domowego Gniazda");
      const body = encodeURIComponent(
        `Cześć!\n\nDołącz do mojego gospodarstwa domowego w aplikacji Domowe Gniazdo.\n\nTwój kod zaproszenia: ${household.inviteCode}\n\nAplikacja: ${window.location.origin}`
      );
      window.location.href = `mailto:${inviteEmail.trim()}?subject=${subject}&body=${body}`;

      setInviteEmail("");
      toast.success("Otwarto klienta poczty z zaproszeniem.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(targetUserId: Id<"users">) {
    try {
      await removeMember({ householdId: household._id, targetUserId });
      toast.success("Członek został usunięty.");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleRegenerateCode() {
    try {
      const newCode = await regenerateCode({ householdId: household._id });
      toast.success("Wygenerowano nowy kod: " + newCode);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(household.inviteCode).then(() => toast.success("Skopiowano kod."));
  }

  function getFirstName(nameOrEmail?: string) {
    if (!nameOrEmail) return "Nieznany";
    const name = nameOrEmail.split("@")[0].split(" ")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function getAvatarColor(name: string) {
    const colors = [
      "bg-orange-300 dark:bg-orange-500/50",
      "bg-emerald-300 dark:bg-emerald-500/50",
      "bg-red-300 dark:bg-red-500/50",
      "bg-amber-200 dark:bg-amber-500/50",
      "bg-slate-300 dark:bg-slate-500/50"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function renderAvatarContent(name: string) {
    const n = name.toLowerCase();
    if (n.startsWith("a")) return <AvatarFemaleIcon className="w-14 h-14" />;
    if (n.startsWith("z") || n.startsWith("m")) return <AvatarGirlIcon className="w-14 h-14" />;
    return <AvatarMaleIcon className="w-14 h-14" />;
  }

  // financialRoleLabel + financialRoleBadgeVariant imported from lib/financialRole

  const HOUSEHOLD_TABS = [
    { key: "household" as const, label: "Dom", icon: Home },
    { key: "budget" as const, label: "Budżety", icon: Target },
    { key: "badges" as const, label: "Odznaki", icon: Award },
    { key: "profile" as const, label: "Profil", icon: User },
  ];

  async function handleFinancialRoleChange(
    targetUserId: Id<"users">,
    financialRole: "parent" | "partner" | "child"
  ) {
    try {
      await updateFinancialRole({
        householdId: household._id,
        targetUserId,
        financialRole,
      });
      toast.success("Rola finansowa została zaktualizowana.");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-0 pb-6">
      <div className="pt-2 pb-4">
        <ScreenHeader icon={<FireIcon className="w-9 h-9" />} title="Zarządzanie domem" />

        <TabBar tabs={HOUSEHOLD_TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "profile" && <ProfileSettingsScreen householdId={household._id} />}
      {tab === "badges" && <BadgesScreen householdId={household._id} />}
      {tab === "budget" && (
        <BudgetSettingsScreen householdId={household._id} currency={household.currency} onBack={() => setTab("household")} />
      )}

      {tab === "household" && (
        <div className="space-y-6">
          <AppCard padding="lg" className="!bg-orange-50 dark:!bg-white/5 flex flex-col items-center relative overflow-hidden w-full pb-8 transition-colors duration-700">
            <h3 className="text-[1.1rem] font-bold text-orange-950 dark:text-white mb-6 relative z-10 transition-colors duration-700">Nasze gniazdo</h3>

            <div className="w-full relative z-10 mb-8">
              {members === undefined ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 dark:border-indigo-400" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-x-4 gap-y-6 place-items-center">
                  {members.map((m) => {
                    const fullName = m.displayName || m.user?.name || m.user?.email;
                    const name = getFirstName(fullName);
                    const stats = memberBudgetMap.get(String(m.userId));
                    return (
                      <div key={m._id} className="w-[90px] flex flex-col items-center gap-2 group relative">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={name}
                            className="w-[72px] h-[72px] rounded-full object-cover shadow-sm border-[3px] border-white dark:border-neutral-900 ring-1 ring-orange-200 dark:ring-white/20 transition-colors duration-700"
                          />
                        ) : (
                          <div
                            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-sm border-[3px] border-white dark:border-neutral-900 ring-1 ring-orange-200 dark:ring-white/20 transition-colors duration-700 ${getAvatarColor(
                              name
                            )}`}
                          >
                            {renderAvatarContent(name)}
                          </div>
                        )}
                        <span
                          className="w-[86px] text-center truncate text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700"
                          title={name}
                        >
                          {name}
                        </span>
                        <StatusBadge variant={financialRoleBadgeVariant(m.financialRole)}>
                          {financialRoleLabel(m.financialRole)}
                        </StatusBadge>
                        {stats && (
                          <span className="text-[10px] font-bold text-orange-900/60 dark:text-white/50 text-center transition-colors duration-700">
                            {new Intl.NumberFormat("pl-PL", {
                              style: "currency",
                              currency: household.currency,
                              maximumFractionDigits: 0,
                            }).format(stats.monthlySpent / 100)}
                          </span>
                        )}

                        {household.role === "owner" && m.role !== "owner" && (
                          <IconTrashButton
                            onClick={() => setPendingRemoveUserId(m.userId)}
                            title="Usuń członka"
                            className="absolute -top-1 -right-1 h-7 w-7 rounded-full border border-red-200 dark:border-red-500/40 bg-white dark:bg-[#1a1a22] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                          />
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setShowCode(!showCode)}
                    className="w-[90px] flex flex-col items-center gap-2 outline-none group"
                  >
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-sm border border-dashed border-orange-200 dark:border-white/20 text-orange-900/40 dark:text-white/40 bg-transparent group-hover:border-orange-500 dark:group-hover:border-indigo-400 group-hover:text-orange-500 dark:group-hover:text-indigo-400 transition-colors duration-700">
                      <UserPlus className="w-8 h-8" />
                    </div>
                    <span className="w-[86px] text-center text-xs font-bold text-orange-900 dark:text-white/80 leading-tight transition-colors duration-700">
                      Zaproś członka
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative z-10 space-y-4 w-full flex flex-col items-center">
              <button
                onClick={() => setShowCode(!showCode)}
                className="w-[200px] py-3.5 bg-gradient-to-r from-orange-400 to-orange-600 dark:from-indigo-500 dark:to-violet-600 text-white rounded-full font-medium text-[15px] shadow-lg shadow-orange-500/20 dark:shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all outline-none duration-700"
              >
                {showCode ? "Ukryj" : "Zaproś"}
              </button>

              {showCode && (
                <div className="w-full bg-orange-100 dark:bg-white/5 p-4 rounded-[16px] flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-top-4 mt-2 border border-orange-200 dark:border-white/10 shadow-inner duration-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 font-mono text-xl font-bold tracking-widest text-orange-600 dark:text-indigo-400 text-center bg-white dark:bg-white/10 py-2 rounded-xl shadow-sm transition-colors duration-700">
                      {household.inviteCode}
                    </div>
                    <button
                      onClick={copyCode}
                      className="p-3 bg-white dark:bg-white/10 rounded-xl text-orange-950 dark:text-white transition-colors duration-700 shadow-sm font-bold border border-orange-200/50 dark:border-white/10"
                      title="Kopiuj"
                    >
                      <Clipboard className="w-5 h-5" />
                    </button>
                    {household.role === "owner" && (
                      <button
                        onClick={handleRegenerateCode}
                        className="p-3 bg-white dark:bg-white/10 rounded-xl text-orange-900/50 dark:text-white/50 transition-colors duration-700 shadow-sm font-bold border border-orange-200/50 dark:border-white/10"
                        title="Generuj nowy"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleInvite} className="flex gap-2 w-full mt-1">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="E-mail"
                      className="w-full min-w-0 text-sm bg-white dark:bg-white/5 border border-orange-200 dark:border-white/20 rounded-xl px-3 py-2 outline-none focus:border-orange-500 dark:focus:border-indigo-400 placeholder-orange-900/40 dark:placeholder-white/40 font-bold transition-colors duration-700"
                    />
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="px-4 py-2 bg-orange-500 dark:bg-indigo-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors duration-700 whitespace-nowrap shadow-sm"
                    >
                      Wyślij
                    </button>
                  </form>
                </div>
              )}
            </div>
          </AppCard>

          {members && memberBudgetOverview && (
            <AppCard padding="md" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-medium text-orange-950 dark:text-white transition-colors duration-700">Budżety per osoba</h3>
                  <p className="text-xs font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">Kto ile wydaje i kto przekracza limit</p>
                </div>
                <span className="rounded-full bg-orange-50 dark:bg-white/5 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-indigo-400 transition-colors duration-700">
                  Ten miesiąc
                </span>
              </div>

              <div className="space-y-3">
                {memberBudgetOverview.map((member) => (
                  <div
                    key={member.userId}
                    className="rounded-[16px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 shadow-sm transition-colors duration-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-orange-950 dark:text-white truncate transition-colors duration-700">{member.displayName}</p>
                          <StatusBadge variant={financialRoleBadgeVariant(member.financialRole)}>
                            {financialRoleLabel(member.financialRole)}
                          </StatusBadge>
                          {member.isOverBudget && (
                            <span className="px-2 py-0.5 rounded-full border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-[10px] font-bold text-red-800 dark:text-red-400 transition-colors duration-700">
                              Przekroczony limit
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                          Wydatki: {new Intl.NumberFormat("pl-PL", {
                            style: "currency",
                            currency: household.currency,
                          }).format(member.monthlySpent / 100)}
                        </p>
                      </div>

                      {member.personalBudget && member.personalBudgetSpent !== null ? (
                        <div className="text-right">
                          <p className="text-[11px] font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                            Limit {member.personalBudget.period === "month" ? "miesięczny" : "tygodniowy"}
                          </p>
                          <p className="text-sm font-bold text-orange-600 dark:text-indigo-400 transition-colors duration-700">
                            {new Intl.NumberFormat("pl-PL", {
                              style: "currency",
                              currency: household.currency,
                            }).format(member.personalBudget.limitAmount / 100)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">Brak limitu</p>
                      )}
                    </div>

                    {member.personalBudget && member.personalBudgetSpent !== null && (
                      <div className="mt-3 space-y-1.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100 dark:bg-white/10 transition-colors duration-700">
                          <div
                            className={`h-full rounded-full transition-colors duration-700 ${
                              member.isOverBudget
                                ? "bg-red-400"
                                : (member.personalBudgetPct ?? 0) >= 80
                                  ? "bg-yellow-400"
                                  : "bg-emerald-400 dark:bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(member.personalBudgetPct ?? 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                          <span>
                            Wydano {new Intl.NumberFormat("pl-PL", {
                              style: "currency",
                              currency: household.currency,
                            }).format((member.personalBudgetSpent ?? 0) / 100)}
                          </span>
                          <span>
                            {member.personalBudgetRemaining !== null && member.personalBudgetRemaining >= 0
                              ? `Zostało ${new Intl.NumberFormat("pl-PL", {
                                  style: "currency",
                                  currency: household.currency,
                                }).format(member.personalBudgetRemaining / 100)}`
                              : `Ponad limit o ${new Intl.NumberFormat("pl-PL", {
                                  style: "currency",
                                  currency: household.currency,
                                }).format(Math.abs(member.personalBudgetRemaining ?? 0) / 100)}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AppCard>
          )}

          {members && (
            <AppCard padding="md" className="space-y-4">
              <div>
                <h3 className="text-[16px] font-medium text-orange-950 dark:text-white transition-colors duration-700">Role finansowe</h3>
                <p className="text-xs font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                  Rodzic kontroluje, dziecko działa na limicie, partner współdzieli finanse.
                </p>
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member._id}
                    className="rounded-[16px] border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 p-3 shadow-sm transition-colors duration-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-orange-950 dark:text-white truncate transition-colors duration-700">{member.displayName}</p>
                        <p className="text-[11px] font-bold text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                          {member.role === "owner" ? "Właściciel gospodarstwa" : "Członek gospodarstwa"}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full border text-[11px] font-bold transition-colors duration-700 ${member.financialRole === 'parent' ? 'bg-orange-50 dark:bg-white/5 text-orange-600 dark:text-indigo-400 border-orange-200 dark:border-white/10' : member.financialRole === 'child' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'}`}>
                        {financialRoleLabel(member.financialRole)}
                      </span>
                    </div>

                    {member.role === "owner" ? (
                      <p className="mt-3 text-[11px] font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                        Właściciel zawsze ma rolę finansową rodzica.
                      </p>
                    ) : canManageFinancialRoles ? (
                      <div className="mt-3 flex gap-2">
                        {(["parent", "partner", "child"] as const).map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleFinancialRoleChange(member.userId, role)}
                            className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all duration-700 ${
                              member.financialRole === role
                                ? `${financialRoleBadgeVariant(role)} shadow-sm`
                                : "border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 text-orange-900/60 dark:text-white/50 hover:border-orange-500 dark:hover:border-indigo-400 hover:text-orange-500 dark:hover:text-indigo-400"
                            }`}
                          >
                            {financialRoleLabel(role)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] font-bold text-orange-900/40 dark:text-white/40 transition-colors duration-700">
                        Tylko właściciel lub rodzic może zmieniać role finansowe.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </AppCard>
          )}

          <div className="pt-2">
            <h3 className="text-sm font-bold text-orange-950 dark:text-white mb-4 ml-1 transition-colors duration-700">Wybierz gospodarstwo</h3>
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {households.map((h) => (
                <button
                  key={h._id}
                  onClick={() => onSwitchHousehold(h._id)}
                  className={`whitespace-nowrap px-5 py-2 rounded-full font-medium text-[13px] transition-all focus:outline-none shadow-sm duration-700 ${
                    household._id === h._id
                      ? "bg-orange-500 dark:bg-indigo-500 text-white shadow-orange-500/30 dark:shadow-indigo-500/30"
                      : "bg-orange-50 dark:bg-white/5 text-orange-900 dark:text-white/80 hover:bg-white dark:hover:bg-white/10 border-transparent"
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <EmailSetupCard
            householdId={household._id}
            onOpenInbox={onOpenInbox}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemoveUserId)}
        title="Usunąć członka?"
        description="Ta osoba utraci dostęp do tego gospodarstwa."
        confirmLabel="Usuń"
        onCancel={() => setPendingRemoveUserId(null)}
        onConfirm={() => {
          if (!pendingRemoveUserId) return;
          void handleRemove(pendingRemoveUserId);
          setPendingRemoveUserId(null);
        }}
      />
    </div>
  );
}

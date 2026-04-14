import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileSettingsScreen } from "./ProfileSettingsScreen";
import { BadgesScreen } from "./BadgesScreen";
import { BudgetSettingsScreen } from "./BudgetSettingsScreen";
import { EmailSetupCard } from "./EmailSetupCard";
import { FireIcon } from "../ui/icons/FireIcon";
import { AvatarMaleIcon } from "../ui/icons/AvatarMaleIcon";
import { AvatarFemaleIcon } from "../ui/icons/AvatarFemaleIcon";
import { AvatarGirlIcon } from "../ui/icons/AvatarGirlIcon";
import { Home, Award, User, Clipboard, RefreshCw, UserPlus, Target } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";

interface Household {
  _id: Id<"households">;
  name: string;
  currency: string;
  inviteCode: string;
  role: "owner" | "member";
}

interface Props {
  household: Household;
  households: Household[];
  onSwitchHousehold: (id: string) => void;
}

type Tab = "household" | "budget" | "badges" | "profile";

export function HouseholdScreen({ household, households, onSwitchHousehold }: Props) {
  const [tab, setTab] = useState<Tab>("household");
  const members = useQuery(api.households.getMembers, { householdId: household._id });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<Id<"users"> | null>(null);

  const inviteByEmail = useMutation(api.households.inviteByEmail);
  const removeMember = useMutation(api.households.removeMember);
  const regenerateCode = useMutation(api.households.regenerateInviteCode);

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
    const colors = ["bg-[#eebd9b]", "bg-[#b1c3ab]", "bg-[#dfa591]", "bg-[#e5d0a1]", "bg-[#b1b9c3]"];
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

  return (
    <div className="space-y-0 pb-6">
      <div className="pt-2 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <FireIcon className="w-9 h-9 text-[#c76823]" />
          <h2 className="text-[26px] font-medium tracking-tight text-[#2b180a]">Zarządzanie domem</h2>
        </div>

        <div className="flex bg-[#fdf9f1] rounded-xl p-1 shadow-[0_4px_12px_rgba(180,120,80,0.1)] gap-1">
          {(
            [
              { key: "household", label: "Dom", icon: Home },
              { key: "budget", label: "Budżety", icon: Target },
              { key: "badges", label: "Odznaki", icon: Award },
              { key: "profile", label: "Profil", icon: User },
            ] as { key: Tab; label: string; icon: any }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === key
                  ? "bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white shadow-sm"
                  : "text-[#8a7262] hover:text-[#cf833f]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "profile" && <ProfileSettingsScreen />}
      {tab === "badges" && <BadgesScreen householdId={household._id} />}
      {tab === "budget" && (
        <BudgetSettingsScreen householdId={household._id} currency={household.currency} onBack={() => setTab("household")} />
      )}

      {tab === "household" && (
        <div className="space-y-6">
          <div className="bg-[#fdf9f1] rounded-xl p-6 pb-8 shadow-[0_8px_24px_rgba(180,120,80,0.15)] flex flex-col items-center relative overflow-hidden w-full">
            <h3 className="text-[1.1rem] font-bold text-[#3e2815] mb-6 relative z-10">Nasze gniazdo</h3>

            <div className="w-full relative z-10 mb-8">
              {members === undefined ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d87635]" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-x-4 gap-y-6 place-items-center">
                  {members.map((m) => {
                    const name = getFirstName(m.user?.name ?? m.user?.email);
                    return (
                      <div key={m._id} className="w-[90px] flex flex-col items-center gap-2 group relative">
                        <div
                          className={`w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-sm border-[3px] border-[#fdf9f1] ring-1 ring-[#eabdb1] ${getAvatarColor(
                            name
                          )}`}
                        >
                          {renderAvatarContent(name)}
                        </div>
                        <span
                          className="w-[86px] text-center truncate text-sm font-bold text-[#3e2815]"
                          title={name}
                        >
                          {name}
                        </span>

                        {household.role === "owner" && m.role !== "owner" && (
                          <IconTrashButton
                            onClick={() => setPendingRemoveUserId(m.userId)}
                            title="Usuń członka"
                            className="absolute -top-1 -right-1 h-7 w-7 rounded-full border border-red-200 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                          />
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setShowCode(!showCode)}
                    className="w-[90px] flex flex-col items-center gap-2 outline-none group"
                  >
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-sm border border-dashed border-[#d8c5bc] text-[#ccc2bc] bg-transparent group-hover:border-[#cf833f] group-hover:text-[#cf833f] transition-colors">
                      <UserPlus className="w-8 h-8" />
                    </div>
                    <span className="w-[86px] text-center text-xs font-bold text-[#6d4d38] leading-tight">
                      Zaproś członka
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative z-10 space-y-4 w-full flex flex-col items-center">
              <button
                onClick={() => setShowCode(!showCode)}
                className="w-[200px] py-3.5 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[15px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none"
              >
                {showCode ? "Ukryj" : "Zaproś"}
              </button>

              {showCode && (
                <div className="w-full bg-[#fcf4e4] p-4 rounded-xl flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-top-4 mt-2 border border-[#f5e5cf] shadow-inner">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 font-mono text-xl font-bold tracking-widest text-[#cf833f] text-center bg-white py-2 rounded-xl shadow-sm">
                      {household.inviteCode}
                    </div>
                    <button
                      onClick={copyCode}
                      className="p-3 bg-white rounded-xl text-[#3e2815] transition-colors shadow-sm font-bold border border-[#f1ecd4]"
                      title="Kopiuj"
                    >
                      <Clipboard className="w-5 h-5" />
                    </button>
                    {household.role === "owner" && (
                      <button
                        onClick={handleRegenerateCode}
                        className="p-3 bg-white rounded-xl text-gray-500 transition-colors shadow-sm font-bold border border-[#f1ecd4]"
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
                      className="w-full min-w-0 text-sm bg-white border border-[#f5e5cf] rounded-xl px-3 py-2 outline-none focus:border-[#cf833f] placeholder-gray-400 font-bold"
                    />
                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="px-4 py-2 bg-[#cf833f] text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap shadow-sm"
                    >
                      Wyślij
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-bold text-[#3e2815] mb-4 ml-1">Wybierz gospodarstwo</h3>
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {households.map((h) => (
                <button
                  key={h._id}
                  onClick={() => onSwitchHousehold(h._id)}
                  className={`whitespace-nowrap px-5 py-2 rounded-full font-medium text-[13px] transition-all focus:outline-none shadow-sm ${
                    household._id === h._id
                      ? "bg-[#cf833f] text-white shadow-[#cf833f]/30"
                      : "bg-[#fcf7ec] text-[#6d4d38] hover:bg-white border-transparent"
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <EmailSetupCard householdId={household._id} deploymentUrl={import.meta.env.VITE_CONVEX_URL || ""} />
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

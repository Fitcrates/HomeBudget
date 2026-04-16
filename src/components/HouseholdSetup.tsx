import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { HomeIcon } from "./ui/icons/HomeIcon";

interface Props {
  onCreated: (id: string) => void;
}

const HOUSEHOLD_INTENT_KEY = "homebudget_household_intent";

export function HouseholdSetup({ onCreated }: Props) {
  const [tab, setTab] = useState<"create" | "join">(() => {
    if (typeof window === "undefined") return "create";
    return sessionStorage.getItem(HOUSEHOLD_INTENT_KEY) === "join" ? "join" : "create";
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarImageId, setAvatarImageId] = useState<Id<"_storage"> | undefined>(undefined);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const createHousehold = useMutation(api.households.create);
  const joinByCode = useMutation(api.households.joinByCode);
  const myProfile = useQuery(api.profile.getMyProfile);
  const updateMyProfile = useMutation(api.profile.updateMyProfile);
  const generateAvatarUploadUrl = useMutation(api.profile.generateAvatarUploadUrl);
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (!myProfile) return;
    setDisplayName(myProfile.displayName || "");
    setAvatarImageId(myProfile.avatarImageId || undefined);
    setAvatarPreviewUrl(myProfile.avatarUrl || null);
  }, [myProfile]);

  const initials = useMemo(() => {
    if (displayName.trim()) {
      return displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
    }
    if (myProfile?.email) {
      return myProfile.email.slice(0, 2).toUpperCase();
    }
    return "U";
  }, [displayName, myProfile?.email]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const id = await createHousehold({ name: name.trim() });
      toast.success("Gospodarstwo domowe utworzone!");
      sessionStorage.removeItem(HOUSEHOLD_INTENT_KEY);
      onCreated(id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await uploadRes.json();
      setAvatarImageId(storageId as Id<"_storage">);
      setAvatarPreviewUrl(URL.createObjectURL(file));
      toast.success("Zdjęcie profilowe zostało przesłane.");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się przesłać zdjęcia profilowego.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile({
        displayName,
        avatarImageId,
      });
      toast.success("Ustawienia osobiste zostały zapisane.");
    } catch (err: any) {
      toast.error(err?.message || "Nie udało się zapisać ustawień osobistych.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const id = await joinByCode({ code: code.trim() });
      toast.success("Dołączono do gospodarstwa!");
      sessionStorage.removeItem(HOUSEHOLD_INTENT_KEY);
      onCreated(id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-screen overflow-y-auto">
      <div className="w-full max-w-sm space-y-8 py-4">
        <div className="text-center pt-8">
          <div className="flex justify-center mb-4">
            <HomeIcon className="w-16 h-16 text-[#c76823]" />
          </div>
          <h1 className="text-3xl font-medium text-[#2b180a] tracking-tight drop-shadow-sm">Domowe Gniazdo</h1>
          <p className="text-[#6d4d38] mt-2 font-bold drop-shadow-sm">Utwórz lub dołącz do gospodarstwa</p>
        </div>

        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_8px_32px_rgba(180,120,80,0.15)] overflow-hidden">
          <div className="flex border-b border-[#f5e5cf]/50">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-4 text-sm font-bold transition-colors ${
                tab === "create"
                  ? "bg-white/60 text-[#cf833f] border-b-[3px] border-[#cf833f]"
                  : "text-[#b89b87] hover:text-[#8a7262] hover:bg-white/30"
              }`}
            >
              Utwórz nowe
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-4 text-sm font-bold transition-colors ${
                tab === "join"
                  ? "bg-white/60 text-[#cf833f] border-b-[3px] border-[#cf833f]"
                  : "text-[#b89b87] hover:text-[#8a7262] hover:bg-white/30"
              }`}
            >
              Dołącz kodem
            </button>
          </div>

          <div className="p-6 pb-8">
            {tab === "create" ? (
              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1">
                    Nazwa gospodarstwa
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Rodzina Kowalskich"
                    className="w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white text-[#2b180a] font-bold placeholder-[#e0c9b7] transition-all shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full py-4 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[15px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50"
                >
                  {loading ? "Tworzenie..." : "Utwórz gospodarstwo"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1">
                    Kod zaproszenia
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="np. A7K9M2QX"
                    className="w-full text-2xl bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white text-[#cf833f] font-mono font-bold tracking-widest text-center shadow-inner transition-all placeholder-[#e0c9b7]"
                    maxLength={8}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full py-4 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[15px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50"
                >
                  {loading ? "Dołączanie..." : "Dołącz do gospodarstwa"}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-xl shadow-[0_8px_32px_rgba(180,120,80,0.15)] p-6 space-y-5">
          <div>
            <h2 className="text-lg font-medium text-[#2b180a]">Ustawienia osobiste</h2>
            <p className="text-xs text-[#8a7262] font-medium mt-1">Avatar, nazwa profilu i konto</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreviewUrl ? (
                <img
                  src={avatarPreviewUrl}
                  alt="Avatar"
                  className="h-16 w-16 rounded-xl object-cover border-2 border-[#f2d6bf]"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-[#f8e8d6] border-2 border-[#f2d6bf] flex items-center justify-center text-[#8a4f2a] font-medium text-xl">
                  {initials}
                </div>
              )}

              <label className="text-xs font-bold text-[#8a7262] cursor-pointer px-3 py-2 rounded-xl bg-white border border-[#f2d6bf] hover:border-[#cf833f] transition-colors">
                {uploadingAvatar ? "Przesyłanie..." : "Zmień zdjęcie"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1">
                Nazwa profilu
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jak mamy Cię wyświetlać?"
                className="w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white text-[#2b180a] font-bold placeholder-[#e0c9b7] transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile || uploadingAvatar}
              className="w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-medium text-[14px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50"
            >
              {savingProfile ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
          </form>

          <div className="pt-1 border-t border-[#f0ddcb] space-y-2">
            <p className="text-[11px] font-bold text-[#b89b87] uppercase tracking-wider">Hasło</p>
            <p className="text-xs text-[#8a7262] font-medium">
              Zmiana hasła jest dostępna przez ekran logowania. Wyloguj się i użyj opcji logowania hasłem.
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full py-2.5 rounded-xl border border-[#e6c9b0] bg-white text-[#8a4f2a] font-bold text-sm hover:border-[#cf833f] transition-colors"
            >
              Wyloguj się
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

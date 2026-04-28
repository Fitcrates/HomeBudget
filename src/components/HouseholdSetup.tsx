import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthActions } from "@convex-dev/auth/react";
import { HomeIcon } from "./ui/icons/HomeIcon";
import { Camera, LogOut } from "lucide-react";

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
    <div className="flex-1 flex items-center justify-center p-5 min-h-screen overflow-y-auto">
      <div className="w-full max-w-sm space-y-6 py-4">

        {/* ── Logo & Title ─────────────────────────────── */}
        <div className="text-center animate-fade-in-up">
          <div className="flex justify-center mb-5">
            <div
              className="relative flex items-center justify-center w-20 h-20 rounded-[22px]"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.25))",
                boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.45)",
                backdropFilter: "blur(20px)",
              }}
            >
              <HomeIcon className="w-11 h-11 text-[#c76823]" />
            </div>
          </div>
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Domowe Gniazdo
          </h1>
          <p
            className="mt-2 text-[15px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Utwórz lub dołącz do gospodarstwa
          </p>
        </div>

        {/* ── Household Card ───────────────────────────── */}
        <div className="app-card overflow-hidden animate-fade-in-up stagger-2">
          {/* Tab switcher */}
          <div className="flex p-1.5 m-3 mb-0 rounded-[14px]" style={{ background: "rgba(207, 131, 63, 0.08)" }}>
            <div className="relative flex flex-1">
              {/* Animated indicator */}
              <div
                className="absolute top-0 bottom-0 rounded-[11px] transition-all duration-300"
                style={{
                  width: "50%",
                  left: tab === "create" ? "0%" : "50%",
                  background: "linear-gradient(135deg, var(--accent-light), var(--accent-dark))",
                  boxShadow: "var(--shadow-cta)",
                }}
              />
              {(["create", "join"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="relative z-10 flex-1 py-2.5 text-sm font-bold transition-colors duration-200"
                  style={{ color: tab === t ? "white" : "var(--text-muted)" }}
                >
                  {t === "create" ? "Utwórz nowe" : "Dołącz kodem"}
                </button>
              ))}
            </div>
          </div>

          {/* Form content */}
          <div className="p-6 pb-7">
            {tab === "create" ? (
              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label
                    className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ml-0.5"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Nazwa gospodarstwa
                  </label>
                  <input
                    className="auth-input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="np. Rodzina Kowalskich"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="auth-button flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Utwórz gospodarstwo"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-5">
                <div>
                  <label
                    className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ml-0.5"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Kod zaproszenia
                  </label>
                  <input
                    className="auth-input-field text-center text-2xl tracking-[0.3em] font-mono"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="A7K9M2QX"
                    maxLength={8}
                    style={{ color: "var(--accent)" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="auth-button flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Dołącz do gospodarstwa"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Profile Settings Card ────────────────────── */}
        <div className="app-card p-6 space-y-5 animate-fade-in-up stagger-3">
          <div>
            <h2
              className="text-lg font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Ustawienia osobiste
            </h2>
            <p
              className="text-xs font-medium mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Avatar, nazwa profilu i konto
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              {avatarPreviewUrl ? (
                <img
                  src={avatarPreviewUrl}
                  alt="Avatar"
                  className="h-16 w-16 rounded-[16px] object-cover"
                  style={{ border: "2px solid var(--border-subtle)" }}
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-[16px] flex items-center justify-center text-xl font-semibold"
                  style={{
                    background: "linear-gradient(145deg, #fdf0e0, #f8e0c8)",
                    border: "2px solid var(--border-subtle)",
                    color: "var(--accent-hover)",
                  }}
                >
                  {initials}
                </div>
              )}

              <label
                className="text-xs font-bold cursor-pointer px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                style={{
                  color: "var(--text-muted)",
                  background: "var(--surface-input)",
                  border: "1.5px solid var(--border-input)",
                }}
              >
                <Camera className="w-3.5 h-3.5" />
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

            {/* Display name */}
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2 ml-0.5"
                style={{ color: "var(--text-faint)" }}
              >
                Nazwa profilu
              </label>
              <input
                className="auth-input-field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jak mamy Cię wyświetlać?"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile || uploadingAvatar}
              className="auth-button flex items-center justify-center gap-2"
            >
              {savingProfile ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Zapisz ustawienia"
              )}
            </button>
          </form>

          {/* Account section */}
          <div
            className="pt-4 space-y-2"
            style={{ borderTop: "1px solid var(--border-divider)" }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "var(--text-faint)" }}
            >
              Hasło
            </p>
            <p
              className="text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Zmiana hasła jest dostępna przez ekran logowania. Wyloguj się i użyj opcji logowania hasłem.
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: "var(--surface-input)",
                border: "1.5px solid var(--border-input)",
                color: "var(--text-secondary)",
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Wyloguj się
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

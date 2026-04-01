import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { User, Camera, Eye, EyeOff, LogOut, Trash2 } from "lucide-react";

const cardStyle =
  "bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-[0_8px_32px_rgba(180,120,80,0.15)]";
const labelStyle =
  "block text-[11px] font-bold text-[#b89b87] uppercase tracking-wider mb-2 ml-1 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]";
const inputStyle =
  "w-full text-base bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl px-4 py-3 outline-none focus:border-[#cf833f] focus:bg-white transition-all text-[#2b180a] font-bold placeholder-[#e0c9b7] shadow-inner";
const btnPrimary =
  "w-full py-3 bg-gradient-to-r from-[#de9241] to-[#ca782a] text-white rounded-full font-extrabold text-[14px] shadow-[0_4px_16px_rgba(200,120,50,0.3)] hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50";

export function ProfileSettingsScreen() {
  const myProfile = useQuery(api.profile.getMyProfile);
  const updateMyProfile = useMutation(api.profile.updateMyProfile);
  const removeAvatar = useMutation(api.profile.removeAvatar);
  const generateAvatarUploadUrl = useMutation(api.profile.generateAvatarUploadUrl);
  const { signIn, signOut } = useAuthActions();

  // --- Profile state ---
  const [displayName, setDisplayName] = useState("");
  const [avatarImageId, setAvatarImageId] = useState<Id<"_storage"> | undefined>(undefined);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Password state ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!myProfile) return;
    setDisplayName(myProfile.displayName || "");
    setAvatarImageId(myProfile.avatarImageId ?? undefined);
    setAvatarPreviewUrl(myProfile.avatarUrl || null);
  }, [myProfile]);

  const initials = useMemo(() => {
    if (displayName.trim()) {
      return displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("");
    }
    if (myProfile?.email) return myProfile.email.slice(0, 2).toUpperCase();
    return "U";
  }, [displayName, myProfile?.email]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploadUrl = await generateAvatarUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      setAvatarImageId(storageId as Id<"_storage">);
      setAvatarPreviewUrl(URL.createObjectURL(file));
      toast.success("Zdjęcie przesłane — zapisz profil, aby zastosować.");
    } catch {
      toast.error("Nie udało się przesłać zdjęcia.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarPreviewUrl(null);
    setAvatarImageId(undefined);
    try {
      await removeAvatar();
      toast.success("Zdjęcie profilowe usunięte.");
    } catch {
      toast.error("Nie udało się usunąć zdjęcia.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateMyProfile({ displayName, avatarImageId });
      toast.success("Profil zapisany!");
    } catch (err: any) {
      toast.error(err?.message || "Błąd zapisu profilu.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) { toast.error("Podaj aktualne hasło."); return; }
    if (newPassword.length < 8) { toast.error("Nowe hasło musi mieć co najmniej 8 znaków."); return; }
    if (newPassword !== confirmPassword) { toast.error("Nowe hasła nie są zgodne."); return; }
    if (!myProfile?.email) { toast.error("Nie można pobrać adresu e-mail."); return; }

    setChangingPassword(true);
    try {
      // Step 1: verify current password
      const fd1 = new FormData();
      fd1.set("email", myProfile.email);
      fd1.set("password", currentPassword);
      fd1.set("flow", "signIn");
      await signIn("password", fd1);

      // Step 2: set new password via signUp (Convex Auth upserts the secret)
      const fd2 = new FormData();
      fd2.set("email", myProfile.email);
      fd2.set("password", newPassword);
      fd2.set("flow", "signUp");
      await signIn("password", fd2);

      toast.success("Hasło zostało zmienione!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("password")) {
        toast.error("Aktualne hasło jest nieprawidłowe.");
      } else {
        toast.error("Nie udało się zmienić hasła. Spróbuj ponownie.");
      }
    } finally {
      setChangingPassword(false);
    }
  }

  function passwordStrength(pw: string) {
    if (!pw) return null;
    if (pw.length < 8) return { label: "Za krótkie", color: "bg-red-400", width: "w-1/4" };
    if (pw.length < 10) return { label: "Słabe", color: "bg-orange-400", width: "w-2/4" };
    if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
      return { label: "Średnie", color: "bg-yellow-400", width: "w-3/4" };
    return { label: "Silne", color: "bg-green-400", width: "w-full" };
  }
  const strength = passwordStrength(newPassword);

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="pt-1 pb-1 px-1">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-8 h-8 text-[#c76823] drop-shadow-sm" />
          <h2 className="text-[26px] font-extrabold tracking-tight text-[#2b180a] drop-shadow-sm">Mój Profil</h2>
        </div>
        {myProfile?.email && (
          <p className="text-sm text-[#6d4d38] font-bold ml-1 mt-1 drop-shadow-sm">{myProfile.email}</p>
        )}
      </div>

      {/* Avatar + Display Name */}
      <form onSubmit={handleSaveProfile} className={`${cardStyle} space-y-5`}>
        <p className={labelStyle}>Zdjęcie profilowe</p>

        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Avatar"
                className="h-20 w-20 rounded-2xl object-cover border-[3px] border-[#f2d6bf] shadow-md"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-white/60 backdrop-blur-md border-[3px] border-[#f2d6bf]/60 flex items-center justify-center text-[#8a4f2a] font-extrabold text-2xl shadow-sm">
                {initials}
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/60 hover:border-[#cf833f] hover:bg-white transition-all cursor-pointer text-sm font-bold text-[#6d4d38] shadow-sm">
              <Camera className="w-4 h-4" />
              <span>{uploadingAvatar ? "Przesyłanie..." : "Zmień zdjęcie"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </label>
            {avatarPreviewUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="py-2.5 px-4 rounded-xl bg-white/60 backdrop-blur-sm border border-red-200/60 hover:border-red-400/80 hover:bg-red-50 transition-all text-sm font-bold text-red-500 shadow-sm flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Usuń zdjęcie</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <label className={labelStyle}>Nazwa wyświetlana</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jak mamy Cię wyświetlać?"
            className={inputStyle}
          />
        </div>

        <button type="submit" disabled={savingProfile || uploadingAvatar} className={btnPrimary}>
          {savingProfile ? "Zapisywanie..." : "Zapisz profil"}
        </button>
      </form>

      {/* Password Change */}
      <form onSubmit={handleChangePassword} className={`${cardStyle} space-y-4`}>
        <div>
          <p className={labelStyle}>Zmiana hasła</p>
          <p className="text-xs text-[#8a7262] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
            Podaj aktualne hasło, aby ustawić nowe.
          </p>
        </div>

        <div>
          <label className={labelStyle}>Aktualne hasło</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputStyle} pr-12`}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b89b87] hover:text-[#cf833f]"
            >
              {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelStyle}>Nowe hasło</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 znaków"
              className={`${inputStyle} pr-12`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b89b87] hover:text-[#cf833f]"
            >
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-[#f5e5cf] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`}
                />
              </div>
              <p className="text-[11px] font-bold text-[#b89b87] ml-1">{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <label className={labelStyle}>Potwierdź nowe hasło</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Powtórz nowe hasło"
              className={`${inputStyle} pr-12 ${
                confirmPassword && confirmPassword !== newPassword
                  ? "border-red-300 focus:border-red-400"
                  : confirmPassword && confirmPassword === newPassword
                  ? "border-green-300 focus:border-green-400"
                  : ""
              }`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b89b87] hover:text-[#cf833f]"
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-[11px] font-bold text-red-500 ml-1 mt-1">Hasła nie są zgodne</p>
          )}
          {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
            <p className="text-[11px] font-bold text-green-600 ml-1 mt-1">✓ Hasła są zgodne</p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            changingPassword ||
            !currentPassword ||
            newPassword.length < 8 ||
            newPassword !== confirmPassword
          }
          className={btnPrimary}
        >
          {changingPassword ? "Zmienianie..." : "Zmień hasło"}
        </button>
      </form>

      {/* Sign out */}
      <div className={`${cardStyle} space-y-3`}>
        <p className={labelStyle}>Konto</p>
        <p className="text-xs text-[#8a7262] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
          Zalogowany jako:{" "}
          <span className="text-[#cf833f]">{myProfile?.email || "..."}</span>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full py-3.5 rounded-2xl border border-[#e6c9b0]/50 bg-white/60 backdrop-blur-sm text-[#8a4f2a] font-bold text-[15px] hover:border-[#cf833f]/60 hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Wyloguj się</span>
        </button>
      </div>
    </div>
  );
}

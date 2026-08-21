import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { User, Camera, Eye, EyeOff, LogOut } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { IconTrashButton } from "../ui/IconTrashButton";
import { AppCard } from "../ui/AppCard";
import { FormLabel } from "../ui/FormLabel";
import { FormInput } from "../ui/FormInput";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ButtonSecondary } from "../ui/ButtonSecondary";
import { ScreenHeader } from "../ui/ScreenHeader";
import { financialRoleLabel } from "../../lib/financialRole";

interface Props {
  householdId?: Id<"households">;
}

export function ProfileSettingsScreen({ householdId }: Props) {
  const myProfile = useQuery(api.profile.getMyProfile);
  const myMembership = useQuery(
    api.households.getMyMembership,
    householdId ? { householdId } : "skip"
  );
  const updateMyProfile = useMutation(api.profile.updateMyProfile);
  const removeAvatar = useMutation(api.profile.removeAvatar);
  const generateAvatarUploadUrl = useMutation(api.profile.generateAvatarUploadUrl);
  const { signIn, signOut } = useAuthActions();

  // --- Profile state ---
  const [displayName, setDisplayName] = useState("");
  const [avatarImageId, setAvatarImageId] = useState<Id<"_storage"> | undefined>(undefined);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [showRemoveAvatarModal, setShowRemoveAvatarModal] = useState(false);
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
      toast.success("Zdjęcie przesłane - zapisz profil, aby zastosować.");
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

  // financialRoleLabel imported from lib/financialRole

  return (
    <div className="space-y-6 pb-6">
      <ScreenHeader
        icon={<User />}
        title="Mój profil"
        subtitle={myProfile?.email}
      />

      {myMembership && (
        <AppCard className="space-y-2">
          <FormLabel>Rola finansowa</FormLabel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-orange-950 dark:text-white transition-colors duration-700">{financialRoleLabel(myMembership.financialRole)}</p>
              <p className="text-xs font-medium text-orange-900/60 dark:text-white/50 transition-colors duration-700">
                {myMembership.financialRole === "parent"
                  ? "Możesz kontrolować finanse domowe i limity dzieci."
                  : myMembership.financialRole === "child"
                    ? "Twoje wydatki mogą być ograniczone osobistym limitem."
                    : "Współdzielisz domowe finanse z pozostałymi."}
              </p>
            </div>
            <span className="rounded-full border border-orange-200 dark:border-white/10 bg-orange-50 dark:bg-white/5 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-indigo-400 transition-colors duration-700">
              {myMembership.role === "owner" ? "Właściciel" : "Członek"}
            </span>
          </div>
        </AppCard>
      )}

      {/* Avatar + Display Name */}
      <AppCard className="space-y-5">
        <form onSubmit={handleSaveProfile} className="space-y-5">
        <FormLabel>Zdjęcie profilowe</FormLabel>

        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt="Avatar"
                className="h-20 w-20 rounded-xl object-cover border-[3px] border-orange-200/50 dark:border-white/10 shadow-md transition-colors duration-700"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-md border-[3px] border-orange-200/50 dark:border-white/10 flex items-center justify-center text-orange-800 dark:text-indigo-200 font-medium text-2xl shadow-sm transition-colors duration-700">
                {initials}
              </div>
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <label className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/60 dark:border-white/10 hover:border-orange-500 dark:hover:border-indigo-400 hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer text-sm font-bold text-orange-900 dark:text-white/80 shadow-sm duration-700">
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
              <div className="flex justify-center">
                <IconTrashButton
                  onClick={() => setShowRemoveAvatarModal(true)}
                  title="Usuń zdjęcie"
                  className="h-10 w-10 rounded-xl border border-red-200/60 dark:border-red-500/30 bg-white/60 dark:bg-white/5 text-red-500 dark:text-red-400 hover:border-red-400/80 dark:hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-500/15"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <FormLabel>Nazwa wyświetlana</FormLabel>
          <FormInput
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jak mamy Cię wyświetlać?"
          />
        </div>

        <ButtonPrimary type="submit" loading={savingProfile} disabled={uploadingAvatar}>
          {savingProfile ? "Zapisywanie..." : "Zapisz profil"}
        </ButtonPrimary>
        </form>
      </AppCard>

      {/* Password Change */}
      <AppCard className="space-y-4">
        <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <FormLabel>Zmiana hasła</FormLabel>
          <p className="text-xs text-orange-900/60 dark:text-white/50 font-medium transition-colors duration-700">
            Podaj aktualne hasło, aby ustawić nowe.
          </p>
        </div>

        <div>
          <FormLabel>Aktualne hasło</FormLabel>
          <div className="relative">
            <FormInput
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-12"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-900/40 dark:text-white/40 hover:text-orange-500 dark:hover:text-indigo-400 transition-colors duration-700"
            >
              {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <FormLabel>Nowe hasło</FormLabel>
          <div className="relative">
            <FormInput
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 znaków"
              className="pr-12"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-900/40 dark:text-white/40 hover:text-orange-500 dark:hover:text-indigo-400 transition-colors duration-700"
            >
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-orange-100 dark:bg-white/10 rounded-full overflow-hidden transition-colors duration-700">
                <div
                  className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`}
                />
              </div>
              <p className="text-[11px] font-bold text-orange-900/40 dark:text-white/40 ml-1 transition-colors duration-700">{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <FormLabel>Potwierdź nowe hasło</FormLabel>
          <div className="relative">
            <FormInput
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Powtórz nowe hasło"
              error={!!(confirmPassword && confirmPassword !== newPassword)}
              className={`pr-12 ${
                confirmPassword && confirmPassword === newPassword
                  ? "border-green-300 dark:border-emerald-500/50 focus:border-green-400 dark:focus:border-emerald-400"
                  : ""
              }`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-900/40 dark:text-white/40 hover:text-orange-500 dark:hover:text-indigo-400 transition-colors duration-700"
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-[11px] font-bold text-red-500 dark:text-red-400 ml-1 mt-1">Hasła nie są zgodne</p>
          )}
          {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
            <p className="text-[11px] font-bold text-green-600 dark:text-emerald-400 ml-1 mt-1">✓ Hasła są zgodne</p>
          )}
        </div>

        <ButtonPrimary
          type="submit"
          loading={changingPassword}
          disabled={
            !currentPassword ||
            newPassword.length < 8 ||
            newPassword !== confirmPassword
          }
        >
          {changingPassword ? "Zmienianie..." : "Zmień hasło"}
        </ButtonPrimary>
        </form>
      </AppCard>

      {/* Sign out */}
      <AppCard className="space-y-3">
        <FormLabel>Konto</FormLabel>
        <p className="text-xs text-orange-900/60 dark:text-white/50 font-medium transition-colors duration-700">
          Zalogowany jako:{" "}
          <span className="text-orange-600 dark:text-indigo-400">{myProfile?.email || "..."}</span>
        </p>
        <ButtonSecondary
          variant="outline"
          icon={<LogOut className="w-5 h-5" />}
          onClick={() => void signOut()}
        >
          Wyloguj się
        </ButtonSecondary>
      </AppCard>

      <ConfirmDialog
        open={showRemoveAvatarModal}
        title="Usunąć zdjęcie profilowe?"
        description="Aktualny avatar zostanie usunięty z profilu."
        confirmLabel="Usuń"
        onCancel={() => setShowRemoveAvatarModal(false)}
        onConfirm={() => {
          void handleRemoveAvatar();
          setShowRemoveAvatarModal(false);
        }}
      />
    </div>
  );
}

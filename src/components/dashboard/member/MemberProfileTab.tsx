"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ChatOtpCard } from "@/components/auth/ChatOtpCard";
import { validateIndonesianNik, INDONESIAN_PROVINCES } from "@/lib/nik-validator";

export interface MemberProfileTabProps {
  authCtx: AuthenticatedContext;
}

export function MemberProfileTab({ authCtx }: MemberProfileTabProps) {
  const t = useTranslations("MemberDashboard");
  const router = useRouter();
  const [name, setName] = useState(authCtx.user.name);
  const [whatsapp, setWhatsapp] = useState(authCtx.user.whatsapp ?? "");
  const [bio, setBio] = useState(authCtx.user.bio ?? "");
  const [nik, setNik] = useState(authCtx.user.nik ?? "");
  const [address, setAddress] = useState(authCtx.user.address ?? "");
  const [province, setProvince] = useState(authCtx.user.province ?? "");
  const [city, setCity] = useState(authCtx.user.city ?? "");
  const [district, setDistrict] = useState(authCtx.user.district ?? "");
  const [postalCode, setPostalCode] = useState(authCtx.user.postalCode ?? "");
  const [emergencyContact, setEmergencyContact] = useState(authCtx.user.emergencyContact ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // State Foto Profil (Avatar)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(authCtx.user.image ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEmailVerified, setIsEmailVerified] = useState(authCtx.user.emailVerified);
  const [isWhatsappVerified, setIsWhatsappVerified] = useState(
    Boolean(authCtx.user.whatsappVerifiedAt)
  );

  // State Profil Rekan Pendaki / Anggota Rombongan
  interface Companion {
    id: string;
    name: string;
    identityNumber?: string | null;
    phone?: string | null;
    relation?: string | null;
    age?: number | null;
    notes?: string | null;
  }
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [isCompanionModalOpen, setIsCompanionModalOpen] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [companionIdNumber, setCompanionIdNumber] = useState("");
  const [companionPhone, setCompanionPhone] = useState("");
  const [companionRelation, setCompanionRelation] = useState("Keluarga");
  const [companionAge, setCompanionAge] = useState("");
  const [companionNotes, setCompanionNotes] = useState("");
  const [isSavingCompanion, setIsSavingCompanion] = useState(false);
  const [companionError, setCompanionError] = useState<string | null>(null);

  // Validasi Realtime NIK e-KTP Indonesia
  const memberNikValidation = nik.trim() ? validateIndonesianNik(nik) : null;
  const companionNikValidation = companionIdNumber.trim() ? validateIndonesianNik(companionIdNumber) : null;

  // Verification modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyModalChannel, setVerifyModalChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Muat data profil rekan pendaki tersimpan
  useState(() => {
    if (typeof window !== "undefined") {
      fetch("/api/user/companions")
        .then((res) => res.json())
        .then((data: { companions?: Companion[] }) => {
          if (data.companions) setCompanions(data.companions);
        })
        .catch(() => undefined);
    }
  });

  async function handleAddCompanion(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingCompanion(true);
    setCompanionError(null);

    const check = validateIndonesianNik(companionIdNumber);
    if (!check.isValid) {
      setCompanionError(`NIK e-KTP rekan wajib valid: ${check.message}`);
      setIsSavingCompanion(false);
      return;
    }

    try {
      const res = await fetch("/api/user/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companionName.trim(),
          identityNumber: companionIdNumber.trim(),
          phone: companionPhone.trim() || null,
          relation: companionRelation,
          age: companionAge ? parseInt(companionAge, 10) : null,
          notes: companionNotes.trim() || null,
        }),
      });
      const data = await res.json() as { error?: string; companion?: Companion };
      if (!res.ok) throw new Error(data.error || "Gagal menambah profil rekan.");
      if (data.companion) {
        setCompanions((prev) => [data.companion!, ...prev]);
      }
      setIsCompanionModalOpen(false);
      setCompanionName("");
      setCompanionIdNumber("");
      setCompanionPhone("");
      setCompanionAge("");
      setCompanionNotes("");
    } catch (err: unknown) {
      setCompanionError(err instanceof Error ? err.message : "Gagal menambah profil.");
    } finally {
      setIsSavingCompanion(false);
    }
  }

  async function handleDeleteCompanion(id: string) {
    if (!confirm("Hapus profil rekan pendaki ini dari daftar tersimpan?")) return;
    try {
      const res = await fetch(`/api/user/companions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCompanions((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      alert("Gagal menghapus profil rekan.");
    }
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    setAvatarError(null);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as { error?: string; avatarUrl?: string };
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah foto profil.");
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Gagal mengunggah foto.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("Hapus foto profil Anda?")) return;
    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menghapus foto profil.");
      setAvatarUrl(null);
      router.refresh();
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Gagal menghapus foto.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    if (nik.trim()) {
      const check = validateIndonesianNik(nik);
      if (!check.isValid) {
        setProfileError(`NIK e-KTP tidak valid: ${check.message}`);
        setIsSavingProfile(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          whatsapp,
          bio,
          nik: nik.trim() || null,
          address: address.trim() || null,
          province: province.trim() || null,
          city: city.trim() || null,
          district: district.trim() || null,
          postalCode: postalCode.trim() || null,
          emergencyContact: emergencyContact.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui profil.");
      }
      setProfileSuccess(data.message || "Profil berhasil diperbarui.");
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Gagal memperbarui profil."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah kata sandi.");
      }
      setPasswordSuccess(data.message || "Kata sandi berhasil diubah.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : "Gagal mengubah kata sandi."
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleExportData() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/user/export-data");
      if (!res.ok) throw new Error("Gagal mengunduh data pribadi.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wisata-cirebon-data-pribadi-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Gagal mengunduh data pribadi. Silakan coba kembali.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: deletePassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus akun.");
      }
      // Redirect to home upon deletion
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Gagal menghapus akun."
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-8" data-testid="member-profile-tab-content">
      {/* Header Profil */}
      <div className="max-w-3xl">
        <h2 className="font-heading text-2xl font-bold text-kabut sm:text-3xl">
          {t("profileHeading")}
        </h2>
        <p className="mt-2 text-sm text-kabut/80 leading-relaxed">
          {t("profileLead")}
        </p>
      </div>

      {/* BANNER PERINGATAN 2FA BELUM AKTIF DENGAN KELAP-KELIP PELAN */}
      {!authCtx.user.twoFactorEnabled ? (
        <div className="animate-pulse-warning rounded-2xl border-2 border-amber-500/60 bg-amber-950/30 p-4 sm:p-5 text-amber-200 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-obsidian text-lg font-black shadow-md">
              !
            </span>
            <div>
              <h3 className="font-heading text-sm sm:text-base font-bold text-amber-100 flex items-center gap-2">
                <span>Peringatan Keamanan: 2FA Belum Aktif</span>
                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.2 text-[10px] font-mono text-amber-300">
                  Belum Terverifikasi
                </span>
              </h3>
              <p className="text-xs text-amber-200/80 mt-1 max-w-xl">
                Akun Anda belum diproteksi oleh Autentikasi Dua Faktor (2FA). Aktifkan sekarang menggunakan Google Authenticator agar tiket dan saldo Anda aman dari akses tidak sah.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/verifikasi-2fa?setup=1")}
            className="btn-ui btn-fajar whitespace-nowrap text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shrink-0 cursor-pointer"
          >
            <i className="bi bi-shield-lock-fill mr-1.5" aria-hidden="true" />
            <span>Pasang 2FA Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 text-lg">
              <i className="bi bi-shield-check" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-emerald-100">
                Autentikasi Dua Faktor (2FA) Aktif
              </p>
              <p className="text-[11px] text-emerald-200/70">
                Akun Anda terlindungi dengan standar keamanan TOTP RFC-6238.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
            Terverifikasi
          </span>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form Informasi Profil */}
        <section className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-5">
          <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
            <i className="bi bi-person-badge text-fajar" aria-hidden="true" />
            <span>{t("profileInfoSection")}</span>
          </h3>

          {profileSuccess ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
              {profileSuccess}
            </div>
          ) : null}

          {profileError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200">
              {profileError}
            </div>
          ) : null}

          {/* FOTO PROFIL (AVATAR) RESMI MEMBER */}
          <div className="rounded-xl border border-white/10 bg-obsidian/60 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Pratinjau Foto */}
              <div className="relative">
                {avatarUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-fajar/50 shadow-xl bg-obsidian">
                    <Image
                      src={avatarUrl}
                      alt={name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-white/10 font-unbounded text-xl font-bold text-fajar shadow-lg">
                    {name ? name.trim().slice(0, 2).toUpperCase() : "DC"}
                  </div>
                )}
                {isUploadingAvatar ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-obsidian/80 backdrop-blur-xs">
                    <i className="bi bi-arrow-repeat animate-spin text-fajar text-lg" aria-hidden="true" />
                  </div>
                ) : null}
              </div>

              {/* Kontrol Aksi Foto */}
              <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                <p className="font-bold text-kabut">Foto Profil Akun</p>
                <p className="text-[11px] text-kabut/65 leading-relaxed">
                  Format JPG, PNG, atau WebP (maks. 5 MB). Foto akan ditampilkan di menu samping, status tiket, dan ulasan Anda.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ui btn-fajar py-1.5 px-3 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <i className="bi bi-camera-fill text-xs" aria-hidden="true" />
                    <span>{avatarUrl ? "Ganti Foto" : "Unggah Foto Profil"}</span>
                  </button>

                  {avatarUrl ? (
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={handleDeleteAvatar}
                      className="btn-ui btn-glass py-1.5 px-2.5 text-xs font-bold text-red-300 hover:text-red-200 cursor-pointer flex items-center gap-1"
                    >
                      <i className="bi bi-trash" aria-hidden="true" />
                      <span>Hapus</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {avatarError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-[11px] text-red-200">
                {avatarError}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-bold text-kabut/90"
              >
                {t("profileNameLabel")}
              </label>
              <input
                id="profile-name"
                data-testid="profile-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-sm text-kabut focus:border-fajar focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-bold text-kabut/90"
                >
                  {t("profileEmailLabel")}
                </label>
                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <i className="bi bi-patch-check-fill text-emerald-400" aria-hidden="true" />
                    Terverifikasi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <i className="bi bi-exclamation-triangle-fill text-amber-400" aria-hidden="true" />
                    Belum Terverifikasi
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex gap-2 items-center">
                <input
                  id="profile-email"
                  type="email"
                  value={authCtx.user.email}
                  disabled
                  className="flex-1 rounded-xl border border-telaga-700/50 bg-obsidian/40 p-3 text-sm text-kabut/60 cursor-not-allowed"
                />
                {!isEmailVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyModalChannel("email");
                      setVerifyError(null);
                      setIsVerifyModalOpen(true);
                    }}
                    className="btn-ui btn-fajar whitespace-nowrap text-xs font-bold px-3 py-2.5 rounded-xl shadow-md"
                  >
                    <i className="bi bi-envelope-check mr-1" aria-hidden="true" />
                    <span>Verifikasi Email</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="profile-whatsapp"
                  className="block text-xs font-bold text-kabut/90"
                >
                  {t("profileWaLabel")}
                </label>
                {isWhatsappVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <i className="bi bi-patch-check-fill text-emerald-400" aria-hidden="true" />
                    Terverifikasi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <i className="bi bi-exclamation-triangle-fill text-amber-400" aria-hidden="true" />
                    Belum Terverifikasi
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex gap-2 items-center">
                <input
                  id="profile-whatsapp"
                  data-testid="profile-whatsapp-input"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+628..."
                  className="flex-1 rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-sm text-kabut focus:border-fajar focus:outline-none"
                />
                {!isWhatsappVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyModalChannel("whatsapp");
                      setVerifyError(null);
                      setIsVerifyModalOpen(true);
                    }}
                    className="btn-ui btn-fajar whitespace-nowrap text-xs font-bold px-3 py-2.5 rounded-xl shadow-md"
                  >
                    <i className="bi bi-whatsapp mr-1" aria-hidden="true" />
                    <span>Verifikasi WA</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bio Catatan Singkat Pendaki */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-bio"
                  className="block text-xs font-bold text-kabut/90"
                >
                  Bio Singkat / Catatan Pendaki
                </label>
                <span className="text-[10px] text-kabut/50 font-mono">
                  {bio.length}/500
                </span>
              </div>
              <textarea
                id="profile-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tuliskan pengalaman hiking, minat alam bebas, atau catatan khusus pendakian Anda..."
                className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-xs text-kabut focus:border-fajar focus:outline-none resize-none"
              />
            </div>

            {/* NIK KTP Member / Ketua Rombongan */}
            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="profile-nik"
                  className="block text-xs font-bold text-kabut/90 flex items-center gap-1.5"
                >
                  <i className="bi bi-person-vcard text-fajar" aria-hidden="true" />
                  <span>NIK e-KTP Pemilik Akun / Ketua Rombongan</span>
                </label>
                {memberNikValidation ? (
                  memberNikValidation.isValid ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <i className="bi bi-patch-check-fill text-emerald-400" aria-hidden="true" />
                      NIK Sah Dukcapil
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                      <i className="bi bi-exclamation-octagon-fill text-red-400" aria-hidden="true" />
                      Format NIK Tidak Sah
                    </span>
                  )
                ) : null}
              </div>

              <input
                id="profile-nik"
                type="text"
                maxLength={16}
                inputMode="numeric"
                value={nik}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                  setNik(val);
                  if (val.length >= 2 && !province) {
                    const matchProv = INDONESIAN_PROVINCES.find((p) => p.code === val.slice(0, 2));
                    if (matchProv) setProvince(matchProv.name);
                  }
                }}
                placeholder="16 digit NIK sesuai e-KTP resmi"
                className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs font-mono tracking-wider text-kabut focus:border-fajar focus:outline-none"
              />

              {memberNikValidation ? (
                memberNikValidation.isValid && memberNikValidation.data ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2 text-[11px] text-emerald-200 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                    <span>• {memberNikValidation.data.gender === "LAKI_LAKI" ? "Laki-laki" : "Perempuan"}</span>
                    <span>• Lahir: {String(memberNikValidation.data.birthDay).padStart(2, "0")}/{String(memberNikValidation.data.birthMonth).padStart(2, "0")}/19{memberNikValidation.data.birthYearSuffix < 30 ? "20" + String(memberNikValidation.data.birthYearSuffix).padStart(2, "0") : String(memberNikValidation.data.birthYearSuffix).padStart(2, "0")}</span>
                    {memberNikValidation.data.provinceName ? (
                      <span>• {memberNikValidation.data.provinceName}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <i className="bi bi-info-circle text-xs" aria-hidden="true" />
                    <span>{memberNikValidation.message}</span>
                  </p>
                )
              ) : (
                <p className="text-[10px] text-kabut/45">
                  Digunakan untuk manifes asuransi keselamatan pendakian Gunung Bendera & Batu Lawang.
                </p>
              )}
            </div>

            {/* Alamat Domisili Lengkap & Terstruktur */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-xs font-bold text-kabut/90 flex items-center gap-1.5 pb-1 border-b border-white/5">
                <i className="bi bi-geo-alt-fill text-fajar" aria-hidden="true" />
                <span>Alamat Domisili Lengkap (Sesuai KTP / Tempat Tinggal)</span>
              </p>

              <div>
                <label htmlFor="profile-address" className="block text-[11px] font-bold text-kabut/80 mb-1">
                  Alamat Jalan / Dusun / Blok / RT / RW / No. Rumah
                </label>
                <textarea
                  id="profile-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Pangeran Kejaksan No. 12, RT 03 / RW 05, Desa Cupang"
                  className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="profile-province" className="block text-[11px] font-bold text-kabut/80 mb-1">
                    Provinsi
                  </label>
                  <select
                    id="profile-province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                  >
                    <option value="">Pilih Provinsi...</option>
                    {INDONESIAN_PROVINCES.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="profile-city" className="block text-[11px] font-bold text-kabut/80 mb-1">
                    Kota / Kabupaten
                  </label>
                  <input
                    id="profile-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Kabupaten Cirebon"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="profile-district" className="block text-[11px] font-bold text-kabut/80 mb-1">
                    Kecamatan / Kelurahan
                  </label>
                  <input
                    id="profile-district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Contoh: Gempol / Cupang"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="profile-postal" className="block text-[11px] font-bold text-kabut/80 mb-1">
                    Kode Pos (5 Digit)
                  </label>
                  <input
                    id="profile-postal"
                    type="text"
                    maxLength={5}
                    inputMode="numeric"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="45161"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs font-mono text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Kontak Darurat Keluarga */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-1.5">
              <label
                htmlFor="profile-emergency"
                className="block text-xs font-bold text-kabut/90 flex items-center gap-1.5"
              >
                <i className="bi bi-telephone-fill text-fajar" aria-hidden="true" />
                <span>Kontak Darurat Keluarga Terdekat</span>
              </label>
              <input
                id="profile-emergency"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Contoh: Budi Santoso (Ayah) - 081234567890"
                className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
              />
              <p className="text-[10px] text-kabut/45">
                Dihubungi tim SAR pos pemantau jika terjadi kendala darurat di jalur pendakian.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-kabut/90">
                {t("profileRoleLabel")}
              </label>
              <div className="mt-1.5 inline-flex items-center gap-2 rounded-lg bg-hutan border border-telaga-700 px-3 py-1.5 text-xs font-bold text-fajar">
                <i className="bi bi-shield-check" aria-hidden="true" />
                <span>{authCtx.user.role}</span>
              </div>
            </div>

            <button
              type="submit"
              data-testid="profile-save-btn"
              disabled={isSavingProfile}
              className="btn-ui btn-fajar rounded-xl px-5 py-2.5 text-xs font-bold"
            >
              {isSavingProfile ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("profileSavingBtn")}</span>
                </>
              ) : (
                <span>{t("profileSaveBtn")}</span>
              )}
            </button>
          </form>
        </section>

        {/* Form Ubah Kata Sandi */}
        <section className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-5">
          <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
            <i className="bi bi-key-fill text-fajar" aria-hidden="true" />
            <span>{t("passwordSection")}</span>
          </h3>

          {passwordSuccess ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
              {passwordSuccess}
            </div>
          ) : null}

          {passwordError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200">
              {passwordError}
            </div>
          ) : null}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <PasswordInput
              id="current-password"
              data-testid="current-password-input"
              label={t("currentPasswordLabel")}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan kata sandi saat ini"
              required
            />

            <PasswordInput
              id="new-password"
              data-testid="new-password-input"
              label={t("newPasswordLabel")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter (huruf & angka)"
              showRequirements={true}
              required
            />

            <button
              type="submit"
              data-testid="change-password-btn"
              disabled={isChangingPassword}
              className="btn-ui rounded-xl border border-telaga-700 bg-obsidian/90 px-5 py-2.5 text-xs font-bold text-kabut hover:bg-obsidian"
            >
              {isChangingPassword ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("changingPasswordBtn")}</span>
                </>
              ) : (
                <span>{t("changePasswordBtn")}</span>
              )}
            </button>
          </form>
        </section>
      </div>

      {/* SEKSI PROFIL REKAN PENDAKI / ANGGOTA KELUARGA TERDAFTAR */}
      <section className="surface-solid-dark p-6 sm:p-7 rounded-2xl border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
                <i className="bi bi-people-fill text-fajar" aria-hidden="true" />
                <span>Profil Rekan Pendaki & Rombongan</span>
              </h3>
              <span className="rounded-full bg-fajar/10 border border-fajar/20 px-2 py-0.2 text-[10px] font-mono text-fajar">
                {companions.length} Tersimpan
              </span>
            </div>
            <p className="mt-1 text-xs text-kabut/70">
              Simpan data identitas anggota rombongan atau keluarga agar pemesanan tiket mendaki berikutnya lebih cepat tanpa perlu input manual.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompanionError(null);
              setIsCompanionModalOpen(true);
            }}
            className="btn-ui btn-fajar whitespace-nowrap text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <i className="bi bi-person-plus-fill text-sm" aria-hidden="true" />
            <span>Tambah Rekan Pendaki</span>
          </button>
        </div>

        {companions.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-obsidian/40 p-6 text-center text-xs text-kabut/60 space-y-2">
            <i className="bi bi-person-vcard text-3xl text-kabut/30" aria-hidden="true" />
            <p>Belum ada profil rekan pendaki yang disimpan.</p>
            <p className="text-[11px] text-kabut/40">
              Klik &quot;Tambah Rekan Pendaki&quot; untuk mendaftarkan identitas teman atau keluarga Anda.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companions.map((comp) => (
              <div
                key={comp.id}
                className="rounded-xl border border-white/10 bg-obsidian/60 p-4 flex flex-col justify-between gap-3 hover:border-white/20 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-sm font-bold text-kabut truncate" title={comp.name}>
                      {comp.name}
                    </p>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-kabut/75">
                      {comp.relation || "Rekan"}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[11px] font-mono text-kabut/75">
                    {comp.identityNumber ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 rounded-md px-2 py-0.5">
                        <i className="bi bi-shield-check" aria-hidden="true" />
                        <span>NIK: {comp.identityNumber}</span>
                      </div>
                    ) : null}
                    {comp.phone ? (
                      <p className="truncate flex items-center gap-1.5 text-kabut/60">
                        <i className="bi bi-whatsapp text-emerald-400 text-xs" />
                        <span>{comp.phone}</span>
                      </p>
                    ) : null}
                    {comp.age ? <p className="text-kabut/60">Usia: {comp.age} tahun</p> : null}
                    {comp.notes ? (
                      <p className="text-kabut/45 italic truncate mt-1">
                        &ldquo;{comp.notes}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => handleDeleteCompanion(comp.id)}
                    className="text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <i className="bi bi-trash" aria-hidden="true" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL TAMBAH PROFIL REKAN PENDAKI */}
      {isCompanionModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-2xl bg-hutan border border-white/20 p-6 shadow-2xl text-kabut space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-heading text-base font-bold flex items-center gap-2">
                <i className="bi bi-person-plus-fill text-fajar" aria-hidden="true" />
                <span>Tambah Profil Rekan Pendaki</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCompanionModalOpen(false)}
                className="text-kabut/60 hover:text-white cursor-pointer"
              >
                <i className="bi bi-x-lg text-xs" aria-hidden="true" />
              </button>
            </div>

            {companionError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200">
                {companionError}
              </div>
            ) : null}

            <form onSubmit={handleAddCompanion} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-kabut/90">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  placeholder="Nama sesuai KTP/Identitas"
                  className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-kabut/90">Hubungan</label>
                  <select
                    value={companionRelation}
                    onChange={(e) => setCompanionRelation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                  >
                    <option value="Keluarga">Keluarga</option>
                    <option value="Rekan Pendaki">Rekan Pendaki</option>
                    <option value="Pasangan">Pasangan</option>
                    <option value="Sahabat">Sahabat</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-kabut/90">Usia (Tahun)</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={companionAge}
                    onChange={(e) => setCompanionAge(e.target.value)}
                    placeholder="Contoh: 26"
                    className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-kabut/90">
                    Nomor Induk Kependudukan (NIK e-KTP) *
                  </label>
                  {companionNikValidation ? (
                    companionNikValidation.isValid ? (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <i className="bi bi-patch-check-fill" aria-hidden="true" />
                        Sah Dukcapil
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                        <i className="bi bi-exclamation-octagon-fill" aria-hidden="true" />
                        Tidak Valid
                      </span>
                    )
                  ) : null}
                </div>
                <input
                  type="text"
                  required
                  maxLength={16}
                  inputMode="numeric"
                  value={companionIdNumber}
                  onChange={(e) => setCompanionIdNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="16 digit NIK resmi anggota rombongan"
                  className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs font-mono text-kabut focus:border-fajar focus:outline-none"
                />

                {companionNikValidation ? (
                  companionNikValidation.isValid && companionNikValidation.data ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2 text-[10px] text-emerald-200 flex flex-wrap gap-x-2 font-mono">
                      <span>✓ {companionNikValidation.data.gender === "LAKI_LAKI" ? "Laki-laki" : "Perempuan"}</span>
                      <span>• Lahir: {String(companionNikValidation.data.birthDay).padStart(2, "0")}/{String(companionNikValidation.data.birthMonth).padStart(2, "0")}/19{companionNikValidation.data.birthYearSuffix < 30 ? "20" + String(companionNikValidation.data.birthYearSuffix).padStart(2, "0") : String(companionNikValidation.data.birthYearSuffix).padStart(2, "0")}</span>
                      {companionNikValidation.data.provinceName ? (
                        <span>• {companionNikValidation.data.provinceName}</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">
                      <i className="bi bi-info-circle text-xs" aria-hidden="true" />
                      <span>{companionNikValidation.message}</span>
                    </p>
                  )
                ) : (
                  <p className="text-[10px] text-kabut/45">
                    Wajib 16 digit sesuai e-KTP untuk manifes tiket rombongan & asuransi pendakian.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-kabut/90">Nomor Telepon / WhatsApp</label>
                <input
                  type="tel"
                  value={companionPhone}
                  onChange={(e) => setCompanionPhone(e.target.value)}
                  placeholder="08..."
                  className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-kabut/90">Catatan Khusus (Opsional)</label>
                <input
                  type="text"
                  value={companionNotes}
                  onChange={(e) => setCompanionNotes(e.target.value)}
                  placeholder="Misal: Riwayat asma, golongan darah O"
                  className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCompanionModalOpen(false)}
                  className="btn-ui btn-glass py-2 px-3 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCompanion || !companionNikValidation?.isValid || !companionName.trim()}
                  className="btn-ui btn-fajar py-2 px-4 text-xs font-bold disabled:opacity-50"
                >
                  {isSavingCompanion ? "Menyimpan..." : "Simpan Profil Rekan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Bagian Hak Privasi UU PDP */}
      <section className="surface-solid-dark p-6 sm:p-8 rounded-2xl border border-telaga-700/60 space-y-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-telaga-800/40 border border-telaga-600 px-3 py-1 text-xs font-bold text-fajar">
            <i className="bi bi-shield-shaded" aria-hidden="true" />
            <span>{t("pdpLawBadge")}</span>
          </span>
          <h3 className="mt-2.5 font-heading text-xl font-bold text-kabut">
            {t("pdpSection")}
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Ekspor Data */}
          <div className="rounded-xl border border-telaga-700/50 bg-obsidian/50 p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-kabut flex items-center gap-2">
                <i className="bi bi-file-earmark-code-fill text-fajar" aria-hidden="true" />
                <span>{t("pdpPortabilityTitle")}</span>
              </h4>
              <p className="mt-2 text-xs text-kabut/80 leading-relaxed">
                {t("pdpExportDesc")}
              </p>
            </div>
            <button
              type="button"
              data-testid="pdp-export-btn"
              onClick={handleExportData}
              disabled={isExporting}
              className="btn-ui btn-hutan w-full rounded-xl py-2.5 text-xs font-bold"
            >
              {isExporting ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("pdpExportingBtn")}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-download mr-1.5" aria-hidden="true" />
                  <span>{t("pdpExportBtn")}</span>
                </>
              )}
            </button>
          </div>

          {/* Hapus / Anonimkan Akun */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-red-300 flex items-center gap-2">
                <i className="bi bi-person-x-fill text-red-400" aria-hidden="true" />
                <span>{t("pdpErasureTitle")}</span>
              </h4>
              <p className="mt-2 text-xs text-kabut/80 leading-relaxed">
                {t("pdpDeleteDesc")}
              </p>
            </div>
            <button
              type="button"
              data-testid="pdp-delete-account-btn"
              onClick={() => setIsDeleteModalOpen(true)}
              className="btn-ui rounded-xl border border-red-500/40 bg-red-950/50 text-red-200 hover:bg-red-900/60 w-full py-2.5 text-xs font-bold transition"
            >
              <i className="bi bi-trash-fill mr-1.5" aria-hidden="true" />
              <span>{t("pdpDeleteBtn")}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal Konfirmasi Hapus Akun */}
      {isDeleteModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md"
        >
          <div
            data-testid="delete-account-modal"
            className="w-full max-w-md rounded-2xl bg-hutan border border-red-500/60 p-6 shadow-2xl text-kabut space-y-5"
          >
            <div className="flex items-center gap-3 text-red-400">
              <i className="bi bi-exclamation-triangle-fill text-2xl" aria-hidden="true" />
              <h3 className="font-heading text-lg font-bold">
                {t("deleteConfirmTitle")}
              </h3>
            </div>
            <p className="text-xs text-kabut/85 leading-relaxed">
              {t("deleteConfirmDesc")}
            </p>

            {deleteError ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200"
              >
                {deleteError}
              </div>
            ) : null}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <PasswordInput
                id="delete-confirm-password"
                data-testid="delete-confirm-password-input"
                label={t("currentPasswordLabel")}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Masukkan kata sandi untuk konfirmasi"
                required
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="btn-ui rounded-xl border border-telaga-700 bg-obsidian px-4 py-2 text-xs font-semibold"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  data-testid="confirm-delete-account-btn"
                  disabled={isDeleting || !deletePassword}
                  className="btn-ui rounded-xl bg-red-700 hover:bg-red-600 text-white px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <i
                        className="bi bi-arrow-repeat animate-spin mr-1.5"
                        aria-hidden="true"
                      />
                      <span>{t("deletingAccountBtn")}</span>
                    </>
                  ) : (
                    <span>{t("confirmDeleteBtn")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Verifikasi OTP Symmetrical (WhatsApp / Email) */}
      {isVerifyModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-xl animate-fade-in">
          <div className="surface-glass-modal w-full max-w-md p-6 sm:p-7 rounded-3xl border border-white/20 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-kabut hover:text-white transition"
              aria-label="Tutup modal"
            >
              <i className="bi bi-x-lg text-sm" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fajar/10 border border-fajar/30 text-xs font-bold text-fajar mb-1">
                <i
                  className={`bi ${
                    verifyModalChannel === "email" ? "bi-envelope-check-fill" : "bi-whatsapp"
                  }`}
                />
                <span>
                  {verifyModalChannel === "email" ? "Verifikasi Surel Resmi" : "Verifikasi WhatsApp Resmi"}
                </span>
              </div>
              <h3 className="font-heading text-xl font-bold text-kabut">
                {verifyModalChannel === "email"
                  ? "Verifikasi Alamat Email"
                  : "Verifikasi Nomor WhatsApp"}
              </h3>
              <p className="text-xs text-kabut/75 leading-relaxed">
                {verifyModalChannel === "email"
                  ? `Kode OTP 6-digit akan dikirimkan ke alamat email ${authCtx.user.email} Anda.`
                  : "Kode OTP 6-digit dikirimkan melalui obrolan resmi WhatsApp Business ke nomor Anda."}
              </p>
            </div>

            {verifyError ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
                {verifyError}
              </div>
            ) : null}

            <ChatOtpCard
              initialPhone={whatsapp}
              initialEmail={authCtx.user.email}
              lockChannel={verifyModalChannel}
              isLoading={verifyLoading}
              setIsLoading={setVerifyLoading}
              onError={setVerifyError}
              onSuccess={async () => {
                if (verifyModalChannel === "email") {
                  setIsEmailVerified(true);
                  setProfileSuccess("Email Anda telah berhasil diverifikasi!");
                } else {
                  setIsWhatsappVerified(true);
                  setProfileSuccess("Nomor WhatsApp Anda telah berhasil diverifikasi!");
                }
                setIsVerifyModalOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

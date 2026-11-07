"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ChatOtpCard } from "@/components/auth/ChatOtpCard";
import {
  validateIndonesianNik,
  INDONESIAN_PROVINCES,
} from "@/lib/nik-validator";

export interface MemberProfileTabProps {
  authCtx: AuthenticatedContext;
}

interface Companion {
  id: string;
  name: string;
  identityNumber?: string | null;
  phone?: string | null;
  relation?: string | null;
  age?: number | null;
  notes?: string | null;
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
  const [emergencyContact, setEmergencyContact] = useState(
    authCtx.user.emergencyContact ?? ""
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // State Foto Profil (Avatar)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    authCtx.user.image ?? null
  );
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOAuthAccount = Boolean(authCtx.user.isOAuthUser);
  const [isEmailVerified, setIsEmailVerified] = useState(
    Boolean(authCtx.user.emailVerified) || isOAuthAccount
  );
  const [isWhatsappVerified, setIsWhatsappVerified] = useState(
    Boolean(authCtx.user.whatsappVerifiedAt)
  );

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
  const companionNikValidation = companionIdNumber.trim()
    ? validateIndonesianNik(companionIdNumber)
    : null;

  // Verification modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyModalChannel, setVerifyModalChannel] = useState<
    "whatsapp" | "email"
  >("email");
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
  useEffect(() => {
    let active = true;
    fetch("/api/user/companions")
      .then((res) => res.json())
      .then((data: { companions?: Companion[] }) => {
        if (active && data.companions) setCompanions(data.companions);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Kalkulasi persentase kelengkapan profil secara nyata
  const completeness = useMemo(() => {
    const checks = [
      Boolean(name.trim().length >= 2),
      Boolean(isEmailVerified),
      Boolean(whatsapp.trim().length >= 9),
      Boolean(memberNikValidation?.isValid),
      Boolean(address.trim().length >= 5 && province.trim()),
      Boolean(emergencyContact.trim().length >= 5),
      Boolean(avatarUrl),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [
    address,
    avatarUrl,
    emergencyContact,
    isEmailVerified,
    memberNikValidation?.isValid,
    name,
    province,
    whatsapp,
  ]);

  function openVerifyModal(channel: "email" | "whatsapp") {
    setVerifyModalChannel(channel);
    setVerifyError(null);
    setIsVerifyModalOpen(true);
  }

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
      const data = (await res.json()) as {
        error?: string;
        companion?: Companion;
      };
      if (!res.ok)
        throw new Error(data.error || "Gagal menambah profil rekan.");
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
      setCompanionError(
        err instanceof Error ? err.message : "Gagal menambah profil."
      );
    } finally {
      setIsSavingCompanion(false);
    }
  }

  async function handleDeleteCompanion(id: string) {
    if (!confirm("Hapus profil rekan pendaki ini dari daftar tersimpan?"))
      return;
    try {
      const res = await fetch(`/api/user/companions?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCompanions((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      alert("Gagal menghapus profil rekan.");
    }
  }

  async function handleAvatarFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
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
      const data = (await res.json()) as { error?: string; avatarUrl?: string };
      if (!res.ok)
        throw new Error(data.error || "Gagal mengunggah foto profil.");
      if (data.avatarUrl) {
        setAvatarLoadError(false);
        setAvatarUrl(data.avatarUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setAvatarError(
        err instanceof Error ? err.message : "Gagal mengunggah foto."
      );
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(data.error || "Gagal menghapus foto profil.");
      setAvatarUrl(null);
      router.refresh();
    } catch (err: unknown) {
      setAvatarError(
        err instanceof Error ? err.message : "Gagal menghapus foto."
      );
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
    <div className="space-y-7" data-testid="member-profile-tab-content">
      {/* =====================================================================
       * 1. HERO IDENTITAS PENDAKI & METER KELENGKAPAN PROFIL
       * ===================================================================== */}
      <section className="relative overflow-hidden surface-solid-dark rounded-3xl border border-telaga-700/70 p-5 sm:p-7 shadow-2xl bg-gradient-to-br from-hutan/90 via-obsidian/95 to-obsidian">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-fajar/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-telaga/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Avatar + Identitas Utama */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="relative self-start sm:self-auto">
              {avatarUrl && !avatarLoadError ? (
                <div className="relative h-22 w-22 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-3xl border-2 border-fajar/65 shadow-[0_0_28px_rgba(242,166,90,0.25)] bg-obsidian">
                  <Image
                    src={avatarUrl}
                    alt={name}
                    fill
                    sizes="96px"
                    referrerPolicy="no-referrer"
                    unoptimized={avatarUrl.startsWith("http")}
                    onError={() => setAvatarLoadError(true)}
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-22 w-22 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-fajar/25 to-amber-600/10 border-2 border-fajar/50 font-unbounded text-2xl font-black text-fajar shadow-xl">
                  {name ? name.trim().slice(0, 2).toUpperCase() : "WC"}
                </div>
              )}

              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                title="Ganti Foto Profil"
                className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-fajar text-obsidian shadow-lg border-2 border-obsidian hover:scale-105 active:scale-95 transition cursor-pointer"
              >
                <i
                  className={`bi ${
                    isUploadingAvatar
                      ? "bi-arrow-repeat animate-spin"
                      : "bi-camera-fill"
                  } text-xs`}
                  aria-hidden="true"
                />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-fajar/45 bg-fajar/15 px-3 py-0.5 text-[11px] font-extrabold text-fajar">
                  <i className="bi bi-shield-check" aria-hidden="true" />
                  <span>{authCtx.user.role}</span>
                </span>

                {isOAuthAccount ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/45 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
                    <i className="bi bi-google text-[10px]" aria-hidden="true" />
                    <span>Tersambung Google OAuth</span>
                  </span>
                ) : null}

                {isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-300">
                    <i
                      className="bi bi-patch-check-fill text-sky-400"
                      aria-hidden="true"
                    />
                    <span>OTP Email Aktif</span>
                  </span>
                ) : null}
              </div>

              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-kabut truncate">
                  {name || authCtx.user.name}
                </h2>
                <p className="text-xs sm:text-sm font-mono text-kabut/70 truncate">
                  {authCtx.user.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ui btn-fajar min-h-[36px] py-1.5 px-3.5 text-xs font-bold"
                >
                  <i className="bi bi-camera-fill text-xs" aria-hidden="true" />
                  <span>{avatarUrl ? "Ganti Foto" : "Unggah Foto"}</span>
                </button>

                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={handleDeleteAvatar}
                    className="btn-ui btn-danger-ui min-h-[36px] py-1.5 px-3 text-xs font-bold"
                  >
                    <i className="bi bi-trash text-xs" aria-hidden="true" />
                    <span>Hapus Foto</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => openVerifyModal("email")}
                  className="btn-ui btn-glass min-h-[36px] py-1.5 px-3.5 text-xs font-bold"
                >
                  <i
                    className="bi bi-envelope-check-fill text-fajar text-xs"
                    aria-hidden="true"
                  />
                  <span>
                    {isEmailVerified ? "Uji / Kirim OTP Email" : "Verifikasi OTP Email"}
                  </span>
                </button>
              </div>

              {avatarError ? (
                <p className="text-xs text-red-300 font-medium">{avatarError}</p>
              ) : null}
            </div>
          </div>

          {/* Kartu Kelengkapan Profil */}
          <div className="w-full lg:w-72 rounded-2xl border border-white/12 bg-obsidian/80 p-4 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-kabut/85 flex items-center gap-1.5">
                <i className="bi bi-person-check-fill text-fajar" aria-hidden="true" />
                <span>Kelengkapan Identitas</span>
              </span>
              <span className="font-unbounded text-sm font-black text-fajar">
                {completeness}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-hutan border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fajar via-amber-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="text-[11px] text-kabut/65 leading-relaxed">
              {completeness === 100
                ? "Identitas pendaki & kontak darurat Anda telah lengkap 100%."
                : "Lengkapi NIK e-KTP, alamat domisili, dan kontak darurat untuk percepatan manifes pos pendakian."}
            </p>
          </div>
        </div>

        {/* 4 Pilar Status Keamanan & Verifikasi */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pilar 1: OTP Email */}
          <div className="rounded-2xl border border-white/10 bg-obsidian/75 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isEmailVerified
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/35"
                }`}
              >
                <i className="bi bi-envelope-check-fill text-sm" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-kabut truncate">OTP Email</p>
                <p className="text-[10px] text-emerald-300 font-semibold truncate">
                  {isEmailVerified
                    ? isOAuthAccount
                      ? "Tercatat via Google"
                      : "Terverifikasi Resmi"
                    : "Menunggu Verifikasi"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openVerifyModal("email")}
              className="btn-ui btn-glass min-h-[32px] px-2.5 py-1 text-[11px] font-bold shrink-0"
            >
              <span>{isEmailVerified ? "Kirim OTP" : "Verifikasi"}</span>
            </button>
          </div>

          {/* Pilar 2: OTP WhatsApp */}
          <div className="rounded-2xl border border-white/10 bg-obsidian/75 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isWhatsappVerified
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/35"
                }`}
              >
                <i className="bi bi-whatsapp text-sm" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-kabut truncate">
                  OTP WhatsApp
                </p>
                <p
                  className={`text-[10px] font-semibold truncate ${
                    isWhatsappVerified ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {isWhatsappVerified ? "Nomor Terverifikasi" : "Belum Verifikasi"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openVerifyModal("whatsapp")}
              className="btn-ui btn-glass min-h-[32px] px-2.5 py-1 text-[11px] font-bold shrink-0"
            >
              <span>{isWhatsappVerified ? "Uji OTP" : "Verifikasi"}</span>
            </button>
          </div>

          {/* Pilar 3: Status NIK e-KTP */}
          <div className="rounded-2xl border border-white/10 bg-obsidian/75 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  memberNikValidation?.isValid
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                    : "bg-white/5 text-kabut/60 border border-white/10"
                }`}
              >
                <i className="bi bi-credit-card-2-front-fill text-sm" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-kabut truncate">
                  Manifes e-KTP
                </p>
                <p
                  className={`text-[10px] font-semibold truncate ${
                    memberNikValidation?.isValid
                      ? "text-emerald-300"
                      : "text-kabut/60"
                  }`}
                >
                  {memberNikValidation?.isValid
                    ? "16 Digit Sah Dukcapil"
                    : "Belum Dilengkapi"}
                </p>
              </div>
            </div>
          </div>

          {/* Pilar 4: Authenticator 2FA */}
          <div className="rounded-2xl border border-white/10 bg-obsidian/75 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  authCtx.user.twoFactorEnabled
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                    : "bg-amber-500/15 text-amber-300 border border-amber-500/35"
                }`}
              >
                <i className="bi bi-shield-lock-fill text-sm" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-kabut truncate">
                  Keamanan 2FA
                </p>
                <p
                  className={`text-[10px] font-semibold truncate ${
                    authCtx.user.twoFactorEnabled
                      ? "text-emerald-300"
                      : "text-amber-300"
                  }`}
                >
                  {authCtx.user.twoFactorEnabled
                    ? "TOTP RFC-6238 Aktif"
                    : "Opsional / Belum Aktif"}
                </p>
              </div>
            </div>
            {!authCtx.user.twoFactorEnabled ? (
              <button
                type="button"
                onClick={() => router.push("/verifikasi-2fa?setup=1")}
                className="btn-ui btn-fajar min-h-[32px] px-2.5 py-1 text-[11px] font-bold shrink-0"
              >
                <span>Pasang</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* =====================================================================
       * 2. GRID FORM PROFIL PENDAKI & KEAMANAN KREDENSIAL
       * ===================================================================== */}
      <div className="grid gap-7 lg:grid-cols-12 items-start">
        {/* KOLOM KIRI (7 KOLOM): FORM INFORMASI PROFIL & DOMISILI */}
        <section className="lg:col-span-7 surface-solid-dark p-5 sm:p-7 rounded-3xl border border-telaga-700/60 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div>
              <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
                <i className="bi bi-person-badge text-fajar" aria-hidden="true" />
                <span>{t("profileInfoSection")}</span>
              </h3>
              <p className="text-xs text-kabut/65 mt-0.5">
                Data resmi pemegang tiket dan manifes keselamatan pendakian Desa Cupang.
              </p>
            </div>
          </div>

          {profileSuccess ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-200 flex items-center gap-2">
              <i
                className="bi bi-check-circle-fill text-emerald-400 text-sm shrink-0"
                aria-hidden="true"
              />
              <span>{profileSuccess}</span>
            </div>
          ) : null}

          {profileError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-200 flex items-center gap-2">
              <i
                className="bi bi-exclamation-triangle-fill text-red-400 text-sm shrink-0"
                aria-hidden="true"
              />
              <span>{profileError}</span>
            </div>
          ) : null}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-3 text-sm text-kabut focus:border-fajar focus:outline-none transition"
                />
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
                      <i
                        className="bi bi-patch-check-fill text-emerald-400"
                        aria-hidden="true"
                      />
                      Terverifikasi
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openVerifyModal("whatsapp")}
                      className="text-[10px] font-bold text-fajar hover:underline cursor-pointer"
                    >
                      Verifikasi OTP WA →
                    </button>
                  )}
                </div>
                <input
                  id="profile-whatsapp"
                  data-testid="profile-whatsapp-input"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+628..."
                  className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-3 text-sm text-kabut focus:border-fajar focus:outline-none transition"
                />
              </div>
            </div>

            {/* Alamat Email Resmi & Tombol OTP Email */}
            <div className="rounded-2xl border border-white/10 bg-obsidian/55 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="profile-email"
                  className="block text-xs font-bold text-kabut/90 flex items-center gap-1.5"
                >
                  <i className="bi bi-envelope-at-fill text-fajar" aria-hidden="true" />
                  <span>{t("profileEmailLabel")}</span>
                </label>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  <i
                    className="bi bi-patch-check-fill text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>
                    {isOAuthAccount
                      ? "Tercatat Otomatis via Login Google"
                      : isEmailVerified
                      ? "Terverifikasi"
                      : "Aktif"}
                  </span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  id="profile-email"
                  type="email"
                  value={authCtx.user.email}
                  disabled
                  className="flex-1 rounded-xl border border-telaga-700/50 bg-obsidian/60 p-2.5 text-sm font-mono text-kabut/80 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => openVerifyModal("email")}
                  className="btn-ui btn-fajar min-h-[40px] px-3.5 py-2 text-xs font-bold shrink-0"
                >
                  <i className="bi bi-envelope-check-fill" aria-hidden="true" />
                  <span>Kirim Kode OTP Email</span>
                </button>
              </div>
              <p className="text-[11px] text-kabut/65">
                Email ini dapat digunakan untuk masuk langsung dengan{" "}
                <strong className="text-fajar">OTP Email</strong> di halaman
                masuk serta menerima PDF E-Tiket resmi.
              </p>
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
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                placeholder="Tuliskan pengalaman hiking, minat alam bebas, atau catatan khusus pendakian Anda..."
                className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-3 text-xs text-kabut focus:border-fajar focus:outline-none resize-none transition"
              />
            </div>

            {/* NIK KTP Member / Ketua Rombongan */}
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="profile-nik"
                  className="block text-xs font-bold text-kabut/90 flex items-center gap-1.5"
                >
                  <i className="bi bi-credit-card-2-front-fill text-fajar" aria-hidden="true" />
                  <span>NIK e-KTP Pemilik Akun / Ketua Rombongan</span>
                </label>
                {memberNikValidation ? (
                  memberNikValidation.isValid ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      <i
                        className="bi bi-patch-check-fill text-emerald-400"
                        aria-hidden="true"
                      />
                      NIK Sah Dukcapil
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
                      <i
                        className="bi bi-exclamation-octagon-fill text-red-400"
                        aria-hidden="true"
                      />
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
                    const matchProv = INDONESIAN_PROVINCES.find(
                      (p) => p.code === val.slice(0, 2)
                    );
                    if (matchProv) setProvince(matchProv.name);
                  }
                }}
                placeholder="16 digit NIK sesuai e-KTP resmi"
                className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs font-mono tracking-wider text-kabut focus:border-fajar focus:outline-none"
              />

              {memberNikValidation ? (
                memberNikValidation.isValid && memberNikValidation.data ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-2.5 text-[11px] text-emerald-200 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                    <span>
                      •{" "}
                      {memberNikValidation.data.gender === "LAKI_LAKI"
                        ? "Laki-laki"
                        : "Perempuan"}
                    </span>
                    <span>
                      • Lahir:{" "}
                      {String(memberNikValidation.data.birthDay).padStart(
                        2,
                        "0"
                      )}
                      /
                      {String(memberNikValidation.data.birthMonth).padStart(
                        2,
                        "0"
                      )}
                      /19
                      {memberNikValidation.data.birthYearSuffix < 30
                        ? "20" +
                          String(
                            memberNikValidation.data.birthYearSuffix
                          ).padStart(2, "0")
                        : String(
                            memberNikValidation.data.birthYearSuffix
                          ).padStart(2, "0")}
                    </span>
                    {memberNikValidation.data.provinceName ? (
                      <span>• {memberNikValidation.data.provinceName}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <i
                      className="bi bi-info-circle text-xs"
                      aria-hidden="true"
                    />
                    <span>{memberNikValidation.message}</span>
                  </p>
                )
              ) : (
                <p className="text-[11px] text-kabut/55">
                  Digunakan untuk manifes asuransi keselamatan pendakian Gunung
                  Bendera &amp; Batu Lawang.
                </p>
              )}
            </div>

            {/* Alamat Domisili Lengkap & Terstruktur */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-bold text-kabut/90 flex items-center gap-1.5 pb-1.5 border-b border-white/8">
                <i className="bi bi-geo-alt-fill text-fajar" aria-hidden="true" />
                <span>Alamat Domisili Lengkap (Sesuai KTP)</span>
              </p>

              <div>
                <label
                  htmlFor="profile-address"
                  className="block text-[11px] font-bold text-kabut/80 mb-1"
                >
                  Alamat Jalan / Dusun / RT / RW / No. Rumah
                </label>
                <textarea
                  id="profile-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Pangeran Kejaksan No. 12, RT 03 / RW 05, Desa Cupang"
                  className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="profile-province"
                    className="block text-[11px] font-bold text-kabut/80 mb-1"
                  >
                    Provinsi
                  </label>
                  <select
                    id="profile-province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
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
                  <label
                    htmlFor="profile-city"
                    className="block text-[11px] font-bold text-kabut/80 mb-1"
                  >
                    Kota / Kabupaten
                  </label>
                  <input
                    id="profile-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Contoh: Kabupaten Cirebon"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="profile-district"
                    className="block text-[11px] font-bold text-kabut/80 mb-1"
                  >
                    Kecamatan / Kelurahan
                  </label>
                  <input
                    id="profile-district"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Contoh: Gempol / Cupang"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-postal"
                    className="block text-[11px] font-bold text-kabut/80 mb-1"
                  >
                    Kode Pos (5 Digit)
                  </label>
                  <input
                    id="profile-postal"
                    type="text"
                    maxLength={5}
                    inputMode="numeric"
                    value={postalCode}
                    onChange={(e) =>
                      setPostalCode(
                        e.target.value.replace(/\D/g, "").slice(0, 5)
                      )
                    }
                    placeholder="45161"
                    className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs font-mono text-kabut focus:border-fajar focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Kontak Darurat Keluarga */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-1.5">
              <label
                htmlFor="profile-emergency"
                className="block text-xs font-bold text-kabut/90 flex items-center gap-1.5"
              >
                <i
                  className="bi bi-telephone-fill text-fajar"
                  aria-hidden="true"
                />
                <span>Kontak Darurat Keluarga Terdekat (Tim SAR)</span>
              </label>
              <input
                id="profile-emergency"
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Contoh: Budi Santoso (Ayah) - 081234567890"
                className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/75 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
              />
              <p className="text-[11px] text-kabut/55">
                Dihubungi pos pemantau jika terjadi kendala darurat di jalur
                pendakian.
              </p>
            </div>

            <button
              type="submit"
              data-testid="profile-save-btn"
              disabled={isSavingProfile}
              className="btn-ui btn-fajar w-full sm:w-auto rounded-xl px-6 py-3 text-xs font-bold"
            >
              {isSavingProfile ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin"
                    aria-hidden="true"
                  />
                  <span>{t("profileSavingBtn")}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check2-circle" aria-hidden="true" />
                  <span>{t("profileSaveBtn")}</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* KOLOM KANAN (5 KOLOM): KATA SANDI, KEAMANAN 2FA & REKAN PENDAKI */}
        <div className="lg:col-span-5 space-y-6">
          {/* Kartu Kata Sandi & Kredensial */}
          <section className="surface-solid-dark p-5 sm:p-6 rounded-3xl border border-telaga-700/60 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div>
                <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
                  <i className="bi bi-key-fill text-fajar" aria-hidden="true" />
                  <span>{t("passwordSection")}</span>
                </h3>
                <p className="text-xs text-kabut/65 mt-0.5">
                  Kelola kata sandi masuk untuk akun {authCtx.user.email}.
                </p>
              </div>
            </div>

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
                className="btn-ui btn-hutan w-full rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                {isChangingPassword ? (
                  <>
                    <i
                      className="bi bi-arrow-repeat animate-spin"
                      aria-hidden="true"
                    />
                    <span>{t("changingPasswordBtn")}</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-lock-fill" aria-hidden="true" />
                    <span>{t("changePasswordBtn")}</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Kartu Proteksi 2FA TOTP */}
          <section className="surface-solid-dark p-5 sm:p-6 rounded-3xl border border-telaga-700/60 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
                    authCtx.user.twoFactorEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-fajar border border-fajar/40"
                  }`}
                >
                  <i
                    className={`bi ${
                      authCtx.user.twoFactorEnabled
                        ? "bi-shield-fill-check"
                        : "bi-shield-exclamation"
                    }`}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="font-heading text-base font-bold text-kabut">
                    Autentikasi Dua Faktor (2FA TOTP)
                  </h3>
                  <p className="text-xs text-kabut/70">
                    {authCtx.user.twoFactorEnabled
                      ? "Terhubung dengan aplikasi Authenticator RFC-6238."
                      : "Lindungi tiket & transaksi dengan kode 6 digit Authenticator."}
                  </p>
                </div>
              </div>
            </div>

            {!authCtx.user.twoFactorEnabled ? (
              <button
                type="button"
                onClick={() => router.push("/verifikasi-2fa?setup=1")}
                className="btn-ui btn-fajar w-full rounded-xl py-2.5 text-xs font-bold"
              >
                <i className="bi bi-qr-code-scan" aria-hidden="true" />
                <span>Aktifkan Google Authenticator (2FA)</span>
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-200 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <i className="bi bi-check-circle-fill text-emerald-400" />
                  <span>Proteksi 2FA Aktif</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  RFC-6238
                </span>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* =====================================================================
       * 3. SEKSI PROFIL REKAN PENDAKI / ANGGOTA KELUARGA TERDAFTAR
       * ===================================================================== */}
      <section className="surface-solid-dark p-5 sm:p-7 rounded-3xl border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
                <i className="bi bi-people-fill text-fajar" aria-hidden="true" />
                <span>Profil Rekan Pendaki &amp; Rombongan</span>
              </h3>
              <span className="rounded-full bg-fajar/15 border border-fajar/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-fajar">
                {companions.length} Tersimpan
              </span>
            </div>
            <p className="mt-1 text-xs text-kabut/70">
              Simpan data identitas anggota rombongan atau keluarga agar
              pemesanan tiket mendaki berikutnya lebih cepat.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompanionError(null);
              setIsCompanionModalOpen(true);
            }}
            className="btn-ui btn-fajar whitespace-nowrap text-xs font-bold px-4 py-2.5 rounded-xl shrink-0"
          >
            <i className="bi bi-person-plus-fill text-sm" aria-hidden="true" />
            <span>Tambah Rekan Pendaki</span>
          </button>
        </div>

        {companions.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-obsidian/50 p-6 text-center text-xs text-kabut/65 space-y-2">
            <i
              className="bi bi-person-vcard text-3xl text-fajar/50"
              aria-hidden="true"
            />
            <p className="font-semibold text-kabut/85">
              Belum ada profil rekan pendaki yang disimpan.
            </p>
            <p className="text-[11px] text-kabut/55">
              Klik &ldquo;Tambah Rekan Pendaki&rdquo; untuk mendaftarkan
              identitas teman atau keluarga Anda.
            </p>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {companions.map((comp) => (
              <div
                key={comp.id}
                className="rounded-2xl border border-white/10 bg-obsidian/65 p-4 flex flex-col justify-between gap-3 hover:border-fajar/40 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="font-heading text-sm font-bold text-kabut truncate"
                      title={comp.name}
                    >
                      {comp.name}
                    </p>
                    <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-mono text-kabut/80">
                      {comp.relation || "Rekan"}
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[11px] font-mono text-kabut/75">
                    {comp.identityNumber ? (
                      <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-950/35 border border-emerald-500/25 rounded-lg px-2 py-0.5">
                        <i className="bi bi-shield-check" aria-hidden="true" />
                        <span>NIK: {comp.identityNumber}</span>
                      </div>
                    ) : null}
                    {comp.phone ? (
                      <p className="truncate flex items-center gap-1.5 text-kabut/70">
                        <i className="bi bi-whatsapp text-emerald-400 text-xs" />
                        <span>{comp.phone}</span>
                      </p>
                    ) : null}
                    {comp.age ? (
                      <p className="text-kabut/65">Usia: {comp.age} tahun</p>
                    ) : null}
                    {comp.notes ? (
                      <p className="text-kabut/50 italic truncate mt-1">
                        &ldquo;{comp.notes}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/8">
                  <button
                    type="button"
                    onClick={() => handleDeleteCompanion(comp.id)}
                    className="btn-ui btn-danger-ui min-h-[32px] px-2.5 py-1 text-[11px] font-bold"
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
          <div className="w-full max-w-md rounded-3xl bg-hutan border border-white/20 p-6 shadow-2xl text-kabut space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-heading text-base font-bold flex items-center gap-2">
                <i
                  className="bi bi-person-plus-fill text-fajar"
                  aria-hidden="true"
                />
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

            <form
              onSubmit={handleAddCompanion}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-kabut/90">
                  Nama Lengkap *
                </label>
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
                  <label className="block font-bold text-kabut/90">
                    Hubungan
                  </label>
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
                  <label className="block font-bold text-kabut/90">
                    Usia (Tahun)
                  </label>
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
                        <i
                          className="bi bi-patch-check-fill"
                          aria-hidden="true"
                        />
                        Sah Dukcapil
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                        <i
                          className="bi bi-exclamation-octagon-fill"
                          aria-hidden="true"
                        />
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
                  onChange={(e) =>
                    setCompanionIdNumber(
                      e.target.value.replace(/\D/g, "").slice(0, 16)
                    )
                  }
                  placeholder="16 digit NIK resmi anggota rombongan"
                  className="w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs font-mono text-kabut focus:border-fajar focus:outline-none"
                />

                {companionNikValidation ? (
                  companionNikValidation.isValid &&
                  companionNikValidation.data ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2 text-[10px] text-emerald-200 flex flex-wrap gap-x-2 font-mono">
                      <span>
                        ✓{" "}
                        {companionNikValidation.data.gender === "LAKI_LAKI"
                          ? "Laki-laki"
                          : "Perempuan"}
                      </span>
                      <span>
                        • Lahir:{" "}
                        {String(companionNikValidation.data.birthDay).padStart(
                          2,
                          "0"
                        )}
                        /
                        {String(
                          companionNikValidation.data.birthMonth
                        ).padStart(2, "0")}
                        /19
                        {companionNikValidation.data.birthYearSuffix < 30
                          ? "20" +
                            String(
                              companionNikValidation.data.birthYearSuffix
                            ).padStart(2, "0")
                          : String(
                              companionNikValidation.data.birthYearSuffix
                            ).padStart(2, "0")}
                      </span>
                      {companionNikValidation.data.provinceName ? (
                        <span>
                          • {companionNikValidation.data.provinceName}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[10px] text-red-400 flex items-center gap-1">
                      <i
                        className="bi bi-info-circle text-xs"
                        aria-hidden="true"
                      />
                      <span>{companionNikValidation.message}</span>
                    </p>
                  )
                ) : (
                  <p className="text-[10px] text-kabut/45">
                    Wajib 16 digit sesuai e-KTP untuk manifes tiket rombongan
                    &amp; asuransi pendakian.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-kabut/90">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  value={companionPhone}
                  onChange={(e) => setCompanionPhone(e.target.value)}
                  placeholder="08..."
                  className="mt-1 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-kabut/90">
                  Catatan Khusus (Opsional)
                </label>
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
                  className="btn-ui btn-glass py-2 px-3.5 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isSavingCompanion ||
                    !companionNikValidation?.isValid ||
                    !companionName.trim()
                  }
                  className="btn-ui btn-fajar py-2 px-4 text-xs font-bold disabled:opacity-50"
                >
                  {isSavingCompanion ? "Menyimpan..." : "Simpan Profil Rekan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
       * 4. HAK PRIVASI UU PDP (PORTABILITAS & PENGHAPUSAN AKUN)
       * ===================================================================== */}
      <section className="surface-solid-dark p-5 sm:p-7 rounded-3xl border border-telaga-700/60 space-y-5">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-telaga-800/40 border border-telaga-600 px-3 py-1 text-xs font-bold text-fajar">
            <i className="bi bi-shield-shaded" aria-hidden="true" />
            <span>{t("pdpLawBadge")}</span>
          </span>
          <h3 className="mt-2.5 font-heading text-xl font-bold text-kabut">
            {t("pdpSection")}
          </h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Ekspor Data */}
          <div className="rounded-2xl border border-telaga-700/50 bg-obsidian/55 p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-kabut flex items-center gap-2">
                <i
                  className="bi bi-file-earmark-code-fill text-fajar"
                  aria-hidden="true"
                />
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
                    className="bi bi-arrow-repeat animate-spin"
                    aria-hidden="true"
                  />
                  <span>{t("pdpExportingBtn")}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-download" aria-hidden="true" />
                  <span>{t("pdpExportBtn")}</span>
                </>
              )}
            </button>
          </div>

          {/* Hapus / Anonimkan Akun */}
          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-red-300 flex items-center gap-2">
                <i
                  className="bi bi-person-x-fill text-red-400"
                  aria-hidden="true"
                />
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
              className="btn-ui btn-danger-ui w-full rounded-xl py-2.5 text-xs font-bold"
            >
              <i className="bi bi-trash-fill" aria-hidden="true" />
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
            className="w-full max-w-md rounded-3xl bg-hutan border border-red-500/60 p-6 shadow-2xl text-kabut space-y-5"
          >
            <div className="flex items-center gap-3 text-red-400">
              <i
                className="bi bi-exclamation-triangle-fill text-2xl"
                aria-hidden="true"
              />
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
                  className="btn-ui btn-glass rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  data-testid="confirm-delete-account-btn"
                  disabled={isDeleting || !deletePassword}
                  className="btn-ui btn-danger-ui rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <i
                        className="bi bi-arrow-repeat animate-spin"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/88 backdrop-blur-xl animate-fade-in">
          <div className="surface-solid-dark w-full max-w-md p-6 sm:p-7 rounded-3xl border border-white/20 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setIsVerifyModalOpen(false)}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-kabut hover:text-white transition cursor-pointer"
              aria-label="Tutup modal"
            >
              <i className="bi bi-x-lg text-sm" />
            </button>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fajar/15 border border-fajar/35 text-xs font-bold text-fajar mb-1">
                <i
                  className={`bi ${
                    verifyModalChannel === "email"
                      ? "bi-envelope-check-fill"
                      : "bi-whatsapp"
                  }`}
                />
                <span>
                  {verifyModalChannel === "email"
                    ? "Verifikasi OTP Email Resmi"
                    : "Verifikasi WhatsApp Resmi"}
                </span>
              </div>
              <h3 className="font-heading text-xl font-bold text-kabut">
                {verifyModalChannel === "email"
                  ? "Verifikasi Alamat Email"
                  : "Verifikasi Nomor WhatsApp"}
              </h3>
              <p className="text-xs text-kabut/75 leading-relaxed">
                {verifyModalChannel === "email"
                  ? `Kode OTP 6 digit akan dikirimkan ke alamat email ${authCtx.user.email} Anda.`
                  : "Kode OTP 6 digit dikirimkan melalui layanan resmi ke nomor WhatsApp Anda."}
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
                  setProfileSuccess(
                    "Alamat email Anda telah berhasil diverifikasi via OTP!"
                  );
                } else {
                  setIsWhatsappVerified(true);
                  setProfileSuccess(
                    "Nomor WhatsApp Anda telah berhasil diverifikasi!"
                  );
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

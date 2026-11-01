"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { PasswordInput } from "@/components/auth/PasswordInput";

export interface MemberProfileTabProps {
  authCtx: AuthenticatedContext;
}

export function MemberProfileTab({ authCtx }: MemberProfileTabProps) {
  const t = useTranslations("MemberDashboard");
  const router = useRouter();
  const [name, setName] = useState(authCtx.user.name);
  const [whatsapp, setWhatsapp] = useState(authCtx.user.whatsapp ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

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

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, whatsapp }),
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
              <label
                htmlFor="profile-email"
                className="block text-xs font-bold text-kabut/90"
              >
                {t("profileEmailLabel")}
              </label>
              <input
                id="profile-email"
                type="email"
                value={authCtx.user.email}
                disabled
                className="mt-1.5 w-full rounded-xl border border-telaga-700/50 bg-obsidian/40 p-3 text-sm text-kabut/60 cursor-not-allowed"
              />
            </div>

            <div>
              <label
                htmlFor="profile-whatsapp"
                className="block text-xs font-bold text-kabut/90"
              >
                {t("profileWaLabel")}
              </label>
              <input
                id="profile-whatsapp"
                data-testid="profile-whatsapp-input"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+628..."
                className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-sm text-kabut focus:border-fajar focus:outline-none"
              />
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
    </div>
  );
}

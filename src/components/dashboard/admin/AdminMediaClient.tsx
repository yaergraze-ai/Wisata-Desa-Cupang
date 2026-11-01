"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { MediaSlotItemDto } from "@/server/media/media-service";

export interface AdminMediaClientProps {
  locale: AppLocale;
}

export function AdminMediaClient({ locale }: AdminMediaClientProps) {
  const t = useTranslations("AdminMedia");
  const [slots, setSlots] = useState<MediaSlotItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [activeSlot, setActiveSlot] = useState<MediaSlotItemDto | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [altId, setAltId] = useState("");
  const [altEn, setAltEn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [restoringSlot, setRestoringSlot] = useState<string | null>(null);

  async function fetchSlots() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/media");
      if (!res.ok) throw new Error("Gagal memuat slot media.");
      const data = (await res.json()) as { slots: MediaSlotItemDto[] };
      setSlots(data.slots);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat slot media."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/admin/media");
        if (!res.ok) throw new Error("Gagal memuat slot media.");
        const data = (await res.json()) as { slots: MediaSlotItemDto[] };
        if (!ignore) {
          setSlots(data.slots);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Gagal memuat slot media."
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  function handleOpenReplaceModal(slotItem: MediaSlotItemDto) {
    setActiveSlot(slotItem);
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setAltId(slotItem.asset.altId);
    setAltEn(slotItem.asset.altEn);
    setModalError(null);
  }

  function handleCloseModal() {
    setActiveSlot(null);
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setModalError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    if (selected.size > 8 * 1024 * 1024) {
      setModalError("Ukuran berkas melebihi batas 8 MB.");
      return;
    }
    setFile(selected);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(URL.createObjectURL(selected));
    setModalError(null);
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSlot || !file) {
      setModalError("Pilih berkas gambar terlebih dahulu.");
      return;
    }

    if (altId.trim().length < 5 || altEn.trim().length < 5) {
      setModalError("Deskripsi alternatif (altId & altEn) minimal 5 karakter.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const formData = new FormData();
      formData.append("slot", activeSlot.slot);
      formData.append("file", file);
      formData.append("altId", altId.trim());
      formData.append("altEn", altEn.trim());

      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Gagal memperbarui aset media.");
      }

      await fetchSlots();
      handleCloseModal();
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Gagal memperbarui aset media."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestoreDefault(slotKey: string) {
    setRestoringSlot(slotKey);
    try {
      const res = await fetch("/api/admin/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: slotKey }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Gagal mengembalikan aset bawaan.");
      }
      await fetchSlots();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengembalikan aset.");
    } finally {
      setRestoringSlot(null);
    }
  }

  return (
    <div className="surface-solid-dark p-4 sm:p-6 rounded-2xl border border-telaga-700/60 space-y-6 sm:space-y-8" data-testid="admin-media-client">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-hutan border border-telaga-700 px-3 py-1 text-xs font-bold text-fajar">
          <i className="bi bi-images" aria-hidden="true" />
          <span>{t("badge13Slots")}</span>
        </span>
        <h2 className="mt-2.5 font-heading text-xl font-bold text-kabut sm:text-2xl md:text-3xl">
          {t("heading")}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-kabut/80 leading-relaxed">
          {t("lead")}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-sm text-kabut/70">
          <i className="bi bi-arrow-repeat animate-spin mr-2 text-fajar text-lg" />
          <span>{t("loadingSlots")}</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="p-8 text-center text-sm text-kabut/60 rounded-xl border border-telaga-700/30 bg-obsidian/40">
          {t("emptySlots")}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((item) => {
            const isDefault = item.asset.isDefault;
            const label = locale === "en" ? item.labelEn : item.labelId;
            const currentAlt = locale === "en" ? item.asset.altEn : item.asset.altId;
            const sizeKb = Math.round(item.asset.sizeBytes / 1024);

            return (
              <article
                key={item.id}
                data-testid={`media-slot-card-${item.slot}`}
                className="surface-solid-dark rounded-2xl border border-telaga-700/60 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full bg-obsidian border-b border-telaga-700/50 overflow-hidden group">
                    <Image
                      src={item.asset.url}
                      alt={currentAlt || item.slot}
                      fill
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="rounded-md bg-obsidian/90 px-2 py-0.5 text-[11px] font-mono font-bold text-kabut border border-telaga-700">
                        {item.slot}
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isDefault
                            ? "bg-hutan/90 text-fajar border border-fajar/30"
                            : "bg-amber-900/90 text-amber-200 border border-amber-500/40"
                        }`}
                      >
                        {isDefault ? t("isDefaultBadge") : t("isCustomBadge")}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2.5">
                    <h3 className="font-heading text-sm font-bold text-kabut line-clamp-1">
                      {label}
                    </h3>

                    <p className="text-[11px] font-mono text-kabut/70">
                      {t("dimensions", {
                        width: item.asset.width,
                        height: item.asset.height,
                        size: sizeKb,
                      })}
                    </p>

                    <div className="rounded-lg bg-obsidian/60 p-2.5 text-[11px] text-kabut/80 border border-telaga-700/40">
                      <p className="font-semibold text-fajar/90">
                        {locale === "en" ? t("altEnLabel") : t("altIdLabel")}:
                      </p>
                      <p className="mt-0.5 line-clamp-2 italic">
                        {currentAlt}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-0 flex items-center gap-2">
                  <button
                    type="button"
                    data-testid={`replace-btn-${item.slot}`}
                    onClick={() => handleOpenReplaceModal(item)}
                    className="btn-ui btn-fajar flex-1 rounded-xl py-2 text-xs font-bold"
                  >
                    <i className="bi bi-upload mr-1" aria-hidden="true" />
                    <span>{t("replacePhotoBtn")}</span>
                  </button>

                  {!isDefault ? (
                    <button
                      type="button"
                      data-testid={`restore-btn-${item.slot}`}
                      onClick={() => handleRestoreDefault(item.slot)}
                      disabled={restoringSlot === item.slot}
                      className="btn-ui rounded-xl border border-telaga-700 bg-obsidian/80 px-3 py-2 text-xs font-semibold text-kabut hover:bg-obsidian transition"
                      title={t("restoreDefaultBtn")}
                    >
                      {restoringSlot === item.slot ? (
                        <i className="bi bi-arrow-repeat animate-spin text-fajar" />
                      ) : (
                        <i className="bi bi-arrow-counterclockwise" />
                      )}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Unggah Pengganti */}
      {activeSlot ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-obsidian/85 backdrop-blur-md overflow-y-auto"
        >
          <div
            data-testid="admin-media-modal-content"
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-hutan border border-telaga-700/60 p-4 sm:p-6 shadow-2xl text-kabut space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-bold sm:text-xl">
                  {t("uploadModalTitle", { slot: activeSlot.slot })}
                </h3>
                <p className="text-xs text-kabut/70 mt-0.5">
                  {locale === "en" ? activeSlot.labelEn : activeSlot.labelId}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1 text-kabut/70 hover:bg-obsidian hover:text-kabut"
              >
                <i className="bi bi-x-lg text-lg" aria-hidden="true" />
              </button>
            </div>

            {modalError ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200"
              >
                {modalError}
              </div>
            ) : null}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-xs font-bold text-kabut/90">
                  {t("fileInputLabel")}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  required
                  data-testid="admin-media-file-input"
                  className="mt-1.5 w-full text-xs text-kabut file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-fajar file:text-obsidian hover:file:opacity-90"
                />
              </div>

              {filePreview ? (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-telaga-700 bg-obsidian">
                  <Image
                    src={filePreview}
                    alt={t("previewAlt")}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              ) : null}

              {/* altId */}
              <div>
                <label
                  htmlFor="alt-id"
                  className="block text-xs font-bold text-kabut/90"
                >
                  {t("altIdLabel")} *
                </label>
                <input
                  id="alt-id"
                  data-testid="admin-media-alt-id-input"
                  type="text"
                  value={altId}
                  onChange={(e) => setAltId(e.target.value)}
                  required
                  minLength={5}
                  className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              {/* altEn */}
              <div>
                <label
                  htmlFor="alt-en"
                  className="block text-xs font-bold text-kabut/90"
                >
                  {t("altEnLabel")} *
                </label>
                <input
                  id="alt-en"
                  data-testid="admin-media-alt-en-input"
                  type="text"
                  value={altEn}
                  onChange={(e) => setAltEn(e.target.value)}
                  required
                  minLength={5}
                  className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-2.5 text-xs text-kabut focus:border-fajar focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="btn-ui rounded-xl border border-telaga-700 bg-obsidian px-4 py-2 text-xs font-semibold"
                >
                  {t("cancelBtn")}
                </button>
                <button
                  type="submit"
                  data-testid="admin-media-submit-btn"
                  disabled={isSubmitting || !file}
                  className="btn-ui btn-fajar rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat animate-spin mr-1.5" />
                      <span>{t("savingMediaBtn")}</span>
                    </>
                  ) : (
                    <span>{t("saveAssetBtn")}</span>
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

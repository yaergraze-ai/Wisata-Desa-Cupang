"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { SerializedWalletTicket } from "@/server/orders/order-service";

export interface ReviewModalProps {
  ticket: SerializedWalletTicket;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewModal({
  ticket,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const t = useTranslations("MemberDashboard");
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    const combined = [...photos, ...selected].slice(0, 4);

    // Revoke old previews
    previews.forEach((p) => URL.revokeObjectURL(p));

    setPhotos(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
  }

  function handleRemovePhoto(index: number) {
    const nextPhotos = photos.filter((_, i) => i !== index);
    URL.revokeObjectURL(previews[index]!);
    const nextPreviews = previews.filter((_, i) => i !== index);
    setPhotos(nextPhotos);
    setPreviews(nextPreviews);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (comment.trim().length < 10) {
      setErrorMessage("Komentar ulasan minimal 10 karakter.");
      return;
    }
    if (comment.trim().length > 1000) {
      setErrorMessage("Komentar ulasan maksimal 1.000 karakter.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("ticketId", ticket.id);
      formData.append("rating", rating.toString());
      formData.append("comment", comment.trim());
      photos.forEach((file) => {
        formData.append("photos", file);
      });

      const res = await fetch("/api/reviews", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error || "Gagal mengirim ulasan.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengirim ulasan."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
    >
      <div
        data-testid="review-modal-content"
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-hutan border border-telaga-700/60 p-6 sm:p-7 shadow-2xl text-kabut space-y-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fajar/20 border border-fajar/40 px-2.5 py-0.5 text-xs font-bold text-fajar">
              <i className="bi bi-patch-check-fill" aria-hidden="true" />
              <span>{t("reviewSubmittedBadge")}</span>
            </span>
            <h3
              id="review-modal-title"
              className="mt-2 font-heading text-xl font-bold sm:text-2xl"
            >
              {t("reviewModalTitle")}
            </h3>
            <p className="mt-1 text-xs text-kabut/80">
              {t("reviewModalSubtitle", {
                code: ticket.publicCode,
                product: ticket.productName,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-kabut/70 hover:bg-obsidian/60 hover:text-kabut transition"
            aria-label={t("cancelModalBtn")}
          >
            <i className="bi bi-x-lg text-lg" aria-hidden="true" />
          </button>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Rating 1-5 Bintang */}
          <div>
            <label className="block text-xs font-bold text-kabut/90">
              {t("reviewRatingLabel")}
            </label>
            <div
              className="mt-2 flex items-center gap-2"
              data-testid="review-rating-stars"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    data-testid={`rating-star-${star}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-2xl transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fajar rounded"
                    aria-label={`${star} Bintang`}
                  >
                    <i
                      className={`bi ${isFilled ? "bi-star-fill text-fajar" : "bi-star text-kabut/30"}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-sm font-bold text-fajar">
                {rating} / 5
              </span>
            </div>
          </div>

          {/* Komentar */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="review-comment"
                className="text-xs font-bold text-kabut/90"
              >
                {t("reviewCommentLabel")}
              </label>
              <span className="text-[11px] text-kabut/60">
                {comment.length} / 1.000
              </span>
            </div>
            <textarea
              id="review-comment"
              data-testid="review-comment-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("reviewCommentPlaceholder")}
              rows={4}
              required
              minLength={10}
              maxLength={1000}
              className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-sm text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
            />
          </div>

          {/* Unggah Foto (Maks 4 foto) */}
          <div>
            <label className="block text-xs font-bold text-kabut/90">
              {t("reviewPhotosLabel")}
            </label>
            <p className="mt-0.5 text-[11px] text-kabut/70">
              <i
                className="bi bi-shield-check text-fajar mr-1"
                aria-hidden="true"
              />
              {t("reviewPhotosExifNotice")}
            </p>

            {photos.length < 4 ? (
              <label
                data-testid="review-photo-upload-label"
                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-telaga-700/80 bg-obsidian/50 p-4 text-xs font-semibold text-fajar hover:bg-obsidian/80 transition"
              >
                <i className="bi bi-camera-fill text-lg" aria-hidden="true" />
                <span>{t("choosePhotosBtn", { count: photos.length })}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            ) : null}

            {previews.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-telaga-700/80 group"
                  >
                    <Image
                      src={src}
                      alt={`Foto ulasan ${idx + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 rounded-full bg-obsidian/90 p-1 text-red-400 hover:text-red-200 transition"
                      aria-label={t("removePhotoAria")}
                    >
                      <i className="bi bi-trash-fill text-xs" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-ui rounded-xl border border-telaga-700 bg-obsidian/80 px-4 py-2.5 text-xs font-semibold text-kabut hover:bg-obsidian transition"
            >
              {t("cancelModalBtn")}
            </button>
            <button
              type="submit"
              data-testid="review-submit-button"
              disabled={isSubmitting || comment.trim().length < 10}
              className="btn-ui btn-fajar rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("reviewSubmittingBtn")}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill mr-1.5" aria-hidden="true" />
                  <span>{t("reviewSubmitBtn")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

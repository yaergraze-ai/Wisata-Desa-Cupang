"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AdminReviewItemDto } from "@/server/admin/admin-reviews-service";

export function AdminReviewsView() {
  const t = useTranslations("AdminDashboard");
  const [reviews, setReviews] = useState<AdminReviewItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Reply modal
  const [activeReplyReview, setActiveReplyReview] = useState<AdminReviewItemDto | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Photo preview modal
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    userName: string;
    comment: string;
  } | null>(null);

  async function loadReviews(p = 1, r = ratingFilter, s = statusFilter) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "15");
      if (r) params.set("rating", String(r));
      if (s === "PUBLISHED") params.set("isPublished", "true");
      if (s === "HIDDEN") params.set("isPublished", "false");

      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat ulasan.");
      const data = (await res.json()) as {
        reviews: AdminReviewItemDto[];
        total: number;
        page: number;
        totalPages: number;
      };
      setReviews(data.reviews);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat ulasan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "15");
        if (ratingFilter) params.set("rating", String(ratingFilter));
        if (statusFilter !== "ALL") {
          params.set("isPublished", statusFilter === "PUBLISHED" ? "true" : "false");
        }

        const res = await fetch(`/api/admin/reviews?${params.toString()}`);
        if (!res.ok) throw new Error("Gagal memuat ulasan.");
        const data = (await res.json()) as {
          reviews: AdminReviewItemDto[];
          total: number;
          page: number;
          totalPages: number;
        };
        if (!ignore) {
          setReviews(data.reviews);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat ulasan.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, [ratingFilter, statusFilter]);

  async function handleTogglePublish(reviewId: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          action: "togglePublish",
          isPublished: !currentStatus,
        }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui status publikasi.");
      await loadReviews(page, ratingFilter, statusFilter);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui ulasan.");
    }
  }

  async function handleSubmitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeReplyReview) return;
    setIsSubmittingReply(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: activeReplyReview.id,
          action: "reply",
          replyText,
        }),
      });
      if (!res.ok) throw new Error("Gagal mengirim balasan.");
      setActiveReplyReview(null);
      setReplyText("");
      await loadReviews(page, ratingFilter, statusFilter);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengirim balasan.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="admin-reviews-view">
      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("reviewsModerationTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("reviewsModerationSubtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ratingFilter ?? ""}
            onChange={(e) =>
              setRatingFilter(e.target.value ? Number(e.target.value) : undefined)
            }
            className="rounded-xl border border-telaga-700 bg-obsidian px-3 py-1.5 text-xs text-kabut"
          >
            <option value="">{t("allStatus")}</option>
            <option value="5">5 ★</option>
            <option value="4">4 ★</option>
            <option value="3">3 ★</option>
            <option value="2">2 ★</option>
            <option value="1">1 ★</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-telaga-700 bg-obsidian px-3 py-1.5 text-xs text-kabut"
          >
            <option value="ALL">{t("allStatus")}</option>
            <option value="PUBLISHED">{t("badgePublished")}</option>
            <option value="HIDDEN">{t("badgeHidden")}</option>
          </select>

          <span className="text-xs text-kabut/60">{t("totalRecords", { count: total })}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingReviews")}</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-300">{error}</div>
      ) : reviews.length === 0 ? (
        <div className="p-8 text-center text-kabut/60">{t("noReviewsFound")}</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-xl border border-telaga-700/60 bg-obsidian/60 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-telaga-700/30 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-kabut text-xs">{r.userName}</span>
                  <span className="font-mono text-[11px] text-fajar">
                    [{r.ticketPublicCode} - {r.productName}]
                  </span>
                  <div className="flex items-center text-fajar text-xs">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <i key={i} className="bi bi-star-fill mr-0.5" aria-hidden="true" />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.isPublished
                        ? "bg-green-950 text-green-300 border border-green-700/60"
                        : "bg-amber-950 text-amber-300 border border-amber-700/60"
                    }`}
                  >
                    {r.isPublished ? t("badgePublished") : t("badgeHidden")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(r.id, r.isPublished)}
                    className="rounded-lg bg-obsidian border border-telaga-700 px-2.5 py-1 text-[11px] font-semibold text-kabut hover:bg-obsidian/80"
                  >
                    {r.isPublished ? t("hideReviewBtn") : t("publishReviewBtn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReplyReview(r);
                      setReplyText(r.adminReply ?? "");
                    }}
                    className="rounded-lg bg-fajar/20 border border-fajar/40 px-2.5 py-1 text-[11px] font-semibold text-fajar hover:bg-fajar/30"
                  >
                    {t("replyReviewBtn")}
                  </button>
                </div>
              </div>

              {/* KOMENTAR & FOTO */}
              <p className="text-xs text-kabut/90 leading-relaxed">{r.comment}</p>

              {r.photos.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {r.photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({
                          url: p.url,
                          userName: r.userName,
                          comment: r.comment,
                        })
                      }
                      className="relative h-16 w-16 rounded-xl overflow-hidden border border-telaga-700 hover:border-fajar hover:scale-105 transition cursor-pointer shadow-sm"
                      title="Klik untuk melihat foto lebih besar"
                    >
                      <Image
                        src={p.url}
                        alt={r.userName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {/* BALASAN ADMIN */}
              {r.adminReply ? (
                <div className="p-3 rounded-xl bg-telaga-950/40 border border-telaga-700/50 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-fajar text-[11px]">
                    <i className="bi bi-reply-fill" aria-hidden="true" />
                    <span>{t("officialReplyHeading")} ({r.adminRepliedAt?.slice(0, 10)})</span>
                  </div>
                  <p className="text-kabut/85">{r.adminReply}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* MODAL BALAS ULASAN */}
      {activeReplyReview ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-5">
            <h3 className="font-heading text-lg font-bold">{t("replyModalTitle")}</h3>
            <p className="text-xs text-kabut/70 italic">{`“${activeReplyReview.comment}”`}</p>

            <form onSubmit={handleSubmitReply} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-kabut mb-1">
                  {t("replyContentLabel")}
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t("replyContentPlaceholder")}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut placeholder:text-kabut/40"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setActiveReplyReview(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReply || replyText.trim().length < 5}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSubmittingReply ? t("savingReplyBtn") : t("saveReplyBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL PRATINJAU FOTO ULASAN */}
      {previewPhoto ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-telaga-700/80 bg-hutan shadow-2xl space-y-4 p-5"
          >
            <div className="flex items-center justify-between border-b border-telaga-800 pb-3">
              <div>
                <h3 className="font-heading text-sm font-bold text-kabut">
                  Foto Ulasan Pengunjung
                </h3>
                <p className="text-xs text-kabut/70 mt-0.5">
                  Pengunggah: <span className="text-fajar font-semibold">{previewPhoto.userName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-obsidian border border-telaga-700 text-kabut hover:text-fajar"
              >
                <i className="bi bi-x-lg text-xs" aria-hidden="true" />
              </button>
            </div>

            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-obsidian">
              <Image
                src={previewPhoto.url}
                alt={previewPhoto.userName}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            <p className="text-xs text-kabut/90 italic bg-obsidian/60 p-3 rounded-xl border border-telaga-800">
              &ldquo;{previewPhoto.comment}&rdquo;
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

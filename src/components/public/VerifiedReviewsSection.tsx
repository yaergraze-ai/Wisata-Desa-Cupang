"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import type {
  PublicReviewItemDto,
  PublicReviewsResponse,
  ReviewDestinationFilter,
} from "@/server/reviews/public-reviews";

const MotionTabPill = dynamic(
  () =>
    import("./ReviewsMotionPrimitives").then((mod) => mod.MotionTabPill),
  {
    ssr: false,
    loading: () => <span className="absolute inset-0 rounded-lg bg-fajar" />,
  }
);

const MotionReviewModal = dynamic(
  () =>
    import("./ReviewsMotionPrimitives").then((mod) => mod.MotionReviewModal),
  { ssr: false }
);

export interface VerifiedReviewsSectionProps {
  locale: AppLocale;
  initialData: PublicReviewsResponse;
}

export function VerifiedReviewsSection({
  locale,
  initialData,
}: VerifiedReviewsSectionProps) {
  const tRev = useTranslations("ReviewsPublic");
  const [filter, setFilter] = useState<ReviewDestinationFilter>(initialData.filter);
  const [data, setData] = useState<PublicReviewsResponse>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSwitchedTab, setHasSwitchedTab] = useState(false);

  // State modal ulasan interaktif (berisi review lengkap + indeks foto aktif)
  const [activeModalData, setActiveModalData] = useState<{
    review: PublicReviewItemDto;
    photoIndex: number;
  } | null>(null);

  const filterTabs: Array<{ key: ReviewDestinationFilter; label: string }> = [
    { key: "all", label: tRev("filterAll") },
    { key: "batu-lawang", label: tRev("filterBatuLawang") },
    { key: "gunung-bendera", label: tRev("filterGunungBendera") },
  ];

  async function handleSelectFilter(nextFilter: ReviewDestinationFilter) {
    if (nextFilter === filter) return;
    setHasSwitchedTab(true);
    setFilter(nextFilter);
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        destination: nextFilter,
        locale,
      });
      const res = await fetch(`/api/public/reviews?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const payload = (await res.json()) as PublicReviewsResponse;
        setData(payload);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function openReviewDetail(review: PublicReviewItemDto, photoIndex = 0) {
    setActiveModalData({ review, photoIndex });
  }

  return (
    <section
      id="ulasan-pengunjung"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 scroll-mt-24"
    >
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-wider text-fajar uppercase">
            {tRev("eyebrow")}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
            {tRev("heading")}
          </h2>
          <p className="mt-2 text-sm text-kabut/85">{tRev("lead")}</p>
        </div>

        {/* Ringkasan Rating Jujur bila Ada Ulasan + Filter Tab Motion */}
        <div className="flex flex-wrap items-center gap-3">
          {data.averageRating !== null && data.totalPublishedCount > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-telaga-700 bg-hutan px-3.5 py-2 text-xs font-bold text-kabut">
              <i className="bi bi-star-fill text-fajar" aria-hidden="true" />
              <span className="text-sm text-fajar">{data.averageRating}</span>
              <span className="text-kabut/80">
                • {tRev("summaryCount", { count: data.totalPublishedCount })}
              </span>
            </div>
          ) : null}

          <div
            role="tablist"
            className="inline-flex flex-wrap rounded-xl border border-kabut/20 bg-hutan p-1"
          >
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => void handleSelectFilter(tab.key)}
                  className={cn(
                    "relative min-h-[44px] rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                    active ? "text-hutan-950" : "text-kabut/85 hover:text-kabut"
                  )}
                >
                  {active ? (
                    hasSwitchedTab ? (
                      <MotionTabPill />
                    ) : (
                      <span className="absolute inset-0 rounded-lg bg-fajar" />
                    )
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daftar Ulasan atau Empty State */}
      <div className={cn("mt-8 transition-opacity duration-300", isLoading ? "opacity-60" : "opacity-100")}>
        {data.reviews.length === 0 ? (
          <div className="surface-solid-dark p-8 text-center rounded-3xl border border-telaga-800">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-obsidian border border-telaga-700 text-fajar">
              <i className="bi bi-chat-square-quote text-xl" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-bold text-kabut">
              {tRev("emptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-kabut/85">
              {tRev("emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.reviews.map((rev) => {
              const hasPhotos = rev.photos && rev.photos.length > 0;
              const firstPhoto = hasPhotos ? rev.photos[0]! : null;

              return (
                <article
                  key={rev.id}
                  className="surface-solid-dark p-5 rounded-3xl border border-telaga-700/60 flex flex-col justify-between gap-4 transition-all duration-300 hover:border-telaga-500 hover:shadow-xl hover:-translate-y-1 group"
                >
                  <div className="space-y-3.5">
                    {/* Header: Avatar, Nama, Tanggal & Rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fajar/20 to-obsidian border border-fajar/40 font-heading text-xs font-bold text-fajar shadow-inner">
                          {rev.authorInitials}
                        </span>
                        <div className="min-w-0">
                          <p className="font-heading text-sm font-bold text-kabut truncate">
                            {rev.authorName}
                          </p>
                          <p className="text-[11px] text-kabut/70">
                            {rev.createdAtDisplay}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full bg-obsidian border border-fajar/40 px-2.5 py-1 text-xs font-bold text-fajar shrink-0 shadow-sm">
                        <i className="bi bi-star-fill text-[11px]" aria-hidden="true" />
                        <span>{rev.rating}/5</span>
                      </span>
                    </div>

                    {/* Badge Verifikasi Tiket & Destinasi */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-telaga-900 border border-telaga-700 px-2 py-0.5 text-[11px] font-bold text-kabut">
                        <i className="bi bi-patch-check-fill text-fajar text-[10px]" aria-hidden="true" />
                        <span>{tRev("verifiedBadge")}</span>
                      </span>

                      {rev.destinationSlugs && rev.destinationSlugs.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-obsidian border border-telaga-800 px-2 py-0.5 text-[10px] font-medium text-kabut/80">
                          <i className="bi bi-geo-alt-fill text-fajar text-[9px]" aria-hidden="true" />
                          <span>
                            {rev.destinationSlugs.includes("batu-lawang")
                              ? "Batu Lawang"
                              : "Gunung Bendera"}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    {/* TAMPILAN GAMBAR/FOTO ULASAN */}
                    {hasPhotos && firstPhoto ? (
                      <div className="space-y-2 pt-1">
                        {/* Foto Utama Menarik */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openReviewDetail(rev, 0)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openReviewDetail(rev, 0);
                            }
                          }}
                          className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-telaga-700/60 bg-obsidian cursor-pointer group/photo shadow-md"
                          aria-label={tRev("openPhotoAria", { index: 1 })}
                        >
                          <Image
                            src={firstPhoto.url}
                            alt={`Foto dokumentasi oleh ${rev.authorName}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover/photo:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-transparent opacity-80 group-hover/photo:opacity-90 transition-opacity" />

                          {/* Tombol Perbesar Foto Melayang */}
                          <div className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-obsidian/85 border border-kabut/20 px-3 py-1 text-[11px] font-bold text-kabut backdrop-blur-sm shadow group-hover/photo:bg-fajar group-hover/photo:text-obsidian transition-colors">
                            <i className="bi bi-arrows-angle-expand text-[10px]" aria-hidden="true" />
                            <span>Perbesar</span>
                          </div>

                          {/* Badge Jumlah Foto Jika Lebih Dari 1 */}
                          {rev.photos.length > 1 ? (
                            <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-obsidian/85 border border-fajar/40 px-2.5 py-0.5 text-[10px] font-extrabold text-fajar backdrop-blur-sm shadow">
                              <i className="bi bi-images" aria-hidden="true" />
                              <span>{rev.photos.length} Foto</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Thumbnail Baris Tambahan Bila Ada Foto Lain */}
                        {rev.photos.length > 1 ? (
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            {rev.photos.map((photo, pIdx) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => openReviewDetail(rev, pIdx)}
                                aria-label={tRev("openPhotoAria", { index: pIdx + 1 })}
                                className="relative aspect-square overflow-hidden rounded-xl border border-kabut/20 bg-obsidian hover:border-fajar hover:scale-105 transition-all cursor-pointer shadow-sm"
                              >
                                <Image
                                  src={photo.url}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                  unoptimized
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Teks Komentar Ulasan */}
                    <p className="text-sm leading-relaxed text-kabut/90 line-clamp-4">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Balasan Pengelola (Bila Ada) */}
                    {rev.managerReply ? (
                      <div className="rounded-2xl border border-telaga-700 bg-obsidian/80 p-3 text-xs space-y-1">
                        <p className="font-bold text-fajar flex items-center gap-1.5">
                          <i className="bi bi-reply-fill" aria-hidden="true" />
                          <span>{tRev("managerReplyTitle")}</span>
                        </p>
                        <p className="text-kabut/85 leading-relaxed pl-4 border-l-2 border-telaga-700">
                          {rev.managerReply}
                        </p>
                      </div>
                    ) : null}

                    {/* Tombol Interaktif Buka Ulasan & Foto */}
                    <button
                      type="button"
                      onClick={() => openReviewDetail(rev, 0)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-obsidian/70 border border-telaga-700/60 px-3.5 py-2 text-xs font-bold text-kabut hover:text-fajar hover:border-fajar hover:bg-obsidian transition cursor-pointer"
                    >
                      <i
                        className={`bi ${hasPhotos ? "bi-image" : "bi-chat-text"}`}
                        aria-hidden="true"
                      />
                      <span>
                        {hasPhotos ? tRev("viewDetailBtn") : tRev("viewReviewBtn")}
                      </span>
                      <i className="bi bi-arrow-right text-[11px]" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Interaktif Detail Ulasan (Nama, Foto Bergerak, Komentar & Animasi Spring) */}
      {activeModalData ? (
        <MotionReviewModal
          review={activeModalData.review}
          initialPhotoIndex={activeModalData.photoIndex}
          onClose={() => setActiveModalData(null)}
          closeAriaLabel={tRev("closeLightboxAria")}
        />
      ) : null}
    </section>
  );
}

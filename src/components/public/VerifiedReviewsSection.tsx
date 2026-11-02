"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { ReviewReactionRow } from "./ReviewReactionRow";
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

// Fisher-Yates shuffle untuk pengacakan otomatis ulasan
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
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

  // Filter Bintang (undefined = Semua, atau 5, 4, 3, 2, 1)
  const [starFilter, setStarFilter] = useState<number | null>(null);

  // Pagination / Limit Tampilan ("Lihat Lainnya")
  const INITIAL_VISIBLE_COUNT = 6;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

  // Daftar ulasan acak otomatis
  const [shuffledReviews, setShuffledReviews] = useState<PublicReviewItemDto[]>([]);

  useEffect(() => {
    // Acak ulasan secara otomatis saat data diterima/berubah
    if (data.reviews.length > 0) {
      setShuffledReviews(shuffleArray(data.reviews));
    } else {
      setShuffledReviews([]);
    }
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [data.reviews]);

  // State modal ulasan interaktif
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
    setStarFilter(null);
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

  // Filter ulasan berdasarkan bintang jika dipilih
  const filteredReviews = useMemo(() => {
    if (!starFilter) return shuffledReviews;
    return shuffledReviews.filter((r) => r.rating === starFilter);
  }, [shuffledReviews, starFilter]);

  const displayedReviews = useMemo(() => {
    return filteredReviews.slice(0, visibleCount);
  }, [filteredReviews, visibleCount]);

  const hasMore = visibleCount < filteredReviews.length;

  function handleLoadMore() {
    setVisibleCount((prev) => prev + 6);
  }

  function handleShowAll() {
    setVisibleCount(filteredReviews.length);
  }

  function handleCollapse() {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    const el = document.getElementById("ulasan-pengunjung");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleReshuffle() {
    setShuffledReviews(shuffleArray(data.reviews));
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }

  function openReviewDetail(review: PublicReviewItemDto, photoIndex = 0) {
    setActiveModalData({ review, photoIndex });
  }

  return (
    <section
      id="ulasan-pengunjung"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 scroll-mt-24 space-y-8"
    >
      {/* HEADER SECTION & FILTER TABS */}
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-wider text-fajar uppercase flex items-center gap-2">
            <i className="bi bi-patch-check-fill text-sm" aria-hidden="true" />
            <span>{tRev("eyebrow")}</span>
          </p>
          <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
            {tRev("heading")}
          </h2>
          <p className="mt-2 text-sm text-kabut/85">{tRev("lead")}</p>
        </div>

        {/* Tab Destinasi & Tombol Acak */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleReshuffle}
            title="Acak urutan ulasan"
            className="inline-flex items-center gap-1.5 rounded-xl border border-telaga-700/60 bg-obsidian px-3.5 py-2 text-xs font-bold text-kabut/80 hover:text-fajar hover:border-fajar transition cursor-pointer"
          >
            <i className="bi bi-shuffle text-fajar" aria-hidden="true" />
            <span>Acak Tampilan</span>
          </button>

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

      {/* KARTU RINGKASAN BINTANG & DISTRIBUSI RATING */}
      {data.totalPublishedCount > 0 ? (
        <div className="surface-solid-dark p-6 sm:p-7 rounded-3xl border border-telaga-700/60 shadow-xl bg-gradient-to-br from-hutan/90 via-obsidian/95 to-obsidian">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Skor Rata-rata Besar */}
            <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-telaga-800/80 pb-5 md:pb-0 md:pr-6">
              <span className="text-[11px] font-bold text-kabut/60 uppercase tracking-wider">
                Rating Keseluruhan
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-heading text-4xl sm:text-5xl font-extrabold text-fajar">
                  {data.averageRating ? data.averageRating.toFixed(1) : "5.0"}
                </span>
                <span className="text-base font-bold text-kabut/60">/ 5.0</span>
              </div>
              <div className="mt-2 flex items-center text-fajar text-sm gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <i key={i} className="bi bi-star-fill shadow-sm" aria-hidden="true" />
                ))}
              </div>
              <p className="mt-2 text-xs text-kabut/75">
                Berdasarkan <span className="font-bold text-kabut">{data.totalPublishedCount}</span> ulasan resmi pemegang e-ticket
              </p>
            </div>

            {/* Diagram Distribusi Bintang 5 s/d 1 */}
            <div className="md:col-span-8 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-kabut flex items-center gap-1.5">
                  <i className="bi bi-bar-chart-fill text-fajar" aria-hidden="true" />
                  <span>Distribusi Penilaian Bintang</span>
                </span>
                {starFilter ? (
                  <button
                    type="button"
                    onClick={() => setStarFilter(null)}
                    className="text-xs text-fajar font-semibold hover:underline"
                  >
                    Reset Filter ({starFilter} ★)
                  </button>
                ) : (
                  <span className="text-[11px] text-kabut/60">
                    Klik baris untuk memfilter
                  </span>
                )}
              </div>

              {([5, 4, 3, 2, 1] as const).map((stars) => {
                const distItem = data.ratingDistribution?.find((d) => d.stars === stars);
                const count = distItem?.count ?? data.reviews.filter((r) => r.rating === stars).length;
                const pct = data.totalPublishedCount > 0
                  ? Math.round((count / data.totalPublishedCount) * 100)
                  : 0;
                const isSelected = starFilter === stars;

                return (
                  <button
                    key={stars}
                    type="button"
                    onClick={() => setStarFilter(isSelected ? null : stars)}
                    className={cn(
                      "w-full flex items-center gap-3 p-1.5 rounded-xl transition cursor-pointer text-left",
                      isSelected
                        ? "bg-fajar/15 border border-fajar/50"
                        : "hover:bg-obsidian/60"
                    )}
                  >
                    <span className="w-12 shrink-0 text-xs font-bold text-kabut flex items-center gap-1">
                      <span>{stars}</span>
                      <i className="bi bi-star-fill text-fajar text-[10px]" aria-hidden="true" />
                    </span>

                    <div className="flex-1 h-2.5 rounded-full bg-obsidian border border-telaga-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          stars >= 4
                            ? "bg-gradient-to-r from-amber-500 to-fajar"
                            : "bg-telaga-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <span className="w-16 shrink-0 text-right text-[11px] font-mono text-kabut/70">
                      {count} ({pct}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* DAFTAR KARTU ULASAN */}
      <div className={cn("transition-opacity duration-300", isLoading ? "opacity-60" : "opacity-100")}>
        {displayedReviews.length === 0 ? (
          <div className="surface-solid-dark p-8 text-center rounded-3xl border border-telaga-800">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-obsidian border border-telaga-700 text-fajar">
              <i className="bi bi-chat-square-quote text-xl" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-bold text-kabut">
              {starFilter
                ? `Belum Ada Ulasan dengan Penilaian ${starFilter} Bintang`
                : tRev("emptyTitle")}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-kabut/85">
              {starFilter
                ? "Pilih bintang lain atau klik tombol reset filter untuk melihat semua ulasan."
                : tRev("emptyDesc")}
            </p>
            {starFilter ? (
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-fajar px-4 py-2 text-xs font-bold text-obsidian shadow hover:bg-fajar-hover"
              >
                <span>Tampilkan Semua Ulasan</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayedReviews.map((rev) => {
              const hasPhotos = rev.photos && rev.photos.length > 0;
              const firstPhoto = hasPhotos ? rev.photos[0]! : null;

              return (
                <article
                  key={rev.id}
                  className="surface-solid-dark p-5 rounded-3xl border border-telaga-700/60 flex flex-col justify-between gap-4 transition-all duration-300 hover:border-telaga-500 hover:shadow-2xl hover:-translate-y-1 group bg-gradient-to-br from-hutan/60 to-obsidian"
                >
                  <div className="space-y-3.5">
                    {/* Header: Avatar, Nama, Tanggal & Rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fajar/25 to-obsidian border border-fajar/40 font-heading text-xs font-bold text-fajar shadow-inner">
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

                      <div className="flex items-center gap-1 rounded-full bg-obsidian border border-fajar/40 px-2.5 py-1 text-xs font-bold text-fajar shrink-0 shadow-sm">
                        <i className="bi bi-star-fill text-[11px]" aria-hidden="true" />
                        <span>{rev.rating}/5</span>
                      </div>
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

                    {/* TAMPILAN FOTO DENGAN PREVIEW RESOLUSI JELAS */}
                    {hasPhotos && firstPhoto ? (
                      <div className="space-y-2 pt-1">
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
                          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/75 via-transparent to-transparent opacity-80 group-hover/photo:opacity-90 transition-opacity" />

                          {/* Tombol Perbesar Melayang */}
                          <div className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-obsidian/85 border border-kabut/20 px-3 py-1 text-[11px] font-bold text-kabut backdrop-blur-sm shadow group-hover/photo:bg-fajar group-hover/photo:text-obsidian transition-colors">
                            <i className="bi bi-arrows-angle-expand text-[10px]" aria-hidden="true" />
                            <span>Perbesar</span>
                          </div>

                          {/* Badge Jumlah Foto Jika > 1 */}
                          {rev.photos.length > 1 ? (
                            <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-obsidian/85 border border-fajar/40 px-2.5 py-0.5 text-[10px] font-extrabold text-fajar backdrop-blur-sm shadow">
                              <i className="bi bi-images" aria-hidden="true" />
                              <span>{rev.photos.length} Foto</span>
                            </div>
                          ) : null}
                        </div>

                        {/* Baris Thumbnail Mini */}
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

                    {/* Komentar Pengunjung */}
                    <p className="text-sm leading-relaxed text-kabut/90 line-clamp-4">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    {/* Reaksi Emote (1 Akun 1 Reaksi) */}
                    <ReviewReactionRow
                      reviewId={rev.id}
                      initialReactions={rev.reactions}
                      locale={locale}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Tanggapan Pengelola */}
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

      {/* TOMBOL "LIHAT LAINNYA" / TAMPILKAN SEMUA ULASAN */}
      {filteredReviews.length > INITIAL_VISIBLE_COUNT ? (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {hasMore ? (
            <>
              <button
                type="button"
                onClick={handleLoadMore}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-fajar px-6 py-3 text-xs font-extrabold text-obsidian shadow-lg shadow-fajar/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <i className="bi bi-plus-circle-fill text-sm" aria-hidden="true" />
                <span>Lihat Ulasan Lainnya ({filteredReviews.length - visibleCount} ulasan tersisa)</span>
              </button>

              <button
                type="button"
                onClick={handleShowAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-obsidian border border-telaga-700 px-5 py-3 text-xs font-bold text-kabut hover:border-fajar hover:text-fajar transition-all cursor-pointer"
              >
                <i className="bi bi-arrows-expand text-sm" aria-hidden="true" />
                <span>Tampilkan Semua ({filteredReviews.length})</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCollapse}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-obsidian border border-telaga-700 px-5 py-2.5 text-xs font-bold text-kabut hover:border-fajar transition-all cursor-pointer"
            >
              <i className="bi bi-chevron-up text-xs" aria-hidden="true" />
              <span>Sembunyikan / Tampilkan Lebih Sedikit</span>
            </button>
          )}
        </div>
      ) : null}

      {/* MODAL INTERAKTIF DETAIL ULASAN */}
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

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import type {
  PublicReviewPhotoDto,
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

const MotionPhotoLightbox = dynamic(
  () =>
    import("./ReviewsMotionPrimitives").then((mod) => mod.MotionPhotoLightbox),
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
  const [lightboxPhoto, setLightboxPhoto] = useState<PublicReviewPhotoDto | null>(
    null
  );

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

        {/* Ringkasan Rating Jujur bila Ada Ulasan + Filter Tab Motion layoutId (§5.6 & §7.2) */}
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

      {/* Daftar Ulasan atau Empty State Jujur (Anti-AI-Slop: Tanpa Testimoni Karangan!) */}
      <div className={cn("mt-8 transition-opacity", isLoading ? "opacity-60" : "opacity-100")}>
        {data.reviews.length === 0 ? (
          <div className="surface-solid-dark p-8 text-center">
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
            {data.reviews.map((rev) => (
              <article
                key={rev.id}
                className="surface-solid-dark p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-obsidian border border-telaga-700 font-heading text-xs font-bold text-fajar">
                        {rev.authorInitials}
                      </span>
                      <div>
                        <p className="font-heading text-sm font-bold text-kabut">
                          {rev.authorName}
                        </p>
                        <p className="text-xs text-kabut/75">
                          {rev.createdAtDisplay}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-obsidian border border-fajar/40 px-2.5 py-1 text-xs font-bold text-fajar">
                      <i className="bi bi-star-fill" aria-hidden="true" />
                      <span>{rev.rating}/5</span>
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-telaga-900 border border-telaga-700 px-2 py-0.5 text-[11px] font-bold text-kabut">
                      <i className="bi bi-patch-check-fill text-fajar" aria-hidden="true" />
                      <span>{tRev("verifiedBadge")}</span>
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-kabut/90">
                    {rev.comment}
                  </p>

                  {rev.photos.length > 0 ? (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {rev.photos.map((photo, pIdx) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          aria-label={tRev("openPhotoAria", { index: pIdx + 1 })}
                          className="relative aspect-square overflow-hidden rounded-lg border border-kabut/20 bg-obsidian hover:border-fajar cursor-pointer"
                        >
                          <Image
                            src={photo.url}
                            alt=""
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {rev.managerReply ? (
                  <div className="rounded-xl border border-telaga-700 bg-obsidian/80 p-3.5 text-xs">
                    <p className="font-bold text-fajar">
                      <i className="bi bi-reply-fill mr-1" aria-hidden="true" />
                      <span>{tRev("managerReplyTitle")}</span>
                    </p>
                    <p className="mt-1 text-kabut/85">{rev.managerReply}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Foto Ulasan Berbasis Motion (§7.2) */}
      {lightboxPhoto ? (
        <MotionPhotoLightbox
          photo={lightboxPhoto}
          closeAriaLabel={tRev("closeLightboxAria")}
          onClose={() => setLightboxPhoto(null)}
        />
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import { cn } from "@/lib/cn";
import type {
  PublicDestinationSummary,
  PublicSlotMedia,
  PublicProductSummary,
  PublicTrailPointSummary,
} from "@/server/catalog/public-catalog";

export interface HeroGalleryProps {
  locale: AppLocale;
  todayYmd: string;
  offTrailThresholdM: number;
  destinations: PublicDestinationSummary[];
  products: PublicProductSummary[];
  trailPoints: PublicTrailPointSummary[];
  mediaSlots: Record<string, PublicSlotMedia>;
}

interface GalleryCardData {
  id: string;
  slotKey: string;
  badge: string;
  shortLabel: string;
  title: string;
  meta: string;
  icon: string;
  accentBadgeClass: string;
  ambientGlowClass: string;
  media: PublicSlotMedia;
  linkedPackage?: "REGULER_BL" | "TIKET_PUTIH";
}

function getCircularOffset(index: number, active: number, total: number): number {
  let diff = index - active;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

function getCardTransform(offset: number, isMobile: boolean) {
  const abs = Math.abs(offset);
  const stepX = isMobile ? 28 : 56;
  const stepZ = isMobile ? -55 : -95;
  const rotY = isMobile ? -6 : -11;

  if (abs === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
      rotateY: 0,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    };
  }

  if (abs === 1) {
    return {
      x: offset * stepX,
      y: isMobile ? 10 : 14,
      z: stepZ,
      rotateY: offset * rotY,
      scale: 0.91,
      opacity: 0.84,
      zIndex: 20,
    };
  }

  return {
    x: offset * (stepX * 1.55),
    y: isMobile ? 20 : 28,
    z: stepZ * 1.8,
    rotateY: offset * (rotY * 1.35),
    scale: 0.82,
    opacity: 0.42,
    zIndex: 10,
  };
}

export function HeroGallery({
  locale,
  offTrailThresholdM,
  destinations,
  products,
  trailPoints,
  mediaSlots,
}: HeroGalleryProps) {
  const tHero = useTranslations("Hero");
  const tHome = useTranslations("Home");

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<
    "REGULER_BL" | "TIKET_PUTIH"
  >("TIKET_PUTIH");
  const [loadedBgMap, setLoadedBgMap] = useState<Record<string, boolean>>({});
  const [loadedCardMap, setLoadedCardMap] = useState<Record<string, boolean>>({});

  const heroSectionRef = useRef<HTMLElement | null>(null);
  const bgImageWrapRef = useRef<HTMLDivElement | null>(null);
  const displayHeadlineRef = useRef<HTMLHeadingElement | null>(null);
  const subheadlineRef = useRef<HTMLParagraphElement | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const dragProxyRef = useRef<HTMLDivElement | null>(null);
  const cardElsRef = useRef<Array<HTMLElement | null>>([]);
  const activeIndexRef = useRef(0);
  const gsapRef = useRef<typeof import("gsap").gsap | null>(null);

  const batuLawang = useMemo(
    () => destinations.find((d) => d.slug === "batu-lawang") ?? destinations[0],
    [destinations]
  );
  const gunungBendera = useMemo(
    () =>
      destinations.find((d) => d.slug === "gunung-bendera") ??
      destinations[1] ??
      destinations[0],
    [destinations]
  );

  const prodReguler = useMemo(
    () => products.find((p) => p.code === "REGULER_BL") ?? products[0],
    [products]
  );
  const prodPutih = useMemo(
    () =>
      products.find((p) => p.code === "TIKET_PUTIH") ??
      products[1] ??
      products[0],
    [products]
  );

  const totalTrailMeters = useMemo(
    () => trailPoints.reduce((acc, p) => acc + p.distFromPrevM, 0),
    [trailPoints]
  );
  const totalTrailMinutes = useMemo(
    () => trailPoints.reduce((acc, p) => acc + p.minsFromPrev, 0),
    [trailPoints]
  );
  const summitElevation = useMemo(() => {
    const summitPt = trailPoints.find((p) => p.code === "SUMMIT");
    return summitPt?.elevationM ?? gunungBendera?.elevationM ?? 520;
  }, [trailPoints, gunungBendera]);

  const fallbackMedia: PublicSlotMedia = useMemo(
    () => ({
      slot: "hero",
      url: "/media/defaults/hero.webp",
      width: 1600,
      height: 1000,
      alt: "Wisata Cirebon Batu Lawang & Gunung Bendera",
    }),
    []
  );

  // 5 Kartu Bernama Jelas & Terikat dengan Data Server
  const cards = useMemo<GalleryCardData[]>(() => {
    const regulerPriceStr = prodReguler
      ? formatRupiah(prodReguler.totalPrice, locale)
      : "";
    const putihPriceStr = prodPutih
      ? formatRupiah(prodPutih.totalPrice, locale)
      : "";

    return [
      {
        id: "batu-lawang",
        slotKey: "card-1",
        badge: tHero("cards.c1Badge"),
        shortLabel: tHero("cards.c1Short"),
        title: tHero("cards.c1Title"),
        meta: tHero("cards.c1Meta", {
          price: regulerPriceStr,
          elevation: batuLawang?.elevationM ?? 360,
        }),
        icon: "bi-compass-fill",
        accentBadgeClass:
          "border-fajar/45 bg-gradient-to-br from-fajar/30 via-fajar/15 to-obsidian/80 text-fajar shadow-[0_0_18px_rgba(242,166,90,0.28)]",
        ambientGlowClass:
          "bg-[radial-gradient(circle_at_70%_35%,rgba(242,166,90,0.22),transparent_65%)]",
        media: mediaSlots["card-1"] ?? mediaSlots["hero"] ?? fallbackMedia,
        linkedPackage: "REGULER_BL",
      },
      {
        id: "tiket-putih",
        slotKey: "card-2",
        badge: tHero("cards.c2Badge"),
        shortLabel: tHero("cards.c2Short"),
        title: tHero("cards.c2Title"),
        meta: tHero("cards.c2Meta", {
          price: putihPriceStr,
        }),
        icon: "bi-ticket-perforated-fill",
        accentBadgeClass:
          "border-telaga-400/50 bg-gradient-to-br from-telaga/35 via-telaga-900/40 to-obsidian/80 text-kabut shadow-[0_0_18px_rgba(47,143,131,0.35)]",
        ambientGlowClass:
          "bg-[radial-gradient(circle_at_70%_35%,rgba(47,143,131,0.26),transparent_65%)]",
        media: mediaSlots["card-2"] ?? mediaSlots["hero"] ?? fallbackMedia,
        linkedPackage: "TIKET_PUTIH",
      },
      {
        id: "gardu-tebing",
        slotKey: "card-3",
        badge: tHero("cards.c3Badge"),
        shortLabel: tHero("cards.c3Short"),
        title: tHero("cards.c3Title"),
        meta: tHero("cards.c3Meta", {
          open: batuLawang?.openTime ?? "06:00",
          close: batuLawang?.closeTime ?? "17:00",
          elevation: batuLawang?.elevationM ?? 360,
        }),
        icon: "bi-camera-reels-fill",
        accentBadgeClass:
          "border-fajar/45 bg-gradient-to-br from-amber-500/30 via-fajar/15 to-obsidian/80 text-fajar shadow-[0_0_18px_rgba(242,166,90,0.25)]",
        ambientGlowClass:
          "bg-[radial-gradient(circle_at_65%_40%,rgba(245,158,11,0.20),transparent_65%)]",
        media: mediaSlots["card-3"] ?? mediaSlots["hero"] ?? fallbackMedia,
      },
      {
        id: "navigator-gps",
        slotKey: "card-4",
        badge: tHero("cards.c4Badge"),
        shortLabel: tHero("cards.c4Short"),
        title: tHero("cards.c4Title"),
        meta: tHero("cards.c4Meta", {
          meters: totalTrailMeters,
          threshold: offTrailThresholdM,
        }),
        icon: "bi-geo-alt-fill",
        accentBadgeClass:
          "border-telaga-400/50 bg-gradient-to-br from-telaga/35 via-obsidian/70 to-obsidian/90 text-telaga-200 shadow-[0_0_18px_rgba(47,143,131,0.3)]",
        ambientGlowClass:
          "bg-[radial-gradient(circle_at_72%_32%,rgba(47,143,131,0.24),transparent_65%)]",
        media: mediaSlots["card-4"] ?? mediaSlots["hero"] ?? fallbackMedia,
      },
      {
        id: "puncak-bendera",
        slotKey: "card-5",
        badge: tHero("cards.c5Badge"),
        shortLabel: tHero("cards.c5Short", { elevation: summitElevation }),
        title: tHero("cards.c5Title"),
        meta: tHero("cards.c5Meta", {
          elevation: summitElevation,
          mins: totalTrailMinutes,
        }),
        icon: "bi-brightness-high-fill",
        accentBadgeClass:
          "border-fajar/55 bg-gradient-to-br from-fajar/35 via-amber-500/20 to-obsidian/80 text-fajar shadow-[0_0_22px_rgba(242,166,90,0.35)]",
        ambientGlowClass:
          "bg-[radial-gradient(circle_at_68%_30%,rgba(242,166,90,0.26),transparent_65%)]",
        media: mediaSlots["card-5"] ?? mediaSlots["hero"] ?? fallbackMedia,
        linkedPackage: "TIKET_PUTIH",
      },
    ];
  }, [
    batuLawang,
    fallbackMedia,
    locale,
    mediaSlots,
    offTrailThresholdM,
    prodPutih,
    prodReguler,
    summitElevation,
    tHero,
    totalTrailMeters,
    totalTrailMinutes,
  ]);

  const activeCard = (cards[activeIndex] ?? cards[0])!;
  const isActiveBgLoaded = Boolean(loadedBgMap[activeCard.id]);

  const animateCardsToIndex = useCallback(
    (targetIdx: number, immediate = false) => {
      const total = cards.length;
      if (total === 0) return;
      const normalized = ((targetIdx % total) + total) % total;
      activeIndexRef.current = normalized;
      setActiveIndex(normalized);

      const targetCard = cards[normalized];
      if (targetCard?.linkedPackage) {
        setSelectedPackage(targetCard.linkedPackage);
      }

      const gsap = gsapRef.current;
      if (!gsap) return;

      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;

      cardElsRef.current.forEach((el, idx) => {
        if (!el) return;
        const offset = getCircularOffset(idx, normalized, total);
        const tf = getCardTransform(offset, isMobile);

        gsap.to(el, {
          x: tf.x,
          y: tf.y,
          z: tf.z,
          rotationY: tf.rotateY,
          scale: tf.scale,
          opacity: tf.opacity,
          zIndex: tf.zIndex,
          duration: immediate ? 0 : 0.62,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    },
    [cards]
  );

  const goToCard = useCallback(
    (nextIdx: number) => {
      animateCardsToIndex(nextIdx, false);
    },
    [animateCardsToIndex]
  );

  const scrollToCalculatorWithPackage = useCallback(
    (pkg: "REGULER_BL" | "TIKET_PUTIH") => {
      setSelectedPackage(pkg);
      window.dispatchEvent(
        new CustomEvent("wisata:select-package", {
          detail: { packageCode: pkg },
        })
      );
      const calcEl = document.getElementById("kalkulator-tiket");
      if (calcEl) {
        calcEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    []
  );

  // Inisialisasi GSAP: SplitText/stagger, ScrollTrigger paralaks, dan Draggable 3D
  useEffect(() => {
    let cancelled = false;
    let cleanupCtx: (() => void) | undefined;
    let cleanupMm: (() => void) | undefined;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const initHeroGsap = async () => {
      const [gsapMod, scrollTriggerMod, draggableMod, splitTextMod] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("gsap/Draggable"),
          import("gsap/SplitText").catch(() => null),
        ]);

      if (cancelled || !heroSectionRef.current) return;

      const gsap = gsapMod.gsap;
      const ScrollTrigger = scrollTriggerMod.ScrollTrigger;
      const Draggable = draggableMod.Draggable;
      const SplitText = splitTextMod?.SplitText;

      if (SplitText) {
        gsap.registerPlugin(ScrollTrigger, Draggable, SplitText);
      } else {
        gsap.registerPlugin(ScrollTrigger, Draggable);
      }

      gsapRef.current = gsap;

      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const ctx = gsap.context(() => {
        animateCardsToIndex(activeIndexRef.current, true);

        if (prefersReduced) {
          return;
        }

        if (displayHeadlineRef.current) {
          if (SplitText) {
            const split = new SplitText(displayHeadlineRef.current, {
              type: "chars,words",
            });
            gsap.fromTo(
              split.chars,
              { opacity: 0, y: 18 },
              {
                opacity: 1,
                y: 0,
                duration: 0.55,
                stagger: 0.02,
                ease: "power3.out",
              }
            );
          } else {
            gsap.fromTo(
              displayHeadlineRef.current,
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }
            );
          }
        }

        if (subheadlineRef.current) {
          gsap.fromTo(
            subheadlineRef.current,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.55,
              delay: 0.14,
              ease: "power2.out",
            }
          );
        }

        if (bgImageWrapRef.current && heroSectionRef.current) {
          gsap.to(bgImageWrapRef.current, {
            yPercent: 7,
            ease: "none",
            scrollTrigger: {
              trigger: heroSectionRef.current,
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }
      }, heroSectionRef);

      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: "(min-width: 768px)",
          isMobile: "(max-width: 767px)",
        },
        () => {
          animateCardsToIndex(activeIndexRef.current, true);

          if (!dragProxyRef.current || !cardStageRef.current) return;

          const dragInstance = Draggable.create(dragProxyRef.current, {
            trigger: cardStageRef.current,
            type: "x",
            MinimumMovement: 10,
            onDragEnd: function () {
              const dx = this.endX - this.startX;
              gsap.set(this.target, { x: 0 });
              if (dx < -35) {
                animateCardsToIndex(activeIndexRef.current + 1, false);
              } else if (dx > 35) {
                animateCardsToIndex(activeIndexRef.current - 1, false);
              }
            },
          });

          return () => {
            dragInstance.forEach((d) => d.kill());
          };
        }
      );

      cleanupCtx = () => ctx.revert();
      cleanupMm = () => mm.revert();
    };

    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleHandle = win.requestIdleCallback(
        () => {
          void initHeroGsap();
        },
        { timeout: 1200 }
      );
    } else {
      timeoutHandle = setTimeout(() => {
        void initHeroGsap();
      }, 180);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      cleanupMm?.();
      cleanupCtx?.();
    };
  }, [animateCardsToIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goToCard(activeIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToCard(activeIndex - 1);
    }
  };

  const selectedProductSummary =
    selectedPackage === "TIKET_PUTIH" ? prodPutih : prodReguler;

  return (
    <section
      ref={heroSectionRef}
      aria-label={tHero("galleryRegionAria")}
      onKeyDown={handleKeyDown}
      className="relative min-h-[calc(100dvh-4rem)] overflow-hidden border-b border-kabut/15 bg-obsidian"
    >
      {/* Latar Belakang Penuh Multi-Layer Crossfade — Bebas Bug Saat Berganti Kartu */}
      <div
        ref={bgImageWrapRef}
        className="pointer-events-none absolute inset-0 -top-8 -bottom-8 z-0"
      >
        {/* Shadow Skeleton Latar Belakang Saat Gambar Masih Dimuat */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-hutan-900 via-obsidian to-telaga-950 transition-opacity duration-700",
            isActiveBgLoaded
              ? "opacity-0"
              : "opacity-100 animate-pulse shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]"
          )}
        />

        {/* Semua Latar Kartu Dirender Bertumpuk agar Crossfade Mulus Tanpa Kedip */}
        {cards.map((card, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <div
              key={card.id}
              aria-hidden={!isCurrent}
              className={cn(
                "absolute inset-0 transition-all duration-700 ease-out will-change-[opacity,transform]",
                isCurrent
                  ? "opacity-80 sm:opacity-85 scale-100 z-10"
                  : "opacity-0 scale-105 z-0"
              )}
            >
              <Image
                src={card.media.url}
                alt={card.media.alt || card.title}
                fill
                priority={idx === 0}
                fetchPriority={idx === 0 ? "high" : "auto"}
                sizes="(max-width: 768px) 100vw, 85vw"
                quality={idx === 0 ? 78 : 72}
                onLoad={() =>
                  setLoadedBgMap((prev) =>
                    prev[card.id] ? prev : { ...prev, [card.id]: true }
                  )
                }
                className="object-cover"
              />
              {/* Ambient Glow Dinamis Sesuai Karakter Kartu */}
              <div
                className={cn(
                  "absolute inset-0 transition-opacity duration-700",
                  card.ambientGlowClass
                )}
              />
            </div>
          );
        })}

        {/* Scrim Gradien Berlapis untuk Kontras Teks WCAG AA */}
        <div className="absolute inset-0 z-20 bg-gradient-to-r from-obsidian/95 via-obsidian/80 to-obsidian/45" />
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-obsidian via-obsidian/35 to-obsidian/65" />
      </div>

      {/* Pengumuman ARIA Live saat kartu berganti */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {tHero("cardAnnouncement", {
          index: activeIndex + 1,
          total: cards.length,
          title: `${activeCard.shortLabel} — ${activeCard.title}`,
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Kolom Kiri (7 kolom): Tipografi Display, Statistik Langsung & Pemilihan Paket */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-fajar/40 bg-obsidian/85 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-fajar shadow-[0_4px_20px_rgba(242,166,90,0.18)] backdrop-blur-md">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-fajar/20 text-fajar">
                  <i className="bi bi-geo-alt-fill text-xs" aria-hidden="true" />
                </span>
                <span>{tHero("eyebrow")}</span>
              </div>

              {/* Indikator Latar Aktif Sesuai Nama Kartu */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-bold text-kabut backdrop-blur-md shadow-sm transition-all duration-300">
                <i
                  className={cn("bi text-fajar", activeCard.icon)}
                  aria-hidden="true"
                />
                <span>{activeCard.shortLabel}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-heading text-xs sm:text-sm font-extrabold tracking-[0.28em] text-telaga-400 uppercase">
                {tHero("displayTitle")}
              </p>
              <h1
                ref={displayHeadlineRef}
                className="font-heading text-3xl font-extrabold tracking-tight text-kabut sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]"
              >
                {tHero("headline")}
              </h1>
              <p
                ref={subheadlineRef}
                className="max-w-2xl text-sm leading-relaxed text-kabut/90 sm:text-base"
              >
                {tHero("subheadline")}
              </p>
            </div>

            {/* Pita Statistik Fakta Destinasi dengan Ikon Berkilau */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs font-semibold text-kabut">
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3.5 py-2 shadow-md shadow-black/40 transition-all hover:border-fajar/45">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-fajar/15 border border-fajar/30 text-fajar transition-transform group-hover:scale-110">
                  <i className="bi bi-clock-history text-xs" aria-hidden="true" />
                </span>
                <span>
                  {batuLawang?.openTime ?? "06:00"}–
                  {batuLawang?.closeTime ?? "17:00"} WIB
                </span>
              </span>
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3.5 py-2 shadow-md shadow-black/40 transition-all hover:border-telaga-400/50">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-telaga/20 border border-telaga-400/35 text-telaga-200 transition-transform group-hover:scale-110">
                  <i className="bi bi-signpost-split-fill text-xs" aria-hidden="true" />
                </span>
                <span>
                  {tHero("trailLengthStat", {
                    meters: totalTrailMeters,
                    posts: 4,
                  })}
                </span>
              </span>
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3.5 py-2 shadow-md shadow-black/40 transition-all hover:border-fajar/45">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-fajar/15 border border-fajar/30 text-fajar transition-transform group-hover:scale-110">
                  <i className="bi bi-brightness-high-fill text-xs" aria-hidden="true" />
                </span>
                <span>
                  {tHero("elevationUnit", { value: summitElevation })} (
                  {tHero("climbDurationStat", { mins: totalTrailMinutes })})
                </span>
              </span>
            </div>

            {/* Baris Tombol Aksi Utama & Sekunder */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => scrollToCalculatorWithPackage(selectedPackage)}
                className="group btn-ui btn-fajar text-sm sm:text-base px-6 py-3.5 shadow-[0_10px_28px_rgba(242,166,90,0.28)]"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-obsidian/20 text-obsidian transition-transform group-hover:rotate-6 group-hover:scale-110">
                  <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
                </span>
                <span>{tHero("ctaPrimary")}</span>
              </button>

              <Link
                href="/jalur"
                className="group btn-ui btn-glass text-sm sm:text-base px-5 py-3.5"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-fajar/20 border border-fajar/35 text-fajar transition-transform group-hover:rotate-12 group-hover:scale-110">
                  <i className="bi bi-compass-fill" aria-hidden="true" />
                </span>
                <span>{tHero("ctaMap")}</span>
              </Link>
            </div>

            {/* Panel Kaca Pemilihan Paket Resmi (Harga & Kuota Server) */}
            <div className="surface-glass p-4 sm:p-5 space-y-4 max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-fajar/20 border border-fajar/40 text-fajar shadow-sm">
                    <i className="bi bi-shield-fill-check text-sm" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-extrabold tracking-wider text-fajar uppercase">
                    {tHero("panelBadge")}
                  </span>
                </div>
                <span className="text-xs text-kabut/85">
                  {tHero("panelParkingNote")}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label={tHero("panelHeading")}
                className="grid gap-3 sm:grid-cols-2"
              >
                {/* Pilihan 1: Tiket Reguler Batu Lawang */}
                {prodReguler && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedPackage === "REGULER_BL"}
                    onClick={() => {
                      setSelectedPackage("REGULER_BL");
                      goToCard(0);
                    }}
                    className={cn(
                      "group text-left rounded-2xl p-3.5 transition-all border min-h-[112px] flex flex-col justify-between cursor-pointer",
                      selectedPackage === "REGULER_BL"
                        ? "bg-hutan/95 border-fajar ring-2 ring-fajar/50 shadow-lg shadow-black/40"
                        : "bg-obsidian/75 border-white/15 hover:border-white/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-telaga/20 border border-telaga-400/35 text-telaga-200 transition-transform group-hover:scale-105">
                          <i className="bi bi-compass-fill text-xs" aria-hidden="true" />
                        </span>
                        <div>
                          <span className="inline-block text-[11px] font-bold tracking-wider uppercase text-telaga-400">
                            {tHome("regularTicketTag")}
                          </span>
                          <p className="font-heading text-sm font-bold text-kabut mt-0.5">
                            {prodReguler.name}
                          </p>
                        </div>
                      </div>
                      {selectedPackage === "REGULER_BL" && (
                        <span className="rounded-md bg-fajar px-2 py-0.5 text-[11px] font-extrabold text-obsidian">
                          {tHero("panelSelected")}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2 pt-2 border-t border-white/10">
                      <span className="font-heading text-lg font-extrabold text-fajar">
                        {formatRupiah(prodReguler.totalPrice, locale)}
                      </span>
                      <span className="text-[11px] font-semibold text-kabut/85">
                        {tHero("quotaRemaining", {
                          remaining: batuLawang?.remainingToday ?? 0,
                          capacity: batuLawang?.capacityToday ?? 0,
                        })}
                      </span>
                    </div>
                  </button>
                )}

                {/* Pilihan 2: Tiket Putih (Terusan 2 Destinasi) */}
                {prodPutih && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedPackage === "TIKET_PUTIH"}
                    onClick={() => {
                      setSelectedPackage("TIKET_PUTIH");
                      goToCard(1);
                    }}
                    className={cn(
                      "group text-left rounded-2xl p-3.5 transition-all border min-h-[112px] flex flex-col justify-between cursor-pointer",
                      selectedPackage === "TIKET_PUTIH"
                        ? "bg-kabut text-obsidian border-fajar ring-2 ring-fajar shadow-lg shadow-black/40"
                        : "bg-obsidian/75 text-kabut border-white/15 hover:border-white/35"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover:scale-105",
                            selectedPackage === "TIKET_PUTIH"
                              ? "bg-hutan text-fajar border-hutan"
                              : "bg-fajar/15 text-fajar border-fajar/35"
                          )}
                        >
                          <i
                            className="bi bi-ticket-perforated-fill text-xs"
                            aria-hidden="true"
                          />
                        </span>
                        <div>
                          <span
                            className={cn(
                              "inline-block text-[11px] font-extrabold tracking-wider uppercase",
                              selectedPackage === "TIKET_PUTIH"
                                ? "text-telaga-800"
                                : "text-fajar"
                            )}
                          >
                            {tHome("whiteTicketTag")}
                          </span>
                          <p
                            className={cn(
                              "font-heading text-sm font-extrabold mt-0.5",
                              selectedPackage === "TIKET_PUTIH"
                                ? "text-obsidian"
                                : "text-kabut"
                            )}
                          >
                            {prodPutih.name}
                          </p>
                        </div>
                      </div>
                      {selectedPackage === "TIKET_PUTIH" && (
                        <span className="rounded-md bg-hutan px-2 py-0.5 text-[11px] font-extrabold text-fajar">
                          {tHero("panelSelected")}
                        </span>
                      )}
                    </div>

                    <div
                      className={cn(
                        "mt-3 flex items-baseline justify-between gap-2 pt-2 border-t",
                        selectedPackage === "TIKET_PUTIH"
                          ? "border-obsidian/15"
                          : "border-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "font-heading text-lg font-extrabold",
                          selectedPackage === "TIKET_PUTIH"
                            ? "text-hutan"
                            : "text-fajar"
                        )}
                      >
                        {formatRupiah(prodPutih.totalPrice, locale)}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-bold",
                          selectedPackage === "TIKET_PUTIH"
                            ? "text-batu-800"
                            : "text-kabut/85"
                        )}
                      >
                        {tHero("quotaRemaining", {
                          remaining: Math.min(
                            batuLawang?.remainingToday ?? 0,
                            gunungBendera?.remainingToday ?? 0
                          ),
                          capacity: gunungBendera?.capacityToday ?? 0,
                        })}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {selectedProductSummary && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-kabut/90">
                    {tHero("basePlusParking", {
                      base: formatRupiah(selectedProductSummary.basePrice, locale),
                      parking: formatRupiah(
                        selectedProductSummary.parkingFee,
                        locale
                      ),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => scrollToCalculatorWithPackage(selectedPackage)}
                    className="btn-ui btn-primary text-xs px-4 py-2.5 min-h-[44px]"
                  >
                    <span>
                      {tHero("panelSingleCta", {
                        packageName: selectedProductSummary.name,
                      })}
                    </span>
                    <i className="bi bi-arrow-right" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kolom Kanan (5 kolom): Tumpukan 5 Kartu 3D Perspektif Bernama */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div
              ref={cardStageRef}
              className="relative h-[370px] sm:h-[430px] w-full max-w-[390px] flex items-center justify-center select-none touch-pan-y"
              style={{ perspective: "1200px" }}
            >
              {/* Proxy elemen tak terlihat untuk GSAP Draggable */}
              <div
                ref={dragProxyRef}
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
              />

              {cards.map((card, idx) => {
                const isCurrent = idx === activeIndex;
                const initialOffset = getCircularOffset(
                  idx,
                  activeIndex,
                  cards.length
                );
                const initialTf = getCardTransform(initialOffset, false);
                const isCardLoaded = Boolean(loadedCardMap[card.id]);

                return (
                  <article
                    key={card.id}
                    ref={(el) => {
                      cardElsRef.current[idx] = el;
                    }}
                    onClick={() => goToCard(idx)}
                    style={{
                      transform: `translate3d(${initialTf.x}px, ${initialTf.y}px, ${initialTf.z}px) rotateY(${initialTf.rotateY}deg) scale(${initialTf.scale})`,
                      opacity: initialTf.opacity,
                      zIndex: initialTf.zIndex,
                    }}
                    className={cn(
                      "group absolute w-[268px] sm:w-[310px] h-[345px] sm:h-[395px] rounded-[24px] overflow-hidden cursor-pointer border transition-shadow duration-300",
                      isCurrent
                        ? "border-fajar/85 shadow-[0_26px_64px_rgba(0,0,0,0.82)] ring-2 ring-fajar/35"
                        : "border-white/20 shadow-[0_14px_34px_rgba(0,0,0,0.6)] hover:border-white/40"
                    )}
                  >
                    {/* Shadow Skeleton Saat Gambar Kartu Sedang Dimuat */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 transition-opacity duration-500",
                        isCardLoaded
                          ? "opacity-0 pointer-events-none"
                          : "opacity-100 animate-pulse shadow-[inset_0_0_50px_rgba(0,0,0,0.85)]"
                      )}
                    />

                    <Image
                      src={card.media.url}
                      alt={card.media.alt || card.title}
                      fill
                      sizes="(max-width: 640px) 268px, 310px"
                      quality={72}
                      onLoad={() =>
                        setLoadedCardMap((prev) =>
                          prev[card.id] ? prev : { ...prev, [card.id]: true }
                        )
                      }
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/40 to-obsidian/15" />

                    {/* Baris Atas Kartu: Ikon Berkilau + Nama Spot Jelas (Bukan Angka/Card-1) */}
                    <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md transition-transform duration-300 group-hover:scale-110",
                          card.accentBadgeClass
                        )}
                      >
                        <i className={cn("bi text-base", card.icon)} aria-hidden="true" />
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/85 backdrop-blur-md border border-white/20 px-3 py-1 text-[11px] font-extrabold text-kabut shadow-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-fajar" />
                        <span>{card.shortLabel}</span>
                      </span>
                    </div>

                    {/* Konten Bawah Kartu */}
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 space-y-2">
                      <span className="inline-block rounded-md bg-obsidian/80 border border-white/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-fajar uppercase">
                        {card.badge}
                      </span>
                      <h2 className="font-heading text-base sm:text-lg font-extrabold text-kabut leading-snug drop-shadow-sm">
                        {card.title}
                      </h2>
                      <p className="text-xs font-semibold text-kabut/90">
                        {card.meta}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pemilih Kartu Bernama (Menggantikan Tombol Panah & Titik Anonim) */}
            <div
              role="tablist"
              aria-label={tHero("galleryRegionAria")}
              className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-md"
            >
              {cards.map((card, idx) => {
                const isCurrent = idx === activeIndex;
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    onClick={() => goToCard(idx)}
                    className={cn(
                      "group inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer",
                      isCurrent
                        ? "border-fajar bg-fajar text-obsidian shadow-[0_6px_20px_rgba(242,166,90,0.35)] scale-105"
                        : "border-white/15 bg-obsidian/80 text-kabut/85 hover:border-fajar/45 hover:text-kabut backdrop-blur-md"
                    )}
                  >
                    <i
                      className={cn(
                        "bi text-xs transition-transform duration-300 group-hover:scale-110",
                        card.icon,
                        isCurrent ? "text-obsidian" : "text-fajar"
                      )}
                      aria-hidden="true"
                    />
                    <span>{card.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

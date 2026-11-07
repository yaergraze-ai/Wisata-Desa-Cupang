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

function getCardTransform(offset: number, isMobile: boolean, dragDeltaX: number) {
  const abs = Math.abs(offset);
  const stepX = isMobile ? 25 : 54;
  const stepZ = isMobile ? -44 : -92;
  const rotY = isMobile ? -6 : -11;

  if (abs === 0) {
    const clampedDrag = Math.max(-95, Math.min(95, dragDeltaX));
    return {
      x: clampedDrag * 0.65,
      y: 0,
      z: 0,
      rotateY: clampedDrag * 0.08,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    };
  }

  if (abs === 1) {
    return {
      x: offset * stepX + dragDeltaX * 0.18,
      y: isMobile ? 7 : 14,
      z: stepZ,
      rotateY: offset * rotY,
      scale: isMobile ? 0.9 : 0.91,
      opacity: 0.86,
      zIndex: 20,
    };
  }

  return {
    x: offset * (stepX * 1.42) + dragDeltaX * 0.08,
    y: isMobile ? 14 : 26,
    z: stepZ * 1.7,
    rotateY: offset * (rotY * 1.25),
    scale: isMobile ? 0.8 : 0.82,
    opacity: 0.4,
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [loadedBgMap, setLoadedBgMap] = useState<Record<string, boolean>>({});
  const [loadedCardMap, setLoadedCardMap] = useState<Record<string, boolean>>({});

  const heroSectionRef = useRef<HTMLElement | null>(null);
  const bgImageWrapRef = useRef<HTMLDivElement | null>(null);
  const cardStageRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lockedAxis: "x" | "y" | null;
    swallowedClick: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lockedAxis: null,
    swallowedClick: false,
  });

  // Pantau ukuran layar mobile vs desktop agar offset kartu 3D selalu proporsional dan tidak keluar layar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const syncViewport = () => setIsMobileViewport(mq.matches);
    syncViewport();
    mq.addEventListener("change", syncViewport);
    return () => mq.removeEventListener("change", syncViewport);
  }, []);

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

  const goToCard = useCallback(
    (targetIdx: number) => {
      const total = cards.length;
      if (total === 0) return;
      const normalized = ((targetIdx % total) + total) % total;
      setActiveIndex(normalized);
      setDragDeltaX(0);
      setIsDragging(false);

      const targetCard = cards[normalized];
      if (targetCard?.linkedPackage) {
        setSelectedPackage(targetCard.linkedPackage);
      }
    },
    [cards]
  );

  // Gesture geser kiri/kanan pada tumpukan kartu 3D yang tidak pernah mengganggu scroll vertikal ke bawah
  const beginGesture = (clientX: number, clientY: number) => {
    gestureRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lockedAxis: null,
      swallowedClick: false,
    };
  };

  const moveGesture = (clientX: number, clientY: number) => {
    const g = gestureRef.current;
    if (!g.active) return;

    const dx = clientX - g.startX;
    const dy = clientY - g.startY;

    if (!g.lockedAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.lockedAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    if (g.lockedAxis === "y") {
      // Pengguna sedang scroll ke bawah/atas; lepaskan drag kartu sepenuhnya
      g.active = false;
      setIsDragging(false);
      setDragDeltaX(0);
      return;
    }

    g.lastX = clientX;
    if (Math.abs(dx) > 10) {
      g.swallowedClick = true;
    }
    setIsDragging(true);
    setDragDeltaX(dx);
  };

  const endGesture = () => {
    const g = gestureRef.current;
    if (!g.active) {
      setIsDragging(false);
      setDragDeltaX(0);
      return;
    }

    const dx = g.lastX - g.startX;
    const wasHorizontal = g.lockedAxis === "x";
    g.active = false;
    g.lockedAxis = null;
    setIsDragging(false);
    setDragDeltaX(0);

    if (wasHorizontal && Math.abs(dx) > 32) {
      if (dx < 0) {
        goToCard(activeIndex + 1);
      } else {
        goToCard(activeIndex - 1);
      }
    }
  };

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

  // Paralaks ringan latar belakang saat scroll (hanya desktop atau bila gerakan diizinkan)
  useEffect(() => {
    let cancelled = false;
    let cleanupCtx: (() => void) | undefined;

    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 767px)").matches
    ) {
      return;
    }

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([gsapMod, stMod]) => {
        if (cancelled || !heroSectionRef.current || !bgImageWrapRef.current)
          return;
        const gsap = gsapMod.gsap;
        const ScrollTrigger = stMod.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
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
        }, heroSectionRef);

        cleanupCtx = () => ctx.revert();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cleanupCtx?.();
    };
  }, []);

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
              : "opacity-100 skeleton-shimmer shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]"
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
                quality={75}
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

        {/* Scrim Gradien Berlapis untuk Kontras Teks WCAG AA & Visibilitas Latar di Mobile */}
        <div className="absolute inset-0 z-20 bg-obsidian/55 lg:bg-transparent lg:bg-gradient-to-r lg:from-obsidian/95 lg:via-obsidian/80 lg:to-obsidian/45" />
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-obsidian/80 via-obsidian/30 to-obsidian lg:bg-gradient-to-t lg:from-obsidian lg:via-obsidian/35 lg:to-obsidian/65" />
      </div>

      {/* Pengumuman ARIA Live saat kartu berganti */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {tHero("cardAnnouncement", {
          index: activeIndex + 1,
          total: cards.length,
          title: `${activeCard.shortLabel} — ${activeCard.title}`,
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-5">
          {/* BLOK 1 (Mobile: Pertama di Atas, Desktop: Kiri Baris 1) — Nama Wisata & Identitas Kawasan */}
          <div className="order-1 lg:order-1 lg:col-span-7 space-y-2.5 sm:space-y-3 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-fajar/40 bg-obsidian/85 px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold tracking-wide text-fajar shadow-[0_4px_20px_rgba(242,166,90,0.18)] backdrop-blur-md">
                <span className="inline-flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-fajar/20 text-fajar">
                  <i
                    className="bi bi-geo-alt-fill text-[10px] sm:text-xs"
                    aria-hidden="true"
                  />
                </span>
                <span>{tHero("eyebrow")}</span>
              </div>

              {/* Indikator Spot Aktif Sesuai Nama Kartu (Desktop) */}
              <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-kabut backdrop-blur-md shadow-sm transition-all duration-300">
                <i
                  className={cn("bi text-fajar", activeCard.icon)}
                  aria-hidden="true"
                />
                <span>{activeCard.shortLabel}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2.5">
              <p className="font-heading text-[11px] sm:text-sm font-extrabold tracking-[0.28em] text-telaga-400 uppercase">
                {tHero("displayTitle")}
              </p>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-kabut sm:text-4xl lg:text-[3.35rem] leading-[1.15] lg:leading-[1.08]">
                {tHero("headline")}
              </h1>
            </div>
          </div>

          {/* BLOK 2 (Mobile: Tepat di Bawah Nama Wisata, Desktop: Kolom Kanan Penuh) — Tumpukan 5 Kartu Foto 3D Bernama */}
          <div className="order-2 lg:order-2 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-3 flex flex-col items-center self-center w-full">
            <div
              ref={cardStageRef}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) beginGesture(t.clientX, t.clientY);
              }}
              onTouchMove={(e) => {
                const t = e.touches[0];
                if (t) moveGesture(t.clientX, t.clientY);
              }}
              onTouchEnd={endGesture}
              onTouchCancel={endGesture}
              onMouseDown={(e) => {
                if (e.button === 0) beginGesture(e.clientX, e.clientY);
              }}
              onMouseMove={(e) => {
                moveGesture(e.clientX, e.clientY);
              }}
              onMouseUp={endGesture}
              onMouseLeave={endGesture}
              className="relative h-[312px] sm:h-[420px] w-full max-w-[330px] sm:max-w-[390px] flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
              style={{
                perspective: "1200px",
                touchAction: "pan-y",
              }}
            >
              {cards.map((card, idx) => {
                const isCurrent = idx === activeIndex;
                const offset = getCircularOffset(idx, activeIndex, cards.length);
                const tf = getCardTransform(
                  offset,
                  isMobileViewport,
                  dragDeltaX
                );
                const isCardLoaded = Boolean(loadedCardMap[card.id]);

                return (
                  <article
                    key={card.id}
                    onClick={() => {
                      if (gestureRef.current.swallowedClick) {
                        gestureRef.current.swallowedClick = false;
                        return;
                      }
                      goToCard(idx);
                    }}
                    style={{
                      transform: `translate3d(${tf.x}px, ${tf.y}px, ${tf.z}px) rotateY(${tf.rotateY}deg) scale(${tf.scale})`,
                      opacity: tf.opacity,
                      zIndex: tf.zIndex,
                      transition: isDragging
                        ? "none"
                        : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    className={cn(
                      "group absolute w-[236px] sm:w-[310px] h-[298px] sm:h-[395px] rounded-[24px] overflow-hidden cursor-pointer border will-change-[transform,opacity]",
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
                          : "opacity-100 skeleton-shimmer shadow-[inset_0_0_50px_rgba(0,0,0,0.85)]"
                      )}
                    />

                    <Image
                      src={card.media.url}
                      alt={card.media.alt || card.title}
                      fill
                      draggable={false}
                      sizes="(max-width: 640px) 236px, 310px"
                      quality={75}
                      onLoad={() =>
                        setLoadedCardMap((prev) =>
                          prev[card.id] ? prev : { ...prev, [card.id]: true }
                        )
                      }
                      className="object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/40 to-obsidian/15 pointer-events-none" />

                    {/* Baris Atas Kartu: Ikon Berkilau + Nama Spot Jelas */}
                    <div className="absolute top-3 left-3 right-3 sm:top-3.5 sm:left-3.5 sm:right-3.5 flex items-center justify-between gap-2 pointer-events-none">
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md transition-transform duration-300 group-hover:scale-110",
                          card.accentBadgeClass
                        )}
                      >
                        <i
                          className={cn("bi text-sm sm:text-base", card.icon)}
                          aria-hidden="true"
                        />
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/85 backdrop-blur-md border border-white/20 px-2.5 py-1 sm:px-3 text-[11px] font-extrabold text-kabut shadow-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-fajar" />
                        <span>{card.shortLabel}</span>
                      </span>
                    </div>

                    {/* Konten Bawah Kartu */}
                    <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-5 space-y-1.5 sm:space-y-2 pointer-events-none">
                      <span className="inline-block rounded-md bg-obsidian/80 border border-white/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-fajar uppercase">
                        {card.badge}
                      </span>
                      <h2 className="font-heading text-sm sm:text-lg font-extrabold text-kabut leading-snug drop-shadow-sm">
                        {card.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs font-semibold text-kabut/90">
                        {card.meta}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pemilih Kartu Bernama */}
            <div
              role="tablist"
              aria-label={tHero("galleryRegionAria")}
              className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-md"
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
                      "group inline-flex min-h-[38px] items-center gap-1.5 sm:gap-2 rounded-full border px-3 py-1.5 sm:px-3.5 text-xs font-bold transition-all duration-300 cursor-pointer",
                      isCurrent
                        ? "border-fajar bg-fajar text-obsidian shadow-[0_6px_18px_rgba(242,166,90,0.3)] scale-105"
                        : "border-white/15 bg-obsidian/85 text-kabut/85 hover:border-fajar/45 hover:text-kabut backdrop-blur-md"
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

          {/* BLOK 3 (Mobile: Tepat Setelah Card Foto -> Tiket!, Desktop: Kiri Baris 3) — Panel Kaca Pemilihan Paket Tiket Resmi */}
          <div className="order-3 lg:order-4 lg:col-span-7">
            <div className="surface-glass p-4 sm:p-5 space-y-4 max-w-2xl mx-auto lg:mx-0 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fajar/20 border border-fajar/40 text-fajar shadow-sm">
                    <i
                      className="bi bi-shield-fill-check text-sm"
                      aria-hidden="true"
                    />
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
                          <i
                            className="bi bi-compass-fill text-xs"
                            aria-hidden="true"
                          />
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
                        <span className="rounded-md bg-fajar px-2 py-0.5 text-[11px] font-extrabold text-obsidian shrink-0">
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
                        <span className="rounded-md bg-hutan px-2 py-0.5 text-[11px] font-extrabold text-fajar shrink-0">
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-kabut/90 text-center sm:text-left">
                    {tHero("basePlusParking", {
                      base: formatRupiah(
                        selectedProductSummary.basePrice,
                        locale
                      ),
                      parking: formatRupiah(
                        selectedProductSummary.parkingFee,
                        locale
                      ),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      scrollToCalculatorWithPackage(selectedPackage)
                    }
                    className="btn-ui btn-fajar w-full sm:w-auto justify-center text-xs px-4 py-3 sm:py-2.5 min-h-[44px] shadow-[0_10px_24px_rgba(242,166,90,0.25)]"
                  >
                    <i
                      className="bi bi-ticket-perforated-fill"
                      aria-hidden="true"
                    />
                    <span>
                      {tHero("panelSingleCta", {
                        packageName: selectedProductSummary.name,
                      })}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BLOK 4 (Khusus Desktop: Kiri Baris 2) — Deskripsi, Statistik Fakta & Navigasi Cepat */}
          <div className="hidden lg:block lg:order-3 lg:col-span-7 space-y-4">
            <p className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left text-xs sm:text-base leading-relaxed text-kabut/90">
              {tHero("subheadline")}
            </p>

            {/* Pita Statistik Fakta Destinasi */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs font-semibold text-kabut">
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3 py-2 shadow-md shadow-black/40 transition-all hover:border-fajar/45">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fajar/15 border border-fajar/30 text-fajar transition-transform group-hover:scale-110">
                  <i
                    className="bi bi-clock-history text-xs"
                    aria-hidden="true"
                  />
                </span>
                <span>
                  {batuLawang?.openTime ?? "06:00"}–
                  {batuLawang?.closeTime ?? "17:00"} WIB
                </span>
              </span>
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3 py-2 shadow-md shadow-black/40 transition-all hover:border-telaga-400/50">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-telaga/20 border border-telaga-400/35 text-telaga-200 transition-transform group-hover:scale-110">
                  <i
                    className="bi bi-signpost-split-fill text-xs"
                    aria-hidden="true"
                  />
                </span>
                <span>
                  {tHero("trailLengthStat", {
                    meters: totalTrailMeters,
                    posts: 4,
                  })}
                </span>
              </span>
              <span className="group inline-flex items-center gap-2 rounded-xl bg-obsidian/85 border border-kabut/20 px-3 py-2 shadow-md shadow-black/40 transition-all hover:border-fajar/45">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fajar/15 border border-fajar/30 text-fajar transition-transform group-hover:scale-110">
                  <i
                    className="bi bi-brightness-high-fill text-xs"
                    aria-hidden="true"
                  />
                </span>
                <span>
                  {tHero("elevationUnit", { value: summitElevation })} (
                  {tHero("climbDurationStat", { mins: totalTrailMinutes })})
                </span>
              </span>
            </div>

            {/* Baris Tombol Aksi Utama & Sekunder */}
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => scrollToCalculatorWithPackage(selectedPackage)}
                className="group btn-ui btn-fajar w-full sm:w-auto justify-center text-sm sm:text-base px-6 py-3.5 shadow-[0_10px_28px_rgba(242,166,90,0.28)]"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-obsidian/20 text-obsidian transition-transform group-hover:rotate-6 group-hover:scale-110">
                  <i
                    className="bi bi-ticket-perforated-fill"
                    aria-hidden="true"
                  />
                </span>
                <span>{tHero("ctaPrimary")}</span>
              </button>

              <Link
                href="/jalur"
                className="group btn-ui btn-glass w-full sm:w-auto justify-center text-sm sm:text-base px-5 py-3.5"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-fajar/20 border border-fajar/35 text-fajar transition-transform group-hover:rotate-12 group-hover:scale-110">
                  <i className="bi bi-compass-fill" aria-hidden="true" />
                </span>
                <span>{tHero("ctaMap")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

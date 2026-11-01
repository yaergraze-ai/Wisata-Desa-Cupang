"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import { formatVisitDateDisplay } from "@/lib/datetime-wib";
import { cn } from "@/lib/cn";
import type {
  PublicDestinationSummary,
  PublicProductSummary,
  PublicSlotMedia,
  PublicTrailPointSummary,
} from "@/server/catalog/public-catalog";

type GsapInstance = typeof import("gsap")["default"];

export interface HeroGalleryProps {
  locale: AppLocale;
  todayYmd: string;
  offTrailThresholdM: number;
  destinations: PublicDestinationSummary[];
  products: PublicProductSummary[];
  trailPoints: PublicTrailPointSummary[];
  mediaSlots: Record<string, PublicSlotMedia>;
}

interface HeroCardModel {
  id: string;
  slotKey: string;
  badge: string;
  shortLabel: string;
  title: string;
  meta: string;
  linkedPackageCode: "TIKET_PUTIH" | "REGULER_BL";
  media: PublicSlotMedia;
}

function getCircularOffset(index: number, activeIndex: number, total: number): number {
  let diff = index - activeIndex;
  const half = Math.floor(total / 2);
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;
  return diff;
}

function buildSsrCardStyle(offset: number): CSSProperties {
  const abs = Math.abs(offset);
  const extraShiftPx = abs === 2 ? Math.sign(offset) * -28 : 0;
  const targetZ = abs === 0 ? 0 : abs === 1 ? -95 : -190;
  const targetRotateY =
    abs === 0 ? 0 : abs === 1 ? -offset * 29 : -Math.sign(offset) * 37;
  const targetScale = abs === 0 ? 1 : abs === 1 ? 0.87 : 0.75;
  const targetOpacity = abs === 0 ? 1 : abs === 1 ? 0.86 : 0.56;

  return {
    transformStyle: "preserve-3d",
    zIndex: 30 - abs * 10,
    opacity: targetOpacity,
    transform: `translate3d(calc(var(--hero-spread) * ${offset} + ${extraShiftPx}px), 0px, ${targetZ}px) rotateY(${targetRotateY}deg) scale(${targetScale})`,
  };
}

export function HeroGallery({
  locale,
  todayYmd,
  offTrailThresholdM,
  destinations,
  products,
  trailPoints,
  mediaSlots,
}: HeroGalleryProps) {
  const tHero = useTranslations("Hero");

  const containerRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLParagraphElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragProxyRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeOverlayBgRef = useRef<HTMLDivElement | null>(null);
  const gsapRef = useRef<GsapInstance | null>(null);
  const hasHydratedTransformsRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPackageCode, setSelectedPackageCode] = useState<
    "TIKET_PUTIH" | "REGULER_BL"
  >("TIKET_PUTIH");
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [gsapReady, setGsapReady] = useState(false);

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
  const regulerProduct = useMemo(
    () => products.find((p) => p.code === "REGULER_BL") ?? products[0],
    [products]
  );
  const putihProduct = useMemo(
    () => products.find((p) => p.code === "TIKET_PUTIH") ?? products[1] ?? products[0],
    [products]
  );

  const totalTrailMeters = useMemo(
    () => trailPoints.reduce((sum, pt) => sum + pt.distFromPrevM, 0),
    [trailPoints]
  );
  const totalClimbMinutes = useMemo(
    () => trailPoints.reduce((sum, pt) => sum + pt.minsFromPrev, 0),
    [trailPoints]
  );

  const cards = useMemo<HeroCardModel[]>(() => {
    const fallbackMedia: PublicSlotMedia = mediaSlots["hero"] ?? {
      url: "/media/defaults/hero.webp",
      alt: tHero("headline"),
      width: 1920,
      height: 1080,
    };
    const regPrice = formatRupiah(regulerProduct?.totalPrice ?? 0, locale);
    const putihPrice = formatRupiah(putihProduct?.totalPrice ?? 0, locale);
    const blElev = batuLawang?.elevationM ?? 0;
    const gbElev = gunungBendera?.elevationM ?? 0;

    return [
      {
        id: "card-1",
        slotKey: "card-1",
        badge: tHero("cards.c1Badge"),
        shortLabel: tHero("cards.c1Short"),
        title: tHero("cards.c1Title"),
        meta: tHero("cards.c1Meta", {
          price: regPrice,
          elevation: blElev,
        }),
        linkedPackageCode: "REGULER_BL",
        media: mediaSlots["card-1"] ?? fallbackMedia,
      },
      {
        id: "card-2",
        slotKey: "card-2",
        badge: tHero("cards.c2Badge"),
        shortLabel: tHero("cards.c2Short"),
        title: tHero("cards.c2Title"),
        meta: tHero("cards.c2Meta", {
          price: putihPrice,
        }),
        linkedPackageCode: "TIKET_PUTIH",
        media: mediaSlots["card-2"] ?? fallbackMedia,
      },
      {
        id: "card-3",
        slotKey: "card-3",
        badge: tHero("cards.c3Badge"),
        shortLabel: tHero("cards.c3Short"),
        title: tHero("cards.c3Title"),
        meta: tHero("cards.c3Meta", {
          open: batuLawang?.openTime ?? "",
          close: batuLawang?.closeTime ?? "",
          elevation: blElev,
        }),
        linkedPackageCode: "REGULER_BL",
        media: mediaSlots["card-3"] ?? fallbackMedia,
      },
      {
        id: "card-4",
        slotKey: "card-4",
        badge: tHero("cards.c4Badge"),
        shortLabel: tHero("cards.c4Short"),
        title: tHero("cards.c4Title"),
        meta: tHero("cards.c4Meta", {
          meters: totalTrailMeters,
          threshold: offTrailThresholdM,
        }),
        linkedPackageCode: "TIKET_PUTIH",
        media: mediaSlots["card-4"] ?? fallbackMedia,
      },
      {
        id: "card-5",
        slotKey: "card-5",
        badge: tHero("cards.c5Badge"),
        shortLabel: tHero("cards.c5Short", { elevation: gbElev }),
        title: tHero("cards.c5Title"),
        meta: tHero("cards.c5Meta", {
          elevation: gbElev,
          mins: totalClimbMinutes,
        }),
        linkedPackageCode: "TIKET_PUTIH",
        media: mediaSlots["card-5"] ?? fallbackMedia,
      },
    ];
  }, [
    batuLawang,
    gunungBendera,
    locale,
    mediaSlots,
    offTrailThresholdM,
    putihProduct,
    regulerProduct,
    tHero,
    totalClimbMinutes,
    totalTrailMeters,
  ]);

  const totalCards = cards.length;
  const stepCardRef = useRef<(delta: number) => void>(() => undefined);

  const initialCardStyles = useMemo(
    () =>
      cards.map((_, idx) =>
        buildSsrCardStyle(getCircularOffset(idx, 0, totalCards))
      ),
    [cards, totalCards]
  );

  const goToCard = useCallback(
    (nextIdx: number) => {
      const wrapped = ((nextIdx % totalCards) + totalCards) % totalCards;
      setActiveIndex(wrapped);
    },
    [totalCards]
  );

  const stepCard = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => (((prev + delta) % totalCards) + totalCards) % totalCards);
    },
    [totalCards]
  );

  useEffect(() => {
    stepCardRef.current = stepCard;
  }, [stepCard]);

  // Deteksi prefers-reduced-motion
  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setPrefersReducedMotion(mqMotion.matches);
    updateMotion();
    mqMotion.addEventListener("change", updateMotion);
    return () => {
      mqMotion.removeEventListener("change", updateMotion);
    };
  }, []);

  // Muat GSAP + Draggable + SplitText saat idle atau interaksi pertama agar LCP & TBT ponsel optimal (§7.1)
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let splitRevert: (() => void) | undefined;
    let killDraggables: (() => void) | undefined;

    const loadGsapSuite = () => {
      if (started || cancelled) return;
      started = true;

      void Promise.all([
        import("gsap"),
        import("gsap/Draggable"),
        import("gsap/SplitText"),
      ]).then(([gsapMod, draggableMod, splitMod]) => {
        if (cancelled) return;
        const gsap = gsapMod.default;
        const { Draggable } = draggableMod;
        const { SplitText } = splitMod;

        gsap.registerPlugin(Draggable, SplitText);
        gsapRef.current = gsap;

        const isNarrow = window.matchMedia("(max-width: 639px)").matches;
        const spreadX = isNarrow ? 112 : 164;
        cardRefs.current.forEach((el, idx) => {
          if (!el) return;
          const offset = getCircularOffset(idx, 0, totalCards);
          const abs = Math.abs(offset);
          const hiddenOnMobile = isNarrow && abs > 1;
          const targetX = offset * spreadX - (abs === 2 ? Math.sign(offset) * 28 : 0);
          const targetZ = abs === 0 ? 0 : abs === 1 ? -95 : -190;
          const targetRotateY =
            abs === 0 ? 0 : abs === 1 ? -offset * 29 : -Math.sign(offset) * 37;
          const targetScale = abs === 0 ? 1 : abs === 1 ? 0.87 : 0.75;
          const targetOpacity = hiddenOnMobile
            ? 0
            : abs === 0
              ? 1
              : abs === 1
                ? 0.86
                : 0.56;

          gsap.set(el, {
            x: targetX,
            y: 0,
            z: targetZ,
            rotateY: targetRotateY,
            scale: targetScale,
            opacity: targetOpacity,
            zIndex: 30 - abs * 10,
            pointerEvents: hiddenOnMobile ? "none" : "auto",
          });
        });

        setGsapReady(true);

        if (titleRef.current) {
          const split = SplitText.create(titleRef.current, { type: "chars" });
          splitRevert = () => split.revert();
        }

        if (stageRef.current && dragProxyRef.current) {
          const instances = Draggable.create(dragProxyRef.current, {
            type: "x",
            trigger: stageRef.current,
            allowContextMenu: true,
            minimumMovement: 10,
            onPress: () => {
              setIsPaused(true);
            },
            onDragEnd: function () {
              const dx = this.endX - this.startX;
              gsap.set(this.target, { x: 0 });
              if (dx <= -42) {
                stepCardRef.current(1);
              } else if (dx >= 42) {
                stepCardRef.current(-1);
              }
              setIsPaused(false);
            },
          });
          killDraggables = () => instances.forEach((inst) => inst.kill());
        }
      });
    };

    const el = containerRef.current;
    el?.addEventListener("pointerdown", loadGsapSuite, { once: true, passive: true });
    el?.addEventListener("mouseenter", loadGsapSuite, { once: true, passive: true });
    el?.addEventListener("touchstart", loadGsapSuite, { once: true, passive: true });
    el?.addEventListener("keydown", loadGsapSuite, { once: true, passive: true });
    const timerId = window.setTimeout(loadGsapSuite, 7500);

    return () => {
      cancelled = true;
      el?.removeEventListener("pointerdown", loadGsapSuite);
      el?.removeEventListener("mouseenter", loadGsapSuite);
      el?.removeEventListener("touchstart", loadGsapSuite);
      el?.removeEventListener("keydown", loadGsapSuite);
      window.clearTimeout(timerId);
      killDraggables?.();
      splitRevert?.();
    };
  }, [totalCards]);

  // Autoplay ±6 detik, berhenti saat hover, fokus, tab tidak aktif, atau prefers-reduced-motion (§7.1)
  useEffect(() => {
    if (!gsapReady || prefersReducedMotion || isPaused) return;

    let hidden = document.hidden;
    const onVisChange = () => {
      hidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisChange);

    const intervalId = window.setInterval(() => {
      if (!hidden) {
        stepCard(1);
      }
    }, 6000);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [gsapReady, isPaused, prefersReducedMotion, stepCard]);

  // Transisi 3D coverflow kartu & cross-fade latar Ken Burns setiap kali activeIndex berubah (§7.1)
  useEffect(() => {
    const gsap = gsapRef.current;
    if (!gsap || !gsapReady) return;

    // Pada render awal activeIndex === 0, posisi SSR CSS sudah presisi
    if (!hasHydratedTransformsRef.current && activeIndex === 0) {
      hasHydratedTransformsRef.current = true;
      return;
    }
    hasHydratedTransformsRef.current = true;

    const isNarrow = window.matchMedia("(max-width: 639px)").matches;
    const spreadX = isNarrow ? 112 : 164;
    const duration = prefersReducedMotion ? 0 : 0.72;

    cards.forEach((_, idx) => {
      const el = cardRefs.current[idx];
      if (!el) return;
      const offset = getCircularOffset(idx, activeIndex, totalCards);
      const abs = Math.abs(offset);
      const hiddenOnMobile = isNarrow && abs > 1;

      const targetX = offset * spreadX - (abs === 2 ? Math.sign(offset) * 28 : 0);
      const targetZ = abs === 0 ? 0 : abs === 1 ? -95 : -190;
      const targetRotateY =
        abs === 0 ? 0 : abs === 1 ? -offset * 29 : -Math.sign(offset) * 37;
      const targetScale = abs === 0 ? 1 : abs === 1 ? 0.87 : 0.75;
      const targetOpacity = hiddenOnMobile
        ? 0
        : abs === 0
          ? 1
          : abs === 1
            ? 0.86
            : 0.56;

      gsap.set(el, {
        zIndex: 30 - abs * 10,
        pointerEvents: hiddenOnMobile ? "none" : "auto",
      });

      gsap.to(el, {
        x: targetX,
        y: 0,
        z: targetZ,
        rotateY: targetRotateY,
        scale: targetScale,
        opacity: targetOpacity,
        duration,
        ease: "expo.out",
        overwrite: "auto",
      });
    });

    if (activeOverlayBgRef.current && activeIndex !== 0) {
      if (prefersReducedMotion) {
        gsap.set(activeOverlayBgRef.current, { opacity: 0.56, scale: 1 });
      } else {
        gsap.fromTo(
          activeOverlayBgRef.current,
          { opacity: 0, scale: 1.05 },
          {
            opacity: 0.56,
            scale: 1.0,
            duration: 5.6,
            ease: "sine.out",
            overwrite: "auto",
          }
        );
      }
    }
  }, [activeIndex, cards, gsapReady, prefersReducedMotion, totalCards]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepCard(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      stepCard(1);
    }
  }

  function handleJumpToCalculator(packageCode: "TIKET_PUTIH" | "REGULER_BL") {
    setSelectedPackageCode(packageCode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("wisata:select-package", {
          detail: { packageCode },
        })
      );
      const calcEl = document.getElementById("kalkulator-tiket");
      calcEl?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }
  }

  const baseCard = cards[0]!;
  const activeCard = cards[activeIndex] ?? baseCard;
  const selectedProduct =
    selectedPackageCode === "TIKET_PUTIH" ? putihProduct : regulerProduct;

  return (
    <section
      ref={containerRef}
      aria-label={tHero("galleryRegionAria")}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      className="relative overflow-hidden border-b border-kabut/15 pt-8 pb-14 sm:pt-12 sm:pb-20"
    >
      {/* Latar Hero: Lapisan Dasar LCP Statis + Lapisan Cross-Fade Ken Burns (§7.1) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <Image
          src={baseCard.media.url}
          alt=""
          fill
          priority
          fetchPriority="high"
          decoding="sync"
          quality={75}
          sizes="(max-width: 640px) 360px, 100vw"
          className="object-cover opacity-52"
        />

        {gsapReady && activeIndex !== 0 ? (
          <div
            key={activeCard.id}
            ref={activeOverlayBgRef}
            className="absolute inset-0 opacity-0 will-change-transform"
          >
            <Image
              src={activeCard.media.url}
              alt=""
              fill
              quality={75}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-b from-obsidian/80 via-obsidian/55 to-obsidian" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian/85 via-transparent to-obsidian/80" />
      </div>

      {/* Pembaca Layar aria-live untuk Kartu Aktif (Fixed 1x1 agar 0 CLS §7.1) */}
      <p
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden opacity-0"
      >
        {tHero("cardAnnouncement", {
          index: activeIndex + 1,
          total: totalCards,
          title: activeCard.title,
        })}
      </p>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Hero & Judul Raksasa SplitText "CIREBON" */}
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-kabut/25 bg-hutan/90 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-fajar uppercase">
            <i className="bi bi-geo-alt-fill" aria-hidden="true" />
            <span>{tHero("eyebrow")}</span>
          </p>

          <p
            ref={titleRef}
            aria-hidden="true"
            className="hero-display-title mt-2 overflow-hidden select-none"
          >
            {Array.from(tHero("displayTitle")).map((ch, charIdx) => (
              <span
                key={`${charIdx}-${ch}`}
                style={{ animationDelay: `${charIdx * 38}ms` }}
                className="hero-split-char"
              >
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </p>

          <h1 className="mt-3 max-w-3xl font-heading text-2xl font-bold text-kabut sm:text-4xl">
            {tHero("headline")}
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm text-kabut/90 sm:text-base">
            {tHero("subheadline")}
          </p>
        </div>

        {/* Grid Utama: Galeri 5 Kartu 3D Miring (Kiri) + Panel Tiket Kaca (Kanan) */}
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-12">
          {/* Kolom Kiri: Satu Galeri Hero Terpadu Berbasis GSAP (§7.1) */}
          <div className="lg:col-span-7">
            <div
              ref={dragProxyRef}
              aria-hidden="true"
              className="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
            />

            <div
              ref={stageRef}
              style={{ perspective: "1200px" }}
              className="hero-stage relative mx-auto flex h-[370px] w-full max-w-2xl items-center justify-center touch-pan-y select-none sm:h-[420px]"
            >
              {cards.map((card, idx) => {
                const isActive = idx === activeIndex;
                const offset = getCircularOffset(idx, activeIndex, totalCards);
                const absOffset = Math.abs(offset);

                return (
                  <button
                    key={card.id}
                    ref={(el) => {
                      cardRefs.current[idx] = el;
                    }}
                    type="button"
                    data-abs-offset={absOffset}
                    onClick={() => {
                      if (isActive) {
                        handleJumpToCalculator(card.linkedPackageCode);
                      } else {
                        goToCard(idx);
                      }
                    }}
                    aria-current={isActive ? "true" : undefined}
                    style={
                      !gsapReady
                        ? buildSsrCardStyle(offset)
                        : initialCardStyles[idx]
                    }
                    className={cn(
                      "hero-card group absolute h-[335px] w-[238px] overflow-hidden rounded-2xl border text-left shadow-2xl transition-colors sm:h-[380px] sm:w-[272px] cursor-pointer",
                      isActive
                        ? "border-fajar ring-2 ring-fajar/45"
                        : "border-kabut/25 hover:border-kabut/55"
                    )}
                  >
                    <Image
                      src={card.media.url}
                      alt={card.media.alt}
                      fill
                      loading={idx === 0 ? "eager" : "lazy"}
                      quality={75}
                      sizes="(max-width: 640px) 240px, 280px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/45 to-obsidian/20" />

                    <div className="relative flex h-full flex-col justify-between p-4 sm:p-5">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-kabut/25 bg-obsidian/85 px-2.5 py-1 text-[11px] font-bold tracking-wide text-fajar uppercase">
                        <i className="bi bi-compass-fill" aria-hidden="true" />
                        <span>{card.shortLabel}</span>
                      </span>

                      <div>
                        <p className="text-[11px] font-bold tracking-wider text-telaga-200 uppercase">
                          {card.badge}
                        </p>
                        <h2 className="mt-1 font-heading text-lg font-bold leading-snug text-kabut sm:text-xl">
                          {card.title}
                        </h2>
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-hutan/90 border border-telaga-700 px-2.5 py-1 text-xs font-semibold text-kabut">
                          <i className="bi bi-tag-fill text-fajar" aria-hidden="true" />
                          <span>{card.meta}</span>
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Kontrol Panah, Indikator Kartu & Petunjuk Keyboard/Geser */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stepCard(-1)}
                  aria-label={tHero("prevSlide")}
                  className="btn-ui btn-glass min-w-[44px] px-3"
                >
                  <i className="bi bi-arrow-left text-base" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => stepCard(1)}
                  aria-label={tHero("nextSlide")}
                  className="btn-ui btn-glass min-w-[44px] px-3"
                >
                  <i className="bi bi-arrow-right text-base" aria-hidden="true" />
                </button>

                <div className="ml-1 flex items-center gap-1">
                  {cards.map((card, idx) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => goToCard(idx)}
                      aria-label={card.title}
                      aria-pressed={idx === activeIndex}
                      className="inline-flex min-h-[44px] min-w-[36px] items-center justify-center cursor-pointer"
                    >
                      <span
                        className={cn(
                          "block h-2 rounded-full transition-all",
                          idx === activeIndex
                            ? "w-7 bg-fajar"
                            : "w-2 bg-kabut/40 hover:bg-kabut/75"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-kabut/80">
                <i className="bi bi-hand-index-thumb mr-1.5 text-fajar" aria-hidden="true" />
                <span>{tHero("dragHint")}</span>
              </p>
            </div>
          </div>

          {/* Kolom Kanan: Panel Tiket Kaca dengan 2 Paket DB & 1 CTA Utama (§7.1) */}
          <aside className="lg:col-span-5">
            <div className="glass-dark p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-obsidian/80 border border-telaga-700 px-3 py-1 text-xs font-bold text-fajar">
                  <i className="bi bi-shield-check" aria-hidden="true" />
                  <span>{tHero("panelBadge")}</span>
                </span>
                <span className="text-xs font-medium text-kabut/85">
                  {formatVisitDateDisplay(todayYmd, locale)} WIB
                </span>
              </div>

              <h2 className="mt-3 font-heading text-xl font-bold text-kabut sm:text-2xl">
                {tHero("panelHeading")}
              </h2>

              {/* Dua Pilihan Paket dari DB */}
              <div className="mt-4 space-y-3">
                {[putihProduct, regulerProduct]
                  .filter((p): p is PublicProductSummary => Boolean(p))
                  .map((prod) => {
                    const code =
                      prod.code === "TIKET_PUTIH" ? "TIKET_PUTIH" : "REGULER_BL";
                    const isSelected = selectedPackageCode === code;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => setSelectedPackageCode(code)}
                        aria-pressed={isSelected}
                        className={cn(
                          "w-full rounded-xl border p-4 text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-fajar bg-obsidian/90 ring-2 ring-fajar/35"
                            : "border-kabut/20 bg-obsidian/60 hover:border-kabut/45"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                                  isSelected
                                    ? "border-fajar bg-fajar text-hutan-950"
                                    : "border-kabut/40 text-transparent"
                                )}
                              >
                                <i className="bi bi-check-lg" aria-hidden="true" />
                              </span>
                              <p className="font-heading text-base font-bold text-kabut">
                                {prod.name}
                              </p>
                            </div>
                            <p className="mt-1.5 text-xs text-kabut/80">
                              {tHero("basePlusParking", {
                                base: formatRupiah(prod.basePrice, locale),
                                parking: formatRupiah(prod.parkingFee, locale),
                              })}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-heading text-xl font-extrabold text-fajar">
                              {formatRupiah(prod.totalPrice, locale)}
                            </p>
                            {isSelected ? (
                              <span className="inline-block mt-0.5 rounded bg-fajar/20 px-2 py-0.5 text-[11px] font-bold text-fajar">
                                {tHero("panelSelected")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Ringkasan Kuota Hari Ini dari DB */}
              <div className="mt-4 rounded-xl border border-kabut/15 bg-obsidian/70 p-3.5">
                <p className="text-xs font-semibold text-kabut/80">
                  {tHero("quotaTodayLabel", {
                    date: formatVisitDateDisplay(todayYmd, locale),
                  })}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2.5 text-xs">
                  {destinations.map((dest) => (
                    <div
                      key={dest.id}
                      className="rounded-lg border border-kabut/15 bg-hutan/70 px-3 py-2"
                    >
                      <p className="font-semibold text-kabut">{dest.name}</p>
                      <p className="mt-0.5 font-bold text-fajar">
                        {tHero("quotaRemaining", {
                          remaining: dest.remainingToday,
                          capacity: dest.capacityToday,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Satu CTA Utama pada Panel Tiket Kaca (§7.1) */}
              <button
                type="button"
                onClick={() => handleJumpToCalculator(selectedPackageCode)}
                className="mt-5 w-full btn-ui btn-fajar"
              >
                <i className="bi bi-ticket-detailed-fill text-base" aria-hidden="true" />
                <span>
                  {tHero("panelSingleCta", {
                    packageName:
                      selectedProduct?.code === "TIKET_PUTIH"
                        ? tHero("cards.c2Short")
                        : tHero("cards.c1Short"),
                  })}
                </span>
              </button>

              <p className="mt-2.5 text-center text-xs text-kabut/80">
                {tHero("panelParkingNote")}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

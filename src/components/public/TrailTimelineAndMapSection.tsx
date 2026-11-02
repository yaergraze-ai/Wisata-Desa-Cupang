"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type {
  PublicDestinationSummary,
  PublicSlotMedia,
  PublicTrailPointSummary,
} from "@/server/catalog/public-catalog";

export interface TrailTimelineAndMapSectionProps {
  offTrailThresholdM: number;
  destinations: PublicDestinationSummary[];
  trailPoints: PublicTrailPointSummary[];
  mediaSlots: Record<string, PublicSlotMedia>;
}

interface TimelineStage {
  id: string;
  title: string;
  subtitle: string;
  focusCode: string;
  points: PublicTrailPointSummary[];
  photoA: PublicSlotMedia | undefined;
  photoB: PublicSlotMedia | undefined;
}

interface ProjectedMapPoint {
  code: string;
  name: string;
  note: string;
  lat: number;
  lng: number;
  elevationM: number;
  distFromPrevM: number;
  minsFromPrev: number;
  isBatuLawang: boolean;
  svgX: number;
  svgY: number;
}

export function TrailTimelineAndMapSection({
  offTrailThresholdM,
  destinations,
  trailPoints,
  mediaSlots,
}: TrailTimelineAndMapSectionProps) {
  const tTimeline = useTranslations("Timeline");
  const tHero = useTranslations("Hero");
  const tHome = useTranslations("Home");

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const progressLineRef = useRef<SVGLineElement | null>(null);
  const mapCardRef = useRef<HTMLDivElement | null>(null);

  const [focusedCode, setFocusedCode] = useState<string>("GATE");

  const totalMeters = useMemo(
    () => trailPoints.reduce((acc, p) => acc + p.distFromPrevM, 0),
    [trailPoints]
  );
  const totalMinutes = useMemo(
    () => trailPoints.reduce((acc, p) => acc + p.minsFromPrev, 0),
    [trailPoints]
  );
  const summitPoint = useMemo(
    () => trailPoints.find((p) => p.code === "SUMMIT") ?? trailPoints[trailPoints.length - 1],
    [trailPoints]
  );

  const batuLawang = useMemo(
    () => destinations.find((d) => d.slug === "batu-lawang"),
    [destinations]
  );

  // 4 Tahap Linimasa: Pintu → Pos 1–2 → Pos 3–4 → Puncak (§7.2)
  const stages = useMemo<TimelineStage[]>(() => {
    const byCode = new Map(trailPoints.map((p) => [p.code, p]));
    const gate = byCode.get("GATE");
    const pos1 = byCode.get("POS-1");
    const pos2 = byCode.get("POS-2");
    const pos3 = byCode.get("POS-3");
    const pos4 = byCode.get("POS-4");
    const summit = byCode.get("SUMMIT");

    return [
      {
        id: "stage-1",
        title: tTimeline("stage1Title"),
        subtitle: tTimeline("stage1Subtitle"),
        focusCode: "GATE",
        points: [gate].filter((p): p is PublicTrailPointSummary => Boolean(p)),
        photoA: mediaSlots["timeline-1a"],
        photoB: mediaSlots["timeline-1b"],
      },
      {
        id: "stage-2",
        title: tTimeline("stage2Title"),
        subtitle: tTimeline("stage2Subtitle"),
        focusCode: "POS-1",
        points: [pos1, pos2].filter((p): p is PublicTrailPointSummary => Boolean(p)),
        photoA: mediaSlots["timeline-2a"],
        photoB: mediaSlots["timeline-1a"],
      },
      {
        id: "stage-3",
        title: tTimeline("stage3Title"),
        subtitle: tTimeline("stage3Subtitle"),
        focusCode: "POS-3",
        points: [pos3, pos4].filter((p): p is PublicTrailPointSummary => Boolean(p)),
        photoA: mediaSlots["timeline-2b"],
        photoB: mediaSlots["timeline-3a"],
      },
      {
        id: "stage-4",
        title: tTimeline("stage4Title"),
        subtitle: tTimeline("stage4Subtitle"),
        focusCode: "SUMMIT",
        points: [summit].filter((p): p is PublicTrailPointSummary => Boolean(p)),
        photoA: mediaSlots["timeline-3b"],
        photoB: mediaSlots["timeline-3a"],
      },
    ];
  }, [mediaSlots, tTimeline, trailPoints]);

  // Proyeksi koordinat GPS nyata (Batu Lawang + 6 TrailPoint Gunung Bendera) ke kanvas SVG topografi
  const projectedPoints = useMemo<ProjectedMapPoint[]>(() => {
    const rawList: Array<Omit<ProjectedMapPoint, "svgX" | "svgY">> = [];
    if (batuLawang) {
      rawList.push({
        code: "BATU-LAWANG",
        name: batuLawang.name,
        note: batuLawang.description,
        lat: batuLawang.lat,
        lng: batuLawang.lng,
        elevationM: batuLawang.elevationM,
        distFromPrevM: 0,
        minsFromPrev: 0,
        isBatuLawang: true,
      });
    }
    for (const pt of trailPoints) {
      rawList.push({
        code: pt.code,
        name: pt.name,
        note: pt.note,
        lat: pt.lat,
        lng: pt.lng,
        elevationM: pt.elevationM,
        distFromPrevM: pt.distFromPrevM,
        minsFromPrev: pt.minsFromPrev,
        isBatuLawang: false,
      });
    }

    if (rawList.length === 0) return [];

    const lats = rawList.map((p) => p.lat);
    const lngs = rawList.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.0005, maxLat - minLat);
    const lngSpan = Math.max(0.0005, maxLng - minLng);

    const padX = 72;
    const padY = 54;
    const width = 560 - padX * 2;
    const height = 420 - padY * 2;

    return rawList.map((item) => {
      const normX = (item.lng - minLng) / lngSpan;
      // Orientasi pendakian menanjak dari bawah ke atas: Pintu masuk di bawah, Puncak 520 mdpl di atas kanvas
      const normY = (item.lat - minLat) / latSpan;
      return {
        ...item,
        svgX: Math.round((padX + normX * width) * 10) / 10,
        svgY: Math.round((padY + normY * height) * 10) / 10,
      };
    });
  }, [batuLawang, trailPoints]);

  const trailPolylinePoints = useMemo(
    () =>
      projectedPoints
        .filter((p) => !p.isBatuLawang)
        .map((p) => `${p.svgX},${p.svgY}`)
        .join(" "),
    [projectedPoints]
  );

  const connectorLine = useMemo(() => {
    const bl = projectedPoints.find((p) => p.isBatuLawang);
    const gate = projectedPoints.find((p) => p.code === "GATE");
    if (!bl || !gate) return null;
    return { x1: bl.svgX, y1: bl.svgY, x2: gate.svgX, y2: gate.svgY };
  }, [projectedPoints]);

  const activeMapPoint = useMemo(
    () =>
      projectedPoints.find((p) => p.code === focusedCode) ??
      projectedPoints.find((p) => p.code === "GATE") ??
      projectedPoints[0],
    [focusedCode, projectedPoints]
  );

  // GSAP ScrollTrigger dimuat saat mendekati viewport: garis SVG scrub, reveal 24px sekali jalan, dan paralaks foto ±8% (§7.2)
  useEffect(() => {
    const rootEl = sectionRef.current;
    if (!rootEl) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let cancelled = false;
    let cleanupCtx: (() => void) | undefined;

    const initScrollAnimations = () => {
      void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
        ([gsapMod, stMod]) => {
          if (cancelled || !sectionRef.current) return;
          const gsap = gsapMod.default;
          const { ScrollTrigger } = stMod;
          gsap.registerPlugin(ScrollTrigger);

          const ctx = gsap.context(() => {
            if (progressLineRef.current && timelineWrapRef.current) {
              gsap.fromTo(
                progressLineRef.current,
                { strokeDashoffset: 1000 },
                {
                  strokeDashoffset: 0,
                  ease: "none",
                  scrollTrigger: {
                    trigger: timelineWrapRef.current,
                    start: "top 72%",
                    end: "bottom 65%",
                    scrub: 0.5,
                  },
                }
              );
            }

            const stageCards = gsap.utils.toArray<HTMLElement>("[data-timeline-stage]");
            stageCards.forEach((card) => {
              gsap.from(card, {
                y: 24,
                duration: 0.65,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: card,
                  start: "top 88%",
                  once: true,
                },
              });
            });

            const parallaxPhotos = gsap.utils.toArray<HTMLElement>(
              "[data-timeline-parallax]"
            );
            parallaxPhotos.forEach((imgWrap) => {
              gsap.fromTo(
                imgWrap,
                { yPercent: -8 },
                {
                  yPercent: 8,
                  ease: "none",
                  scrollTrigger: {
                    trigger: imgWrap,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                  },
                }
              );
            });
          }, sectionRef);

          cleanupCtx = () => ctx.revert();
        }
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          initScrollAnimations();
        }
      },
      { rootMargin: "360px 0px" }
    );
    observer.observe(rootEl);

    return () => {
      cancelled = true;
      observer.disconnect();
      cleanupCtx?.();
    };
  }, []);

  function focusPointAndScrollToMap(code: string) {
    setFocusedCode(code);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapCardRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
    });
  }

  function selectPackageAndJump(packageCode: "TIKET_PUTIH" | "REGULER_BL") {
    window.dispatchEvent(
      new CustomEvent("wisata:select-package", {
        detail: { packageCode },
      })
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("kalkulator-tiket")?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <div ref={sectionRef} className="space-y-16">
      {/* Bagian Linimasa 4 Tahap Jalur dengan Garis SVG Scrub & Paralaks ±8% (§7.2) */}
      <div>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-wider text-fajar uppercase">
              {tTimeline("eyebrow")}
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold text-kabut sm:text-3xl">
              {tTimeline("heading")}
            </h2>
            <p className="mt-2 text-sm text-kabut/85">{tTimeline("lead")}</p>
          </div>

          {/* Statistik Jalur Nyata dari DB TrailPoint */}
          <dl className="grid grid-cols-3 gap-3 rounded-2xl border border-kabut/15 bg-hutan p-3.5 text-xs">
            <div>
              <dt className="text-kabut/75">{tTimeline("totalDistanceLabel")}</dt>
              <dd className="mt-1 font-heading text-base font-bold text-fajar">
                {tTimeline("totalDistanceValue", { meters: totalMeters })}
              </dd>
            </div>
            <div className="border-l border-kabut/15 pl-3">
              <dt className="text-kabut/75">{tTimeline("totalDurationLabel")}</dt>
              <dd className="mt-1 font-heading text-base font-bold text-kabut">
                {tTimeline("totalDurationValue", { mins: totalMinutes })}
              </dd>
            </div>
            <div className="border-l border-kabut/15 pl-3">
              <dt className="text-kabut/75">{tTimeline("summitElevationLabel")}</dt>
              <dd className="mt-1 font-heading text-base font-bold text-telaga-200">
                {tHero("elevationUnit", { value: summitPoint?.elevationM ?? 0 })}
              </dd>
            </div>
          </dl>
        </div>

        {/* Navigasi Profil Elevasi Gunung (Altimeter Bar) */}
        <div className="mt-8 surface-solid-dark p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-telaga/20 border border-telaga/40 flex items-center justify-center text-telaga shadow-sm">
              <i className="bi bi-graph-up-arrow text-sm" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                Profil Ketinggian Jalur Pendakian
              </p>
              <p className="text-[11px] text-kabut/70">
                Kenaikan bertahap dari 210 mdpl menuju puncak tertinggi 520 mdpl
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {stages.map((stg, i) => {
              const elev = i === 0 ? "210 mdpl" : i === 1 ? "290 mdpl" : i === 2 ? "410 mdpl" : "520 mdpl";
              const tag = i === 0 ? "Pintu" : i === 1 ? "Kanopi" : i === 2 ? "Punggung" : "Puncak 👑";
              const isSelected = stg.points.some((p) => p.code === focusedCode);
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => focusPointAndScrollToMap(stg.focusCode)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                    isSelected
                      ? "bg-fajar text-obsidian shadow-md shadow-fajar/30 scale-[1.03]"
                      : "bg-white/5 border border-white/10 text-kabut hover:bg-white/10"
                  )}
                >
                  <span className={isSelected ? "text-obsidian" : "text-fajar font-mono"}>
                    {i + 1}.
                  </span>
                  <span>{elev}</span>
                  <span className={isSelected ? "text-obsidian/70" : "text-kabut/60 hidden sm:inline"}>
                    ({tag})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Garis Vertikal SVG + 4 Tahap Asimetris Mountain Journey */}
        <div ref={timelineWrapRef} className="relative mt-10 pl-8 sm:pl-12">
          <svg
            aria-hidden="true"
            viewBox="0 0 12 1000"
            preserveAspectRatio="none"
            className="pointer-events-none absolute top-3 bottom-3 left-2.5 w-3 sm:left-4"
          >
            <line
              x1="6"
              y1="0"
              x2="6"
              y2="1000"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="3"
              strokeDasharray="6 6"
            />
            <line
              ref={progressLineRef}
              x1="6"
              y1="0"
              x2="6"
              y2="1000"
              stroke="#F2A65A"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="1000"
              strokeDashoffset="0"
            />
          </svg>

          <div className="space-y-10">
            {stages.map((stage, stageIdx) => {
              const isStageFocused = stage.points.some((p) => p.code === focusedCode);
              const isSummit = stageIdx === 3;
              const isOdd = stageIdx % 2 === 1; // Stage 2 & 4 alternating layout
              const altitudeTag =
                stageIdx === 0
                  ? "Elevasi Dasar 210 mdpl"
                  : stageIdx === 1
                  ? "↗ Tanjakan +80m (290 mdpl)"
                  : stageIdx === 2
                  ? "↗ Tanjakan +120m (410 mdpl)"
                  : "👑 Puncak Tertinggi 520 mdpl (+110m)";

              return (
                <article
                  key={stage.id}
                  data-timeline-stage=""
                  className={cn(
                    "relative surface-solid-dark p-6 sm:p-8 transition-all duration-300 rounded-3xl",
                    isSummit
                      ? "border-fajar/60 ring-2 ring-fajar/25 bg-gradient-to-br from-white/10 via-obsidian/90 to-fajar/10 shadow-2xl shadow-fajar/15"
                      : isStageFocused
                      ? "border-fajar shadow-xl shadow-fajar/10"
                      : "border-white/10 hover:border-white/20"
                  )}
                >
                  {/* Penanda Bulat Dinamis di Garis SVG */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-[2.1rem] top-7 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-black shadow-lg transition-transform sm:-left-[2.9rem]",
                      isSummit
                        ? "border-fajar bg-fajar text-obsidian shadow-fajar/50 scale-110"
                        : isStageFocused
                        ? "border-fajar bg-fajar text-obsidian"
                        : "border-telaga bg-obsidian text-kabut"
                    )}
                  >
                    {isSummit ? "👑" : stageIdx + 1}
                  </span>

                  {/* KONTEN TAHAP DENGAN ASIMETRIS / ZIG-ZAG */}
                  <div
                    className={cn(
                      "grid items-center gap-6 lg:grid-cols-12",
                      isOdd && !isSummit ? "lg:grid-flow-dense" : ""
                    )}
                  >
                    {/* Teks & Checkpoint Pos */}
                    <div
                      className={cn(
                        "lg:col-span-7 space-y-4",
                        isOdd && !isSummit ? "lg:col-start-6" : ""
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
                              isSummit
                                ? "bg-fajar text-obsidian shadow-sm shadow-fajar/30"
                                : "bg-white/10 border border-white/15 text-fajar"
                            )}
                          >
                            <i className="bi bi-geo-alt-fill text-[10px]" aria-hidden="true" />
                            <span>{altitudeTag}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => focusPointAndScrollToMap(stage.focusCode)}
                          className={cn(
                            "btn-ui text-xs px-3 py-1.5",
                            isStageFocused ? "btn-fajar" : "btn-glass"
                          )}
                        >
                          <i className="bi bi-crosshair" aria-hidden="true" />
                          <span>
                            {isStageFocused
                              ? tTimeline("focusedBadge")
                              : tTimeline("focusOnMapBtn")}
                          </span>
                        </button>
                      </div>

                      <div>
                        <h3
                          className={cn(
                            "font-heading text-xl font-bold text-white sm:text-2xl",
                            isSummit ? "text-fajar drop-shadow-md" : ""
                          )}
                        >
                          {stage.title}
                        </h3>
                        <p className="mt-1.5 text-sm text-kabut/80 leading-relaxed">
                          {stage.subtitle}
                        </p>
                      </div>

                      {/* Kartu Pos di Dalam Tahap */}
                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        {stage.points.map((pt) => {
                          const isPtFocused = focusedCode === pt.code;
                          return (
                            <button
                              key={pt.id}
                              type="button"
                              onClick={() => focusPointAndScrollToMap(pt.code)}
                              className={cn(
                                "rounded-2xl border p-4 text-left transition-all cursor-pointer backdrop-blur-sm",
                                isPtFocused
                                  ? "border-fajar bg-obsidian ring-1 ring-fajar/40 shadow-md shadow-fajar/10"
                                  : "border-white/10 bg-obsidian/60 hover:border-white/25 hover:bg-obsidian/80"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                <span className="rounded-lg bg-white/10 px-2 py-0.5 text-fajar font-mono">
                                  {pt.code}
                                </span>
                                <span className="text-white font-mono">
                                  {tHero("elevationUnit", { value: pt.elevationM })}
                                </span>
                              </div>
                              <p className="mt-2 font-heading text-base font-bold text-white">
                                {pt.name}
                              </p>
                              <p className="mt-1 text-xs text-kabut/70 line-clamp-2">
                                {pt.note}
                              </p>
                              <p className="mt-2 text-xs font-semibold text-telaga-300">
                                {pt.order === 0
                                  ? tHome("startPoint")
                                  : tHome("distFromPrev", {
                                      meters: pt.distFromPrevM,
                                      mins: pt.minsFromPrev,
                                    })}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Foto Linimasa dengan Paralaks & Sudut Estetik */}
                    <div
                      className={cn(
                        "grid grid-cols-2 gap-3 lg:col-span-5",
                        isOdd && !isSummit ? "lg:col-start-1" : ""
                      )}
                    >
                      {[stage.photoA, stage.photoB]
                        .filter((m): m is PublicSlotMedia => Boolean(m))
                        .map((media, photoIdx) => (
                          <div
                            key={`${stage.id}-photo-${photoIdx}`}
                            className={cn(
                              "relative overflow-hidden rounded-2xl border border-white/15 bg-obsidian shadow-lg",
                              isSummit ? "h-48 sm:h-56" : "h-40 sm:h-44",
                              photoIdx === 1 && !isSummit ? "mt-3" : ""
                            )}
                          >
                            <div
                              data-timeline-parallax=""
                              className="absolute -inset-y-4 inset-x-0"
                            >
                              <Image
                                src={media.url}
                                alt={media.alt}
                                fill
                                sizes="(max-width: 1024px) 45vw, 240px"
                                className="object-cover transition-transform duration-500 hover:scale-105"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-transparent pointer-events-none" />
                          </div>
                        ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Seksi Pratinjau Peta Koridor Jalur & Titik Pos Interaktif (#peta-jalur, §6.A & §6.G) */}
      <div
        id="peta-jalur"
        ref={mapCardRef}
        className="surface-solid-dark p-6 sm:p-8 scroll-mt-24"
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-wider text-fajar uppercase">
              {tTimeline("mapPreviewEyebrow")}
            </p>
            <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
              {tTimeline("mapPreviewHeading")}
            </h2>
            <p className="mt-1.5 text-sm text-kabut/85">
              {tTimeline("mapPreviewLead")}
            </p>
          </div>

          <Link href="/jalur" className="btn-ui btn-telaga shrink-0">
            <i className="bi bi-compass-fill" aria-hidden="true" />
            <span>{tTimeline("openFullNavigator")}</span>
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Kanvas Peta Koordinat SVG Interaktif */}
          <div className="rounded-2xl border border-kabut/20 bg-obsidian p-3 sm:p-4 lg:col-span-7">
            <svg
              role="img"
              aria-label={tTimeline("svgMapAria")}
              viewBox="0 0 560 420"
              className="h-auto w-full select-none"
            >
              {/* Garis Kontur Topografi Latar */}
              <ellipse
                cx="300"
                cy="220"
                rx="235"
                ry="165"
                fill="none"
                stroke="rgba(232,241,236,0.07)"
                strokeWidth="1.2"
              />
              <ellipse
                cx="310"
                cy="235"
                rx="170"
                ry="118"
                fill="none"
                stroke="rgba(47,143,131,0.14)"
                strokeWidth="1.2"
              />
              <ellipse
                cx="260"
                cy="315"
                rx="110"
                ry="68"
                fill="none"
                stroke="rgba(242,166,90,0.12)"
                strokeWidth="1.2"
              />

              {/* Jalur Penghubung Kawasan Batu Lawang ke Pintu Gunung Bendera */}
              {connectorLine ? (
                <line
                  x1={connectorLine.x1}
                  y1={connectorLine.y1}
                  x2={connectorLine.x2}
                  y2={connectorLine.y2}
                  stroke="rgba(232,241,236,0.35)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
              ) : null}

              {/* Koridor Aman ±35m & Polyline Resmi Gunung Bendera */}
              {trailPolylinePoints ? (
                <>
                  <polyline
                    points={trailPolylinePoints}
                    fill="none"
                    stroke="rgba(47,143,131,0.28)"
                    strokeWidth="22"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={trailPolylinePoints}
                    fill="none"
                    stroke="#F2A65A"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}

              {/* Titik Marker Interaktif */}
              {projectedPoints.map((pt) => {
                const isSelected = activeMapPoint?.code === pt.code;
                return (
                  <g
                    key={pt.code}
                    onClick={() => setFocusedCode(pt.code)}
                    className="cursor-pointer"
                  >
                    {isSelected ? (
                      <circle
                        cx={pt.svgX}
                        cy={pt.svgY}
                        r="18"
                        fill="rgba(242,166,90,0.24)"
                        stroke="#F2A65A"
                        strokeWidth="1.5"
                      />
                    ) : null}
                    <circle
                      cx={pt.svgX}
                      cy={pt.svgY}
                      r={isSelected ? "9" : "7"}
                      fill={
                        isSelected
                          ? "#F2A65A"
                          : pt.isBatuLawang
                            ? "#2F8F83"
                            : "#0F2A24"
                      }
                      stroke="#E8F1EC"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.svgX + 12}
                      y={pt.svgY + 4}
                      fill={isSelected ? "#F2A65A" : "#E8F1EC"}
                      fontSize="12"
                      fontWeight="700"
                    >
                      {pt.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tombol Cepat Fokus Titik (Aksesibel Keyboard) */}
            <div className="mt-3 flex flex-wrap gap-2">
              {projectedPoints.map((pt) => {
                const isSelected = activeMapPoint?.code === pt.code;
                return (
                  <button
                    key={pt.code}
                    type="button"
                    onClick={() => setFocusedCode(pt.code)}
                    aria-pressed={isSelected}
                    className={cn(
                      "min-h-[44px] rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                      isSelected
                        ? "border-fajar bg-fajar text-hutan-950"
                        : "border-kabut/20 bg-hutan text-kabut hover:border-kabut/45"
                    )}
                  >
                    {pt.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kartu Detail Titik Pos yang Sedang Difokuskan */}
          {activeMapPoint ? (
            <div className="flex flex-col justify-between rounded-2xl border border-kabut/20 bg-obsidian p-5 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-hutan border border-telaga-700 px-3 py-1 text-xs font-bold text-fajar">
                    {activeMapPoint.code}
                  </span>
                  <span className="text-xs font-bold text-telaga-200">
                    {tHero("elevationUnit", { value: activeMapPoint.elevationM })}
                  </span>
                </div>

                <h3 className="mt-3 font-heading text-xl font-bold text-kabut">
                  {activeMapPoint.name}
                </h3>
                <p className="mt-2 text-sm text-kabut/85">{activeMapPoint.note}</p>

                <dl className="mt-5 space-y-2.5 border-t border-kabut/15 pt-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-kabut/75">{tTimeline("coordinatesLabel")}</dt>
                    <dd className="font-mono font-semibold text-kabut">
                      {activeMapPoint.lat.toFixed(6)}, {activeMapPoint.lng.toFixed(6)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-kabut/75">
                      {tTimeline("segmentFromPrevLabel")}
                    </dt>
                    <dd className="font-semibold text-kabut">
                      {activeMapPoint.distFromPrevM === 0
                        ? tHome("startPoint")
                        : tHome("distFromPrev", {
                            meters: activeMapPoint.distFromPrevM,
                            mins: activeMapPoint.minsFromPrev,
                          })}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-kabut/75">{tTimeline("corridorRuleLabel")}</dt>
                    <dd className="font-semibold text-fajar">
                      {tTimeline("corridorRuleValue", {
                        meters: offTrailThresholdM,
                      })}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 space-y-2.5">
                {activeMapPoint.isBatuLawang ? (
                  <button
                    type="button"
                    onClick={() => selectPackageAndJump("REGULER_BL")}
                    className="w-full btn-ui btn-fajar"
                  >
                    <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
                    <span>{tTimeline("bookForPointRegular")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectPackageAndJump("TIKET_PUTIH")}
                    className="w-full btn-ui btn-fajar"
                  >
                    <i className="bi bi-ticket-detailed-fill" aria-hidden="true" />
                    <span>{tTimeline("bookForPointWhite")}</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

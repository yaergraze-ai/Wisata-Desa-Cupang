"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useLocale } from "next-intl";

const INTRO_COOKIE_NAME = "wdc_intro_seen";

function markIntroSeenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${INTRO_COOKIE_NAME}=true; path=/; max-age=2592000; SameSite=Lax`;
}

function subscribeNoop() {
  return () => {};
}

function getClientIntroEligible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const seenSession = sessionStorage.getItem("wdc_intro_done") === "1";
    const seenCookie = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${INTRO_COOKIE_NAME}=true`));
    if (seenSession || seenCookie) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getServerIntroEligible(): boolean {
  return false;
}

export function CinematicIntro() {
  const locale = useLocale();
  const isEn = locale === "en";

  const isEligible = useSyncExternalStore(
    subscribeNoop,
    getClientIntroEligible,
    getServerIntroEligible
  );
  const [dismissed, setDismissed] = useState(false);
  const visible = isEligible && !dismissed;

  const [altitude, setAltitude] = useState(120);
  const [stageIndex, setStageIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const topGateRef = useRef<HTMLDivElement | null>(null);
  const bottomGateRef = useRef<HTMLDivElement | null>(null);
  const contentWrapRef = useRef<HTMLDivElement | null>(null);
  const outerRingRef = useRef<HTMLDivElement | null>(null);
  const innerRingRef = useRef<HTMLDivElement | null>(null);
  const emblemRef = useRef<HTMLDivElement | null>(null);
  const eyebrowRef = useRef<HTMLDivElement | null>(null);
  const titleLine1Ref = useRef<HTMLSpanElement | null>(null);
  const titleLine2Ref = useRef<HTMLSpanElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const telemetryRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const ridgeBackRef = useRef<SVGPathElement | null>(null);
  const ridgeMidRef = useRef<SVGPathElement | null>(null);
  const ridgeFrontRef = useRef<SVGPathElement | null>(null);
  const isClosingRef = useRef(false);

  const stages = isEn
    ? [
        "Batu Lawang Twin Cliff Gate • 360 masl",
        "Shaded Canopy Trail • Post 1–2",
        "Open Breeze Ridge • Post 3–4",
        "Gunung Bendera Summit • 520 masl",
      ]
    : [
        "Gerbang Tebing Batu Lawang • 360 mdpl",
        "Kanopi Hutan Desa Cupang • Pos 1–2",
        "Punggung Bukit Terbuka • Pos 3–4",
        "Puncak Gunung Bendera • 520 mdpl",
      ];

  const finishIntro = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    try {
      markIntroSeenCookie();
      sessionStorage.setItem("wdc_intro_done", "1");
    } catch {
      // Abaikan jika storage diblokir
    }

    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");

    void import("gsap")
      .then(({ gsap }) => {
        if (!rootRef.current) {
          setDismissed(true);
          return;
        }
        const tl = gsap.timeline({
          onComplete: () => {
            setDismissed(true);
          },
        });

        if (contentWrapRef.current) {
          tl.to(
            contentWrapRef.current,
            {
              opacity: 0,
              scale: 1.06,
              y: -16,
              duration: 0.42,
              ease: "power3.in",
            },
            0
          );
        }

        if (topGateRef.current && bottomGateRef.current) {
          tl.to(
            topGateRef.current,
            {
              yPercent: -102,
              duration: 0.68,
              ease: "power4.inOut",
            },
            0.12
          ).to(
            bottomGateRef.current,
            {
              yPercent: 102,
              duration: 0.68,
              ease: "power4.inOut",
            },
            0.12
          );
        } else {
          tl.to(
            rootRef.current,
            {
              opacity: 0,
              duration: 0.45,
              ease: "power2.out",
            },
            0.1
          );
        }
      })
      .catch(() => {
        setDismissed(true);
      });
  }, []);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        finishIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, finishIntro]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let cleanupTimeline: (() => void) | undefined;

    document.body.style.overflow = "hidden";

    void import("gsap").then(({ gsap }) => {
      if (cancelled || !rootRef.current) return;

      const altObj = { val: 120 };

      const ctx = gsap.context(() => {
        // Putaran cincin kompas berlapis
        if (outerRingRef.current) {
          gsap.to(outerRingRef.current, {
            rotation: 180,
            duration: 8,
            ease: "none",
            repeat: -1,
          });
        }
        if (innerRingRef.current) {
          gsap.to(innerRingRef.current, {
            rotation: -180,
            duration: 6,
            ease: "none",
            repeat: -1,
          });
        }

        const tl = gsap.timeline({
          onComplete: () => {
            if (!cancelled) finishIntro();
          },
        });

        // 1. Siluet Punggung Pegunungan Muncul Berlapis
        const ridges = [
          ridgeBackRef.current,
          ridgeMidRef.current,
          ridgeFrontRef.current,
        ].filter(Boolean);
        if (ridges.length > 0) {
          tl.fromTo(
            ridges,
            { opacity: 0, y: 36 },
            {
              opacity: 1,
              y: 0,
              duration: 0.75,
              stagger: 0.12,
              ease: "power3.out",
            },
            0
          );
        }

        // 2. Emblem Kompas & Eyebrow Lokasi
        if (emblemRef.current) {
          tl.fromTo(
            emblemRef.current,
            { opacity: 0, scale: 0.72, y: 16 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.65,
              ease: "back.out(1.6)",
            },
            0.08
          );
        }

        if (eyebrowRef.current) {
          tl.fromTo(
            eyebrowRef.current,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: "power3.out",
            },
            0.22
          );
        }

        // 3. Tipografi Utama Dua Baris
        const titleLines = [titleLine1Ref.current, titleLine2Ref.current].filter(
          Boolean
        );
        if (titleLines.length > 0) {
          tl.fromTo(
            titleLines,
            { opacity: 0, y: 28, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.68,
              stagger: 0.14,
              ease: "power4.out",
            },
            0.3
          );
        }

        // 4. Subjudul & Panel Telemetri Elevasi
        if (subtitleRef.current) {
          tl.fromTo(
            subtitleRef.current,
            { opacity: 0, y: 14 },
            {
              opacity: 1,
              y: 0,
              duration: 0.52,
              ease: "power2.out",
            },
            0.52
          );
        }

        if (telemetryRef.current) {
          tl.fromTo(
            telemetryRef.current,
            { opacity: 0, y: 16 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: "power3.out",
            },
            0.58
          );
        }

        // 5. Animasi Altimeter 120 -> 520 mdpl & Bar Progres Jalur
        tl.to(
          altObj,
          {
            val: 520,
            duration: 1.95,
            ease: "power2.inOut",
            onUpdate: () => {
              const current = Math.round(altObj.val);
              setAltitude(current);
              if (current < 370) setStageIndex(0);
              else if (current < 430) setStageIndex(1);
              else if (current < 495) setStageIndex(2);
              else setStageIndex(3);
            },
          },
          0.45
        );

        if (progressFillRef.current) {
          tl.fromTo(
            progressFillRef.current,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1.95,
              ease: "power2.inOut",
            },
            0.45
          );
        }

        // Tahan sejenak di puncak 520 mdpl sebelum tirai terbuka
        tl.to({}, { duration: 0.28 });
      }, rootRef);

      cleanupTimeline = () => ctx.revert();
    });

    return () => {
      cancelled = true;
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
      cleanupTimeline?.();
    };
  }, [visible, finishIntro]);

  if (!visible) return null;

  return (
    <div
      id="wdc-cinematic-intro"
      ref={rootRef}
      role="dialog"
      aria-label={
        isEn
          ? "Welcome to Batu Lawang and Gunung Bendera Cirebon"
          : "Selamat datang di Wisata Alam Batu Lawang dan Gunung Bendera Cirebon"
      }
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Panel Tirai Atas (Membuka ke Atas Saat Selesai) */}
      <div
        ref={topGateRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-obsidian border-b border-white/5 overflow-hidden"
      >
        <div className="absolute inset-0 bg-topo-contour opacity-25" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-[640px] rounded-full bg-[radial-gradient(circle,rgba(242,166,90,0.18)_0%,transparent_70%)] blur-2xl" />
      </div>

      {/* Panel Tirai Bawah dengan Siluet Pegunungan Berlapis (Membuka ke Bawah Saat Selesai) */}
      <div
        ref={bottomGateRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-obsidian overflow-hidden"
      >
        <div className="absolute inset-0 bg-topo-contour opacity-25" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[680px] rounded-full bg-[radial-gradient(circle,rgba(47,143,131,0.22)_0%,transparent_70%)] blur-2xl" />

        {/* Siluet SVG 3 Lapis Tebing Batu Lawang & Puncak Gunung Bendera */}
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-44 sm:h-56 w-full"
        >
          <path
            ref={ridgeBackRef}
            d="M0,320 L0,210 L180,150 L340,195 L540,95 L720,165 L920,78 L1140,155 L1310,115 L1440,170 L1440,320 Z"
            fill="rgba(15, 42, 36, 0.55)"
          />
          <path
            ref={ridgeMidRef}
            d="M0,320 L0,240 L210,185 L410,225 L620,135 L790,195 L990,128 L1210,190 L1440,150 L1440,320 Z"
            fill="rgba(47, 143, 131, 0.22)"
          />
          <path
            ref={ridgeFrontRef}
            d="M0,320 L0,268 L260,220 L480,255 L720,182 L960,242 L1190,205 L1440,245 L1440,320 Z"
            fill="rgba(8, 17, 14, 0.92)"
          />
        </svg>
      </div>

      {/* Tombol Lewati Intro (Teks Saja, Jelas & Responsif) */}
      <button
        type="button"
        onClick={finishIntro}
        className="absolute top-5 right-5 sm:top-7 sm:right-8 z-30 inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/20 bg-obsidian/80 px-4 py-2 text-xs font-bold tracking-wider text-kabut uppercase backdrop-blur-md transition-all hover:border-fajar hover:bg-fajar hover:text-obsidian shadow-lg cursor-pointer"
      >
        <span>{isEn ? "Skip Intro" : "Lewati Intro"}</span>
      </button>

      {/* Konten Utama Intro di Tengah */}
      <div
        ref={contentWrapRef}
        className="relative z-20 mx-auto flex max-w-2xl flex-col items-center px-6 text-center"
      >
        {/* Emblem Kompas & Cincin Kontur Berputar */}
        <div
          ref={emblemRef}
          className="relative mb-6 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center opacity-0"
        >
          <div
            ref={outerRingRef}
            className="absolute inset-0 rounded-full border border-dashed border-fajar/45 shadow-[0_0_40px_rgba(242,166,90,0.18)]"
          />
          <div
            ref={innerRingRef}
            className="absolute inset-2.5 rounded-full border border-telaga-400/40"
          />
          <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border border-fajar/50 bg-gradient-to-br from-hutan via-obsidian to-telaga-950 text-fajar shadow-[0_12px_32px_rgba(0,0,0,0.75)]">
            <i
              className="bi bi-compass-fill text-2xl sm:text-3xl drop-shadow-[0_0_12px_rgba(242,166,90,0.5)]"
              aria-hidden="true"
            />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_10px_#f2a65a]" />
          </div>
        </div>

        {/* Eyebrow Lokasi */}
        <div
          ref={eyebrowRef}
          className="inline-flex items-center gap-2 rounded-full border border-fajar/35 bg-hutan/80 px-4 py-1.5 text-[11px] sm:text-xs font-extrabold tracking-[0.22em] text-fajar uppercase shadow-md backdrop-blur-md opacity-0"
        >
          <i className="bi bi-geo-alt-fill text-xs" aria-hidden="true" />
          <span>
            {isEn
              ? "CUPANG VILLAGE • GEMPOL • CIREBON"
              : "DESA CUPANG • GEMPOL • CIREBON"}
          </span>
        </div>

        {/* Judul Display */}
        <h2 className="mt-4 font-heading text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-kabut leading-[1.08]">
          <span ref={titleLine1Ref} className="block opacity-0">
            Batu Lawang
          </span>
          <span
            ref={titleLine2Ref}
            className="mt-1 block text-fajar drop-shadow-[0_4px_24px_rgba(242,166,90,0.28)] opacity-0"
          >
            &amp; Gunung Bendera
          </span>
        </h2>

        <p
          ref={subtitleRef}
          className="mt-3 max-w-md text-xs sm:text-sm font-medium text-kabut/85 leading-relaxed opacity-0"
        >
          {isEn
            ? "Ancient andesite cliff gateway and 360-degree highland summit trail."
            : "Gerbang tebing batuan purba dan jalur pendakian puncak panorama 360 derajat."}
        </p>

        {/* Panel Telemetri Altimeter & Pos Jalur */}
        <div
          ref={telemetryRef}
          className="mt-7 w-full max-w-sm rounded-2xl border border-white/15 bg-obsidian/85 p-4 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.75)] opacity-0"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-left">
              <p className="text-[10px] font-bold tracking-widest text-telaga-300 uppercase">
                {isEn ? "TRAIL CHECKPOINT" : "POS KORIDOR JALUR"}
              </p>
              <p className="mt-0.5 text-xs font-bold text-kabut truncate">
                {stages[stageIndex]}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-fajar tabular-nums">
                {altitude}
              </span>
              <span className="ml-1 text-[11px] font-bold text-kabut/75">
                {isEn ? "masl" : "mdpl"}
              </span>
            </div>
          </div>

          {/* Bar Progres dengan Penanda 4 Pos */}
          <div className="mt-3 relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              ref={progressFillRef}
              className="h-full w-full origin-left scale-x-0 rounded-full bg-gradient-to-r from-telaga via-fajar to-amber-300"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono font-semibold text-kabut/65">
            <span>GATE 360m</span>
            <span>POS 1–2</span>
            <span>POS 3–4</span>
            <span className="text-fajar font-bold">SUMMIT 520m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

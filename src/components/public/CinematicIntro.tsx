"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";

const INTRO_COOKIE_NAME = "wdc_intro_seen";

function markIntroSeenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${INTRO_COOKIE_NAME}=true; path=/; max-age=2592000; SameSite=Lax`;
}

export function CinematicIntro() {
  const locale = useLocale();
  const isEn = locale === "en";

  const [isClosing, setIsClosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [altitude, setAltitude] = useState(120);
  const [progressPct, setProgressPct] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const isClosingRef = useRef(false);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setIsClosing(true);

    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");

    unmountTimerRef.current = setTimeout(() => {
      try {
        markIntroSeenCookie();
        sessionStorage.setItem("wdc_intro_done", "1");
        document.documentElement.classList.add("wdc-intro-dismissed");
      } catch {
        // Abaikan jika storage diblokir
      }
      setDismissed(true);
    }, 520);
  }, []);

  useEffect(() => {
    if (dismissed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        finishIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissed, finishIntro]);

  useEffect(() => {
    if (dismissed) return;

    // Jika sesi ini sudah pernah melihat intro, langsung tutup tanpa animasi ulang
    try {
      const seenSession = sessionStorage.getItem("wdc_intro_done") === "1";
      const seenCookie = document.cookie
        .split("; ")
        .some((c) => c.startsWith(`${INTRO_COOKIE_NAME}=true`));
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (seenSession || seenCookie || prefersReduced) {
        document.documentElement.classList.add("wdc-intro-dismissed");
        document.documentElement.style.removeProperty("overflow");
        document.body.style.removeProperty("overflow");
        const immediateTimer = setTimeout(() => {
          setDismissed(true);
        }, 0);
        return () => clearTimeout(immediateTimer);
      }
    } catch {
      // Lanjutkan animasi normal
    }

    document.body.style.overflow = "hidden";

    const startTime = performance.now();
    const durationMs = 1750;
    let rafId = 0;

    const tick = (now: number) => {
      if (isClosingRef.current) return;
      const elapsed = Math.max(0, now - startTime);
      const t = Math.min(1, elapsed / durationMs);
      const eased =
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const currentAlt = Math.round(120 + eased * 400);
      setAltitude(currentAlt);
      setProgressPct(Math.round(eased * 100));

      if (currentAlt < 370) setStageIndex(0);
      else if (currentAlt < 430) setStageIndex(1);
      else if (currentAlt < 495) setStageIndex(2);
      else setStageIndex(3);

      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          finishIntro();
        }, 220);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    // Hard safety timeout agar intro tidak pernah macet di jaringan/perangkat apa pun
    const safetyTimer = setTimeout(() => {
      finishIntro();
    }, 2600);

    return () => {
      window.cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    };
  }, [dismissed, finishIntro]);

  if (dismissed) return null;

  return (
    <div
      id="wdc-cinematic-intro"
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
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-obsidian border-b border-white/5 overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]",
          isClosing ? "-translate-y-full" : "translate-y-0"
        )}
      >
        <div className="absolute inset-0 bg-topo-contour opacity-25" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-[640px] rounded-full bg-[radial-gradient(circle,rgba(242,166,90,0.18)_0%,transparent_70%)] blur-2xl" />
      </div>

      {/* Panel Tirai Bawah dengan Siluet Pegunungan Berlapis (Membuka ke Bawah Saat Selesai) */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-obsidian overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]",
          isClosing ? "translate-y-full" : "translate-y-0"
        )}
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
            d="M0,320 L0,210 L180,150 L340,195 L540,95 L720,165 L920,78 L1140,155 L1310,115 L1440,170 L1440,320 Z"
            fill="rgba(15, 42, 36, 0.55)"
          />
          <path
            d="M0,320 L0,240 L210,185 L410,225 L620,135 L790,195 L990,128 L1210,190 L1440,150 L1440,320 Z"
            fill="rgba(47, 143, 131, 0.22)"
          />
          <path
            d="M0,320 L0,268 L260,220 L480,255 L720,182 L960,242 L1190,205 L1440,245 L1440,320 Z"
            fill="rgba(8, 17, 14, 0.92)"
          />
        </svg>
      </div>

      {/* Tombol Lewati Intro (Teks Saja, Jelas & Responsif) */}
      <button
        type="button"
        onClick={finishIntro}
        className={cn(
          "absolute top-5 right-5 sm:top-7 sm:right-8 z-30 inline-flex min-h-[42px] items-center justify-center rounded-full border border-white/20 bg-obsidian/85 px-4 py-2 text-xs font-bold tracking-wider text-kabut uppercase backdrop-blur-md transition-all hover:border-fajar hover:bg-fajar hover:text-obsidian shadow-lg cursor-pointer",
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        <span>{isEn ? "Skip Intro" : "Lewati Intro"}</span>
      </button>

      {/* Konten Utama Intro di Tengah — SSR-Safe & Langsung Tampil Tanpa Menunggu Chunk Eksternal */}
      <div
        className={cn(
          "relative z-20 mx-auto flex max-w-2xl flex-col items-center px-6 text-center transition-all duration-400 ease-out",
          isClosing
            ? "opacity-0 scale-105 -translate-y-3"
            : "opacity-100 scale-100 translate-y-0 animate-page-smooth-in"
        )}
      >
        {/* Emblem Kompas & Cincin Kontur Berputar */}
        <div className="relative mb-6 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-fajar/45 shadow-[0_0_40px_rgba(242,166,90,0.18)] animate-[spin_12s_linear_infinite]" />
          <div className="absolute inset-2.5 rounded-full border border-telaga-400/40 animate-[spin_9s_linear_infinite_reverse]" />
          <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border border-fajar/50 bg-gradient-to-br from-hutan via-obsidian to-telaga-950 text-fajar shadow-[0_12px_32px_rgba(0,0,0,0.75)]">
            <i
              className="bi bi-compass-fill text-2xl sm:text-3xl drop-shadow-[0_0_12px_rgba(242,166,90,0.5)]"
              aria-hidden="true"
            />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_10px_#f2a65a]" />
          </div>
        </div>

        {/* Eyebrow Lokasi */}
        <div className="inline-flex items-center gap-2 rounded-full border border-fajar/35 bg-hutan/80 px-4 py-1.5 text-[11px] sm:text-xs font-extrabold tracking-[0.22em] text-fajar uppercase shadow-md backdrop-blur-md">
          <i className="bi bi-geo-alt-fill text-xs" aria-hidden="true" />
          <span>
            {isEn
              ? "CUPANG VILLAGE • GEMPOL • CIREBON"
              : "DESA CUPANG • GEMPOL • CIREBON"}
          </span>
        </div>

        {/* Judul Display */}
        <h2 className="mt-4 font-heading text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-kabut leading-[1.08]">
          <span className="block">Batu Lawang</span>
          <span className="mt-1 block text-fajar drop-shadow-[0_4px_24px_rgba(242,166,90,0.28)]">
            &amp; Gunung Bendera
          </span>
        </h2>

        <p className="mt-3 max-w-md text-xs sm:text-sm font-medium text-kabut/85 leading-relaxed">
          {isEn
            ? "Ancient andesite cliff gateway and 360-degree highland summit trail."
            : "Gerbang tebing batuan purba dan jalur pendakian puncak panorama 360 derajat."}
        </p>

        {/* Panel Telemetri Altimeter & Pos Jalur */}
        <div className="mt-7 w-full max-w-sm rounded-2xl border border-white/15 bg-obsidian/85 p-4 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.75)]">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-left min-w-0">
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
              style={{ transform: `scaleX(${progressPct / 100})` }}
              className="h-full w-full origin-left rounded-full bg-gradient-to-r from-telaga via-fajar to-amber-300 transition-transform duration-75 ease-out"
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

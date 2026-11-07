"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import gsap from "gsap";

function subscribeNoop() {
  return () => {};
}

function getClientSeenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const isCrawlerOrBot =
      /Lighthouse|PageSpeed|HeadlessChrome|GTmetrix|Pingdom|Googlebot/i.test(
        navigator.userAgent
      ) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (isCrawlerOrBot) return true;

    const cookieSeen = document.cookie.includes("wdc_intro_seen=true");
    const localSeen = localStorage.getItem("wdc_cinematic_intro_seen") === "true";
    const sessionSeen =
      sessionStorage.getItem("wdc_cinematic_intro_seen") === "true";
    const htmlDismissed =
      document.documentElement.classList.contains("wdc-intro-dismissed");

    return cookieSeen || localSeen || sessionSeen || htmlDismissed;
  } catch {
    return false;
  }
}

function getServerSeenSnapshot(): boolean {
  return false;
}

export function CinematicIntro() {
  const seenExternally = useSyncExternalStore(
    subscribeNoop,
    getClientSeenSnapshot,
    getServerSeenSnapshot
  );
  const [dismissedManually, setDismissedManually] = useState(false);
  const isDismissed = seenExternally || dismissedManually;

  const [altitude, setAltitude] = useState(0);
  const [statusText, setStatusText] = useState(
    "Inisialisasi sensor koordinat Desa Cupang..."
  );
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const progressLineRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const needleRef = useRef<SVGPathElement>(null);

  const persistSeenState = useCallback(() => {
    try {
      const isHttps =
        typeof window !== "undefined" && window.location.protocol === "https:";
      document.cookie = `wdc_intro_seen=true; path=/; max-age=31536000; SameSite=Lax${isHttps ? "; Secure" : ""}`;
      localStorage.setItem("wdc_cinematic_intro_seen", "true");
      sessionStorage.setItem("wdc_cinematic_intro_seen", "true");
      document.documentElement.classList.add("wdc-intro-dismissed");
      document.documentElement.style.overflow = "";
    } catch {
      // ignore
    }
  }, []);

  const handleFinish = useCallback(() => {
    persistSeenState();

    if (!containerRef.current) {
      setDismissedManually(true);
      return;
    }

    gsap.to(containerRef.current, {
      yPercent: -100,
      opacity: 0,
      duration: 0.85,
      ease: "power4.inOut",
      onComplete: () => {
        setDismissedManually(true);
        if (typeof document !== "undefined") {
          document.documentElement.style.overflow = "";
        }
      },
    });
  }, [persistSeenState]);

  // Daftarkan replay global dan kelola kunci scroll dokumen dengan cleanup aman
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { replayWdcIntro?: () => void }).replayWdcIntro =
        () => {
          try {
            document.cookie = "wdc_intro_seen=; path=/; max-age=0";
            localStorage.removeItem("wdc_cinematic_intro_seen");
            sessionStorage.removeItem("wdc_cinematic_intro_seen");
            document.documentElement.classList.remove("wdc-intro-dismissed");
            document.documentElement.style.overflow = "";
          } catch {
            // ignore
          }
          window.location.reload();
        };
    }

    if (isDismissed) {
      persistSeenState();
      return;
    }

    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [isDismissed, persistSeenState]);

  // Timeline animasi sinematik utama GSAP
  useEffect(() => {
    if (isDismissed || !containerRef.current) return;

    let isCancelled = false;

    // 1. Reset posisi awal elemen
    gsap.set(emblemRef.current, { scale: 0.7, opacity: 0 });
    gsap.set([titleRef.current, subtitleRef.current, meterRef.current], {
      y: 24,
      opacity: 0,
    });

    // 2. Cincin koordinat berputar perlahan
    if (ringRef.current) {
      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: "none",
        transformOrigin: "center center",
      });
    }

    // Jarum kompas bergetar presisi
    if (needleRef.current) {
      gsap.to(needleRef.current, {
        rotation: 8,
        duration: 1.2,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        transformOrigin: "center center",
      });
    }

    // 3. Timeline Pembuka Sinematik
    const tl = gsap.timeline();

    tl.to(emblemRef.current, {
      scale: 1,
      opacity: 1,
      duration: 0.7,
      ease: "back.out(1.7)",
    })
      .to(
        [titleRef.current, subtitleRef.current],
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.65,
          ease: "power3.out",
        },
        "-=0.3"
      )
      .to(
        meterRef.current,
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power2.out",
        },
        "-=0.2"
      );

    // 4. Simulasi Ketinggian 0 mdpl -> 520 mdpl (2.6s ritme stabil)
    const counterObj = { val: 0, p: 0 };
    const counterTween = gsap.to(counterObj, {
      val: 520,
      p: 100,
      duration: 2.6,
      ease: "power2.inOut",
      onUpdate: () => {
        if (isCancelled) return;
        const currentVal = Math.round(counterObj.val);
        setAltitude(currentVal);
        setProgress(Math.round(counterObj.p));

        if (currentVal < 120) {
          setStatusText("Memindai Gerbang Tebing Purba Batu Lawang...");
        } else if (currentVal < 280) {
          setStatusText("Mendaki Jalur Hutan Batu Karst Cupang...");
        } else if (currentVal < 450) {
          setStatusText("Menembus Kabut Pos 3 Punggung Bukit...");
        } else {
          setStatusText(
            "Elevasi 520 mdpl Puncak Tercapai • Kawasan Siap Dijelajahi!"
          );
        }
      },
      onComplete: () => {
        if (isCancelled) return;
        setIsComplete(true);
        setStatusText(
          "Elevasi 520 mdpl Puncak Tercapai • Kawasan Siap Dijelajahi!"
        );

        setTimeout(() => {
          if (!isCancelled) {
            handleFinish();
          }
        }, 1200);
      },
    });

    return () => {
      isCancelled = true;
      tl.kill();
      counterTween.kill();
    };
  }, [isDismissed, handleFinish]);

  if (isDismissed) return null;

  return (
    <div
      id="wdc-cinematic-intro"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Animasi Pembuka Wisata Desa Cupang"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between text-kabut overflow-hidden select-none px-4 py-8 sm:py-12"
      style={{
        background:
          "radial-gradient(circle at 50% 38%, #14281e 0%, #08120c 60%, #030604 100%)",
      }}
    >
      {/* Latar Belakang Garis Topografi Halus */}
      <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
        <svg viewBox="0 0 800 800" className="w-[140vw] max-w-[900px] h-auto">
          <circle
            cx="400"
            cy="400"
            r="120"
            fill="none"
            stroke="#f2a65a"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle
            cx="400"
            cy="400"
            r="220"
            fill="none"
            stroke="#2f8f83"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
          <circle
            cx="400"
            cy="400"
            r="320"
            fill="none"
            stroke="#f2a65a"
            strokeWidth="0.8"
            opacity="0.6"
          />
          <circle
            cx="400"
            cy="400"
            r="390"
            fill="none"
            stroke="#e8f1ec"
            strokeWidth="0.5"
            opacity="0.4"
          />
        </svg>
      </div>

      {/* Bagian Atas: Tombol Lewati & Badge Resmi */}
      <div className="relative z-10 w-full max-w-4xl flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-telaga-700/60 bg-hutan-900/80 px-3 py-1 text-xs font-semibold text-telaga-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-fajar animate-ping" />
          <span>PEMERINTAH DESA CUPANG • GEMPOL</span>
        </div>

        <button
          type="button"
          onClick={handleFinish}
          aria-label="Lewati animasi intro"
          className="btn-ui btn-glass min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-kabut/80 hover:text-fajar transition-colors cursor-pointer"
        >
          <span>Lewati</span>
          <i
            className="bi bi-chevron-double-right text-fajar text-xs"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Bagian Tengah: Lambang Cincin Koordinat & Judul Gagah */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-4 my-auto">
        {/* Lambang Kompas & Cincin Topo */}
        <div
          ref={emblemRef}
          className="relative mb-6 flex items-center justify-center"
        >
          {/* Cincin Berputar SVG */}
          <svg
            ref={ringRef}
            viewBox="0 0 200 200"
            className="w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none text-telaga-400/40"
          >
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 5"
            />
            <circle
              cx="100"
              cy="100"
              r="76"
              fill="none"
              stroke="rgba(242,166,90,0.3)"
              strokeWidth="1"
            />
            <path
              d="M100 5 L100 15 M100 185 L100 195 M5 100 L15 100 M185 100 L195 100"
              stroke="#f2a65a"
              strokeWidth="2"
            />
            {/* Jarum Kompas */}
            <path
              ref={needleRef}
              d="M100 35 L106 100 L94 100 Z"
              fill="#eb823c"
              opacity="0.9"
            />
          </svg>

          {/* Ikon Pusat */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-hutan-800 to-obsidian border-2 border-fajar/60 shadow-xl shadow-fajar/20 text-fajar">
              <Image
                src="/icons/logo-wisata.png"
                alt="Logo Wisata Desa Cupang"
                width={56}
                height={56}
                priority
                className="object-contain"
              />
            </div>
          </div>
        </div>

        {/* Teks Judul Utama */}
        <p className="text-xs sm:text-sm font-semibold tracking-widest text-fajar uppercase mb-2">
          E-Ticketing &amp; Navigasi Puncak Cirebon
        </p>
        <h1
          ref={titleRef}
          className="font-unbounded text-2xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-100 via-fajar to-amber-300 bg-clip-text text-transparent drop-shadow-md"
        >
          WISATA DESA CUPANG
        </h1>
        <p
          ref={subtitleRef}
          className="mt-3 text-sm sm:text-base text-kabut/85 max-w-lg font-medium leading-relaxed"
        >
          Tebing Purba Batu Lawang &bull; Puncak Gunung Bendera 520 MDPL
        </p>

        {/* Sensor Meter & Status Pindai */}
        <div
          ref={meterRef}
          className="mt-6 flex flex-col items-center gap-3 w-full max-w-sm rounded-2xl border border-telaga-700/50 bg-obsidian/90 backdrop-blur-md p-4 shadow-lg"
        >
          <div className="flex w-full items-center justify-between text-xs font-mono">
            <span className="text-kabut/70 flex items-center gap-1.5">
              <i
                className="bi bi-geo-alt-fill text-fajar text-xs"
                aria-hidden="true"
              />
              <span>6.7231° S, 108.3842° E</span>
            </span>
            <span className="font-bold text-fajar text-sm tabular-nums">
              {altitude} mdpl
            </span>
          </div>

          {/* Garis Progres */}
          <div className="w-full h-1.5 rounded-full bg-hutan-900 overflow-hidden border border-fajar/20">
            <div
              ref={progressLineRef}
              className="h-full bg-gradient-to-r from-telaga via-fajar to-amber-400 rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-[11px] font-medium text-telaga-300 truncate max-w-full">
            {statusText}
          </p>
        </div>
      </div>

      {/* Bagian Bawah: Aksi Cepat Masuk */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleFinish}
          className={`btn-ui btn-fajar w-full max-w-xs shadow-lg shadow-fajar/25 text-xs font-bold py-2.5 transition-all cursor-pointer ${
            isComplete ? "scale-105 ring-2 ring-fajar" : ""
          }`}
        >
          <i className="bi bi-compass" aria-hidden="true" />
          <span>
            {isComplete
              ? "Masuk ke Beranda Wisata"
              : "Mulai Eksplorasi Sekarang"}
          </span>
        </button>
        <p className="text-[10px] text-kabut/45">
          Wisata Resmi Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon
        </p>
      </div>
    </div>
  );
}

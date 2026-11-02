"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";

export function CinematicIntro() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [altitude, setAltitude] = useState(0);
  const [statusText, setStatusText] = useState("Menghubungkan sensor koordinat...");
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const progressLineRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);

  const handleFinish = useCallback(() => {
    try {
      document.cookie = "wdc_intro_seen=true; path=/; max-age=31536000; SameSite=Lax";
      localStorage.setItem("wdc_cinematic_intro_seen", "true");
      sessionStorage.setItem("wdc_cinematic_intro_seen", "true");
    } catch {
      // ignore
    }

    if (!containerRef.current) {
      setIsDismissed(true);
      return;
    }

    // Animasi curtain exit halus ke atas dengan GSAP
    gsap.to(containerRef.current, {
      yPercent: -100,
      opacity: 0,
      duration: 0.9,
      ease: "power4.inOut",
      onComplete: () => {
        setIsDismissed(true);
      },
    });
  }, []);

  // Periksa status seen dan daftarkan replay global
  useEffect(() => {
    try {
      const cookieSeen =
        typeof document !== "undefined" &&
        document.cookie.includes("wdc_intro_seen=true");
      const localSeen =
        localStorage.getItem("wdc_cinematic_intro_seen") === "true";
      const sessionSeen =
        sessionStorage.getItem("wdc_cinematic_intro_seen") === "true";

      if (cookieSeen || localSeen || sessionSeen) {
        setIsDismissed(true);
        return;
      }

      // Segera kunci status seen agar saat refresh atau navigasi ulang, intro tidak akan pernah muncul lagi
      document.cookie = "wdc_intro_seen=true; path=/; max-age=31536000; SameSite=Lax";
      localStorage.setItem("wdc_cinematic_intro_seen", "true");
      sessionStorage.setItem("wdc_cinematic_intro_seen", "true");
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      (window as unknown as { replayWdcIntro?: () => void }).replayWdcIntro = () => {
        try {
          document.cookie = "wdc_intro_seen=; path=/; max-age=0";
          localStorage.removeItem("wdc_cinematic_intro_seen");
          sessionStorage.removeItem("wdc_cinematic_intro_seen");
        } catch {
          // ignore
        }
        window.location.reload();
      };
    }
  }, []);

  // Jalankan animasi sinematik lengkap sampai tuntas
  useEffect(() => {
    if (isDismissed) return;

    let isCancelled = false;

    // 1. Reset posisi elemen
    gsap.set(emblemRef.current, { scale: 0.8, opacity: 0 });
    gsap.set([titleRef.current, subtitleRef.current, meterRef.current], {
      y: 20,
      opacity: 0,
    });

    // 2. Timeline Pembuka Sinematik
    const tl = gsap.timeline();

    tl.to(emblemRef.current, {
      scale: 1,
      opacity: 1,
      duration: 0.7,
      ease: "back.out(1.6)",
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

    // Cincin koordinat berputar perlahan
    if (ringRef.current) {
      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 25,
        repeat: -1,
        ease: "none",
      });
    }

    // Animasi Ketinggian 0 mdpl -> 520 mdpl (2.6s ritme stabil & megah)
    const counterObj = { val: 0, p: 0 };
    gsap.to(counterObj, {
      val: 520,
      p: 100,
      duration: 2.6,
      ease: "power2.inOut",
      onUpdate: () => {
        if (isCancelled) return;
        const currentVal = Math.round(counterObj.val);
        setAltitude(currentVal);
        setProgress(Math.round(counterObj.p));

        if (currentVal < 180) {
          setStatusText("Memindai Tebing Purba Batu Lawang...");
        } else if (currentVal < 420) {
          setStatusText("Mengkalibrasi Pos Pendakian Gunung Bendera...");
        } else {
          setStatusText("Elevasi 520 mdpl Tercapai • Selamat Datang di Desa Cupang!");
        }
      },
      onComplete: () => {
        if (isCancelled) return;
        setIsComplete(true);
        setStatusText("Elevasi 520 mdpl Selesai • Kawasan Siap Dijelajahi");

        // Jeda 1.8 detik saat selesai agar pengunjung dapat menyerap seluruh intro, lalu transisi halus
        setTimeout(() => {
          if (!isCancelled) {
            handleFinish();
          }
        }, 1800);
      },
    });

    return () => {
      isCancelled = true;
    };
  }, [isDismissed, handleFinish]);

  if (isDismissed) return null;

  return (
    <>
      <div
        id="wdc-cinematic-intro"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Animasi Pembuka Wisata Desa Cupang"
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-obsidian text-kabut overflow-hidden select-none px-4 py-8 sm:py-12"
        style={{
          background: "radial-gradient(circle at 50% 40%, #15241c 0%, #0a110d 65%, #050806 100%)",
        }}
      >
        {/* Latar Belakang Garis Topografi Halus */}
        <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
          <svg
            viewBox="0 0 800 800"
            className="w-[140vw] max-w-[900px] h-auto"
          >
            <circle cx="400" cy="400" r="120" fill="none" stroke="#f2a65a" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="400" cy="400" r="220" fill="none" stroke="#2f8f83" strokeWidth="1" strokeDasharray="6 6" />
            <circle cx="400" cy="400" r="320" fill="none" stroke="#f2a65a" strokeWidth="0.8" opacity="0.6" />
            <circle cx="400" cy="400" r="390" fill="none" stroke="#e8f1ec" strokeWidth="0.5" opacity="0.4" />
          </svg>
        </div>

        {/* Bagian Atas: Tombol Lewati & Badge Resmi */}
        <div className="relative z-10 w-full max-w-4xl flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-telaga-700/60 bg-hutan-900/80 px-3 py-1 text-xs font-semibold text-telaga-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-fajar" />
            <span>PEMERINTAH DESA CUPANG • GEMPOL</span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            aria-label="Lewati animasi intro"
            className="btn-ui btn-glass min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-kabut/80 hover:text-fajar transition-colors"
          >
            <span>Lewati</span>
            <i className="bi bi-chevron-double-right text-fajar text-xs" aria-hidden="true" />
          </button>
        </div>

        {/* Bagian Tengah: Lambang Cincin Koordinat & Judul Gagah */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-4 my-auto">
          {/* Lambang Kompas & Cincin Topo */}
          <div ref={emblemRef} className="relative mb-6 flex items-center justify-center">
            {/* Cincin Berputar SVG */}
            <svg
              ref={ringRef}
              viewBox="0 0 200 200"
              className="w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none text-telaga-400/40"
            >
              <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" />
              <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(242,166,90,0.3)" strokeWidth="1" />
              <path d="M100 5 L100 15 M100 185 L100 195 M5 100 L15 100 M185 100 L195 100" stroke="#f2a65a" strokeWidth="2" />
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
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <i className="bi bi-compass text-3xl sm:text-4xl text-fajar" aria-hidden="true" />
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
                <i className="bi bi-geo-alt-fill text-fajar text-xs" aria-hidden="true" />
                <span>6.7231° S, 108.3842° E</span>
              </span>
              <span className="font-bold text-fajar text-sm tabular-nums">{altitude} mdpl</span>
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
            className={`btn-ui btn-fajar w-full max-w-xs shadow-lg shadow-fajar/25 text-xs font-bold py-2.5 transition-all ${
              isComplete ? "scale-105 ring-2 ring-fajar" : ""
            }`}
          >
            <i className="bi bi-compass" aria-hidden="true" />
            <span>{isComplete ? "Masuk ke Beranda Wisata" : "Mulai Eksplorasi Sekarang"}</span>
          </button>
          <p className="text-[10px] text-kabut/45">
            Wisata Resmi Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon
          </p>
        </div>
      </div>

      {/* Script sinkron pasca-elemen: Menyembunyikan intro seketika sebelum frame pertama jika sudah pernah dilihat */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            try {
              var cookieSeen = document.cookie.indexOf("wdc_intro_seen=true") !== -1;
              var localSeen = localStorage.getItem("wdc_cinematic_intro_seen") === "true";
              var sessionSeen = sessionStorage.getItem("wdc_cinematic_intro_seen") === "true";
              if (cookieSeen || localSeen || sessionSeen) {
                var el = document.getElementById("wdc-cinematic-intro");
                if (el) el.style.display = "none";
              }
            } catch(e) {}
          `,
        }}
      />
    </>
  );
}

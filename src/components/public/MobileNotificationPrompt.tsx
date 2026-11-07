"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type NotificationState = "default" | "granted" | "denied" | "unsupported";

function subscribeNoop() {
  return () => {};
}

function getClientNotificationPermission(): NotificationState {
  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission as NotificationState;
  }
  return "unsupported";
}

function getServerNotificationPermission(): NotificationState {
  return "unsupported";
}

export function MobileNotificationPrompt() {
  const browserPermission = useSyncExternalStore(
    subscribeNoop,
    getClientNotificationPermission,
    getServerNotificationPermission
  );
  const [manualPermission, setManualPermission] =
    useState<NotificationState | null>(null);
  const permission = manualPermission ?? browserPermission;
  const [isOpen, setIsOpen] = useState(false);
  const [showAutoBanner, setShowAutoBanner] = useState(false);
  const [testSentFeedback, setTestSentFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    // Tampilkan banner tawaran otomatis jika izin belum pernah ditolak/diterima
    try {
      const dismissed = sessionStorage.getItem("wdc_notif_banner_dismissed");
      if (Notification.permission === "default" && dismissed !== "true") {
        const timer = setTimeout(() => {
          setShowAutoBanner(true);
        }, 4000); // Muncul ramah setelah 4 detik
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const sendNotification = async (title: string, body: string, url: string = "/") => {
    // 1. Getar ponsel jika perangkat mendukung
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([180, 80, 180]);
      } catch {
        // ignore
      }
    }

    // 2. Kirim notifikasi melalui Service Worker (Paling stabil di HP Android/iOS)
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url },
            tag: "wdc-push-" + Date.now(),
          } as NotificationOptions & { vibrate?: number[] });
          return true;
        }
      } catch (err) {
        console.warn("SW showNotification gagal, fallback ke window.Notification:", err);
      }
    }

    // 3. Fallback browser window Notification API
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
        });
        return true;
      } catch (err) {
        console.warn("window.Notification gagal:", err);
      }
    }

    return false;
  };

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Browser perangkat Anda belum mendukung Web Notification API.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setManualPermission(result as NotificationState);
      setShowAutoBanner(false);

      if (result === "granted") {
        // Kirim notifikasi sambutan pertama ke HP
        await sendNotification(
          "🏔️ Wisata Desa Cupang, Cirebon",
          "Notifikasi ponsel aktif! Anda akan menerima update kuota harian & peringatan cuaca pendakian langsung di HP.",
          "/#kalkulator-tiket"
        );
        setTestSentFeedback("Notifikasi aktif! Cek bilah status HP Anda.");
        setTimeout(() => setTestSentFeedback(null), 4000);
      } else if (result === "denied") {
        setTestSentFeedback("Izin notifikasi ditolak di browser Anda.");
        setTimeout(() => setTestSentFeedback(null), 4000);
      }
    } catch (err) {
      console.error("Gagal meminta izin notifikasi:", err);
    }
  };

  const handleDismissBanner = () => {
    setShowAutoBanner(false);
    try {
      sessionStorage.setItem("wdc_notif_banner_dismissed", "true");
    } catch {
      // ignore
    }
  };

  const triggerCustomTest = async (type: "quota" | "weather" | "schedule") => {
    if (permission !== "granted") {
      await handleRequestPermission();
      return;
    }

    if (type === "quota") {
      await sendNotification(
        "🎫 Peringatan Kuota Tiket Wisata",
        "Sisa Tiket Putih Gunung Bendera hari ini tersisa 18 kursi! Amankan e-ticket Anda sekarang.",
        "/#kalkulator-tiket"
      );
      setTestSentFeedback("Notifikasi kuota terkirim ke HP!");
    } else if (type === "weather") {
      await sendNotification(
        "🌦️ Laporan Cuaca Puncak 520 mdpl",
        "Kondisi Puncak Gunung Bendera cerah berawan, angin 12 km/jam. Sangat ideal untuk pendakian sore ini.",
        "/#peta-jalur"
      );
      setTestSentFeedback("Peringatan cuaca terkirim ke HP!");
    } else if (type === "schedule") {
      await sendNotification(
        "🎒 Pengingat Jadwal Pendakian",
        "Gerbang pemeriksaan Pos 1 Batu Lawang buka pukul 05:30 WIB. Siapkan QR code tiket Anda.",
        "/jalur"
      );
      setTestSentFeedback("Pengingat jadwal terkirim ke HP!");
    }

    setTimeout(() => setTestSentFeedback(null), 3500);
  };

  if (permission === "unsupported") return null;

  return (
    <>
      {/* 1. Banner Otomatis Ramah di Bawah (Hanya jika belum pernah diminta) */}
      {showAutoBanner && permission === "default" && (
        <div
          role="status"
          className="fixed bottom-16 inset-x-3 z-40 mx-auto max-w-md rounded-2xl border border-fajar/40 bg-obsidian/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 sm:bottom-6 sm:right-6 sm:left-auto"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fajar/20 border border-fajar/40 text-fajar text-lg">
              <i className="bi bi-bell-fill animate-bounce" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-sm font-bold text-kabut">
                Aktifkan Notifikasi di HP
              </p>
              <p className="mt-1 text-xs text-kabut/80 leading-relaxed">
                Dapatkan info sisa kuota tiket harian dan peringatan cuaca pendakian langsung di layar ponsel Anda.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="btn-ui btn-fajar min-h-[38px] px-3.5 text-xs font-bold"
                >
                  <i className="bi bi-bell-fill" aria-hidden="true" />
                  <span>Aktifkan Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissBanner}
                  className="btn-ui btn-glass min-h-[38px] px-3 text-xs text-kabut/70 hover:text-kabut"
                >
                  <span>Nanti</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Tombol Melayang Lonceng Notifikasi (Akses Kapan Saja) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pusat Notifikasi Ponsel"
        aria-expanded={isOpen}
        className="fixed bottom-16 right-3 z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-telaga-700 bg-obsidian/90 text-fajar shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
      >
        <i className="bi bi-bell-fill text-lg" aria-hidden="true" />
        {permission === "granted" ? (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-telaga-500 ring-2 ring-obsidian">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        ) : (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-fajar ring-2 ring-obsidian">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          </span>
        )}
      </button>

      {/* 3. Panel Modal / Bottom Sheet Pengaturan Notifikasi */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notif-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-obsidian/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-telaga-700/60 bg-obsidian p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-kabut/15 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hutan border border-telaga-700 text-fajar">
                  <i className="bi bi-phone-vibrate text-xl" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="notif-modal-title" className="font-heading text-base sm:text-lg font-bold text-kabut">
                    Notifikasi Ponsel Langsung
                  </h3>
                  <p className="text-xs text-kabut/75">
                    Wisata Desa Cupang, Gempol, Cirebon
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-ui btn-glass min-h-[40px] px-2.5 text-kabut hover:text-fajar"
                aria-label="Tutup panel notifikasi"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {/* Status Izin & Feedback */}
            {testSentFeedback && (
              <div className="rounded-xl border border-telaga-500/50 bg-telaga-950/70 p-3 text-xs font-semibold text-telaga-200 flex items-center gap-2">
                <i className="bi bi-check-circle-fill text-telaga-400 text-sm" aria-hidden="true" />
                <span>{testSentFeedback}</span>
              </div>
            )}

            {permission === "granted" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-telaga-600/40 bg-hutan/40 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-telaga-300 uppercase tracking-wide">
                      Status Notifikasi HP
                    </p>
                    <p className="text-sm font-bold text-kabut mt-0.5">
                      ✅ Terhubung &amp; Aktif
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-telaga-900/80 border border-telaga-500/50 px-3 py-1 text-xs font-semibold text-telaga-200">
                    <span className="h-2 w-2 rounded-full bg-telaga-400" />
                    <span>Siaga</span>
                  </span>
                </div>

                <p className="text-xs text-kabut/80 leading-relaxed">
                  Ponsel Anda akan menerima pemberitahuan otomatis saat kuota tiket harian dibuka atau jika ada peringatan cuaca di jalur pendakian.
                </p>

                {/* Tombol-tombol Uji Coba Cepat ke HP */}
                <div className="space-y-2 border-t border-kabut/15 pt-4">
                  <p className="text-xs font-bold text-fajar uppercase tracking-wider">
                    Uji Coba Notifikasi di HP Anda:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => triggerCustomTest("quota")}
                      className="btn-ui btn-glass text-left p-2.5 text-xs flex flex-col items-start gap-1 min-h-[48px]"
                    >
                      <span className="font-bold text-fajar flex items-center gap-1">
                        <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
                        <span>Kuota Tiket</span>
                      </span>
                      <span className="text-[11px] text-kabut/70">Tes sisa tiket</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerCustomTest("weather")}
                      className="btn-ui btn-glass text-left p-2.5 text-xs flex flex-col items-start gap-1 min-h-[48px]"
                    >
                      <span className="font-bold text-telaga-300 flex items-center gap-1">
                        <i className="bi bi-cloud-sun-fill" aria-hidden="true" />
                        <span>Cuaca Puncak</span>
                      </span>
                      <span className="text-[11px] text-kabut/70">Tes cuaca 520m</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerCustomTest("schedule")}
                      className="btn-ui btn-glass text-left p-2.5 text-xs flex flex-col items-start gap-1 min-h-[48px]"
                    >
                      <span className="font-bold text-amber-300 flex items-center gap-1">
                        <i className="bi bi-clock-history" aria-hidden="true" />
                        <span>Jadwal Jalur</span>
                      </span>
                      <span className="text-[11px] text-kabut/70">Tes pengingat</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : permission === "denied" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4">
                  <p className="text-xs font-bold text-red-300 uppercase">
                    Izin Notifikasi Diblokir
                  </p>
                  <p className="mt-1 text-xs text-red-200/90 leading-relaxed">
                    Browser Anda saat ini memblokir notifikasi untuk situs ini. Untuk mengaktifkannya:
                  </p>
                  <ol className="mt-2 list-decimal list-inside text-xs text-red-100/80 space-y-1">
                    <li>Ketuk ikon gembok / setelan di bilah alamat browser HP Anda.</li>
                    <li>Pilih <strong>Izin Situs</strong> atau <strong>Notifikasi</strong>.</li>
                    <li>Ubah menjadi <strong>Izinkan</strong>, lalu muat ulang halaman.</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-kabut/85 leading-relaxed">
                  Aktifkan notifikasi untuk mendapatkan update kuota tiket Batu Lawang dan Gunung Bendera secara real-time langsung di bilah status ponsel Anda.
                </p>

                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="btn-ui btn-fajar w-full py-3 text-sm font-bold"
                >
                  <i className="bi bi-bell-fill" aria-hidden="true" />
                  <span>Aktifkan Notifikasi di HP Sekarang</span>
                </button>
              </div>
            )}

            {/* Opsi Putar Ulang Intro Sinematik */}
            <div className="border-t border-kabut/15 pt-3 flex items-center justify-between text-xs text-kabut/70">
              <span>Ingin melihat intro pembuka web lagi?</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (typeof window !== "undefined") {
                    const fn = (window as unknown as { replayWdcIntro?: () => void }).replayWdcIntro;
                    if (fn) fn();
                  }
                }}
                className="font-bold text-fajar hover:underline inline-flex items-center gap-1"
              >
                <i className="bi bi-play-circle-fill" aria-hidden="true" />
                <span>Putar Ulang Intro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

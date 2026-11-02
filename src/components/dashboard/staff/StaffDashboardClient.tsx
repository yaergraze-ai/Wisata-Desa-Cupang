"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GateType, ScanResult, StaffOverrideMode } from "@prisma/client";
import jsQR from "jsqr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AppLocale } from "@/i18n/routing";
import { formatTimestampWib, formatVisitDateDisplay } from "@/lib/datetime-wib";
import { cn } from "@/lib/cn";
import type {
  ScanOutcome,
  StaffScanHistoryRow,
  StaffTicketSearchRow,
} from "@/server/scan/scan-service";
import type { StaffSelfState } from "@/server/staff/staff-schedule-service";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { MemberProfileTab } from "@/components/dashboard/member/MemberProfileTab";

export type StaffTab = "scanner" | "history" | "search" | "schedule" | "profile";

export interface StaffDashboardClientProps {
  locale: AppLocale;
  initialStaff: StaffSelfState;
  initialGate: GateType;
  initialHistory: StaffScanHistoryRow[];
  initialAdmittedCount: number;
  authCtx?: AuthenticatedContext;
}

function playScanFeedback(result: "ACCEPTED" | "REJECTED") {
  if (typeof window === "undefined") return;

  // Haptic feedback
  if ("navigator" in window && navigator.vibrate) {
    if (result === "ACCEPTED") {
      navigator.vibrate([120, 60, 120]);
    } else {
      navigator.vibrate([300, 100, 300]);
    }
  }

  // Web Audio chime / buzzer
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (result === "ACCEPTED") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Abaikan jika audio di-mute atau autoplay diblokir browser
  }
}

export function StaffDashboardClient({
  locale,
  initialStaff,
  initialGate,
  initialHistory,
  initialAdmittedCount,
  authCtx,
}: StaffDashboardClientProps) {
  const t = useTranslations("StaffDashboard");
  const manualInputId = useId();
  const searchInputId = useId();
  const emergencyReasonId = useId();

  const [activeTab, setActiveTab] = useState<StaffTab>("scanner");
  const [staff, setStaff] = useState<StaffSelfState>(initialStaff);
  const [selectedGate, setSelectedGate] = useState<GateType>(initialGate);
  const [todayAdmittedCount, setTodayAdmittedCount] =
    useState<number>(initialAdmittedCount);
  const [history, setHistory] =
    useState<StaffScanHistoryRow[]>(initialHistory);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isManualInputVisible, setIsManualInputVisible] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [isResettingScan, setIsResettingScan] = useState(false);
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StaffTicketSearchRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Emergency contact modal state
  const [revealTargetTicket, setRevealTargetTicket] =
    useState<StaffTicketSearchRow | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Schedule & sudden leave state
  const [overrideMode, setOverrideMode] = useState<StaffOverrideMode>(
    initialStaff.overrideMode
  );
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [suddenLeaveReason, setSuddenLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(
    initialStaff.leaveCooldownRemainingSeconds
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const scanFrameRef = useRef<() => void>(() => {});
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>("");
  const scanOutcomeRef = useRef<ScanOutcome | null>(null);

  useEffect(() => {
    scanOutcomeRef.current = scanOutcome;
  }, [scanOutcome]);

  // Callback ref untuk elemen video agar stream langsung terhubung seketika saat elemen dimount
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch((err) => {
        console.warn("Video auto-play callback error:", err);
      });
    }
  }, []);

  // Countdown timer untuk leave cooldown
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownSeconds]);

  // Eksekusi pemindaian (baik dari kamera maupun input manual)
  const executeScan = useCallback(
    async (codeToScan: string) => {
      const trimmed = codeToScan.trim();
      if (!trimmed || isSubmittingScan) return;

      setIsSubmittingScan(true);
      try {
        const res = await fetch("/api/staff/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawInput: trimmed,
            gate: selectedGate,
            locale,
          }),
        });

        const outcome = (await res.json()) as ScanOutcome;
        setScanOutcome(outcome);
        setTodayAdmittedCount(outcome.todayAdmittedAtGate);
        playScanFeedback(outcome.result);

        // Tambahkan ke riwayat lokal jika scan berhasil/tercatat
        if (outcome.ticket) {
          setHistory((prev) => [
            {
              id: outcome.scanId ?? `scan-${Date.now()}`,
              gate: outcome.gate,
              result: outcome.result,
              reason: outcome.reason,
              scannedAtIso: outcome.scannedAtIso,
              publicCode: outcome.ticket!.publicCode,
              productCode: outcome.ticket!.productCode,
              visitorName: outcome.ticket!.visitorName,
              admitCount: outcome.ticket!.admitCount,
            },
            ...prev.slice(0, 49),
          ]);
        }

        setManualCode("");
      } catch {
        toast.error("Gagal menghubungi server untuk validasi tiket.");
      } finally {
        setIsSubmittingScan(false);
      }
    },
    [isSubmittingScan, locale, selectedGate]
  );

  // Kamera scanner loop: Mendukung BarcodeDetector bawaan & jsQR fallback
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsScannerOpen(false);
    setIsTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      let detectedCode: string | null = null;

      // 1. Hardware accelerated BarcodeDetector jika didukung browser mobile
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as unknown as {
            BarcodeDetector: new (opts: { formats: string[] }) => {
              detect: (img: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
            };
          }).BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
            detectedCode = barcodes[0].rawValue;
          }
        } catch {
          // Fallback ke jsQR canvas bila BarcodeDetector gagal
        }
      }

      // 2. jsQR canvas fallback
      if (!detectedCode) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (qrCode && qrCode.data) {
            detectedCode = qrCode.data;
          }
        }
      }

      // 3. Jika kode terdeteksi, lakukan scan dengan proteksi anti-duplicate & freeze saat hasil tampil
      if (detectedCode && !scanOutcomeRef.current && !isSubmittingScan) {
        const now = Date.now();
        const isSameCode = detectedCode === lastScannedCodeRef.current;
        const cooldown = isSameCode ? 10000 : 2500;

        if (now - lastScannedTimeRef.current > cooldown) {
          lastScannedTimeRef.current = now;
          lastScannedCodeRef.current = detectedCode;
          void executeScan(detectedCode);
        }
      }
    }
  }, [executeScan, isSubmittingScan]);

  const dismissOutcome = useCallback(() => {
    setScanOutcome(null);
    // Beri tenggang waktu 1.5 detik agar petugas sempat mengarahkan kamera ke pengunjung berikutnya
    lastScannedTimeRef.current = Date.now() - 1000;
  }, []);

  const handleResetTicketScan = useCallback(
    async (ticketId: string, publicCode: string) => {
      setIsResettingScan(true);
      try {
        const res = await fetch("/api/staff/scan/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, publicCode }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (res.ok) {
          toast.success(
            data.message || "Status scan tiket berhasil direset! Tiket siap dipindai kembali."
          );
          dismissOutcome();
        } else {
          toast.error(data.error || "Gagal mereset status scan tiket.");
        }
      } catch {
        toast.error("Gagal menghubungi server untuk reset tiket.");
      } finally {
        setIsResettingScan(false);
      }
    },
    [dismissOutcome]
  );

  useEffect(() => {
    scanFrameRef.current = scanFrame;
  }, [scanFrame]);

  // RequestAnimationFrame loop saat kamera aktif & scanner terbuka
  useEffect(() => {
    if (!cameraActive || !isScannerOpen) {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      return;
    }

    let isLooping = true;
    const loop = () => {
      if (!isLooping) return;
      void scanFrameRef.current();
      scanLoopRef.current = requestAnimationFrame(loop);
    };

    scanLoopRef.current = requestAnimationFrame(loop);

    return () => {
      isLooping = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [cameraActive, isScannerOpen]);

  // Pastikan stream terhubung dan memutar video saat kamera aktif
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, isScannerOpen]);

  const startCamera = useCallback(
    async (targetFacing: "environment" | "user" = facingMode) => {
      setCameraError(null);
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        setIsTorchOn(false);

        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Peramban tidak mendukung akses kamera secara langsung (MediaDevices API tidak tersedia)."
          );
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Cek dukungan senter / flashlight
        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = (track.getCapabilities?.() || {}) as { torch?: boolean };
          setTorchAvailable(Boolean(caps.torch));
        }

        setCameraActive(true);
        setIsScannerOpen(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: unknown) {
        console.error("Camera startup error:", err);
        const msg = err instanceof Error ? err.message : t("cameraError");
        setCameraError(msg.includes("Peramban") ? msg : t("cameraError"));
        setCameraActive(false);
        setIsScannerOpen(false);
      }
    },
    [facingMode, t]
  );

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn("Gagal mengubah status senter:", err);
    }
  }, [isTorchOn]);

  const flipCamera = useCallback(async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  }, [facingMode, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Ambil riwayat terbaru saat berpindah gerbang
  const reloadGateHistory = useCallback(
    async (gate: GateType) => {
      try {
        const res = await fetch(`/api/staff/scan/history?gate=${gate}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { history: StaffScanHistoryRow[] };
          setHistory(data.history);
        }
      } catch {
        // Abaikan
      }
    },
    []
  );

  function handleSelectGate(gate: GateType) {
    setSelectedGate(gate);
    void reloadGateHistory(gate);
  }

  // Cari tiket
  async function handleSearchTickets(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length < 3) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/staff/tickets?q=${encodeURIComponent(searchQuery.trim())}&locale=${locale}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as { tickets: StaffTicketSearchRow[] };
        setSearchResults(data.tickets);
      }
    } finally {
      setIsSearching(false);
    }
  }

  // Tampilkan kontak darurat
  async function handleConfirmRevealContact(e: React.FormEvent) {
    e.preventDefault();
    if (!revealTargetTicket || emergencyReason.trim().length < 5) return;

    setIsRevealing(true);
    try {
      const res = await fetch(
        `/api/staff/tickets/${encodeURIComponent(revealTargetTicket.id)}/reveal-contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: emergencyReason.trim() }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          contact: { visitorWhatsapp: string };
        };
        setRevealedPhone(data.contact.visitorWhatsapp);
        toast.success("Nomor kontak darurat berhasil ditampilkan dan dicatat di Audit Log.");
      } else {
        toast.error("Gagal menampilkan kontak.");
      }
    } finally {
      setIsRevealing(false);
    }
  }

  // Update mode override
  async function handleUpdateOverrideMode(mode: StaffOverrideMode) {
    setIsUpdatingMode(true);
    try {
      const res = await fetch("/api/staff/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideMode: mode, locale }),
      });
      if (res.ok) {
        const data = (await res.json()) as { staff: StaffSelfState };
        setStaff(data.staff);
        setOverrideMode(data.staff.overrideMode);
        toast.success(t("saveModeSuccess"));
      }
    } finally {
      setIsUpdatingMode(false);
    }
  }

  // Ajukan libur mendadak
  async function handleSubmitSuddenLeave(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmittingLeave(true);
    try {
      const res = await fetch("/api/staff/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suddenLeaveReason, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        staff?: StaffSelfState;
        error?: string;
        details?: { remainingSeconds?: number };
      };
      if (res.ok && data.staff) {
        setStaff(data.staff);
        setOverrideMode(data.staff.overrideMode);
        setCooldownSeconds(data.staff.leaveCooldownRemainingSeconds);
        setSuddenLeaveReason("");
        toast.success(t("leaveSuccess"));
      } else {
        toast.error(data.error || "Gagal mengajukan libur mendadak.");
        if (data.details?.remainingSeconds) {
          setCooldownSeconds(data.details.remainingSeconds);
        }
      }
    } finally {
      setIsSubmittingLeave(false);
    }
  }

  function getReasonText(reason: string, detail: Record<string, string | number> | null): string {
    switch (reason) {
      case "OK":
        return t("reason_OK");
      case "INVALID_TOKEN":
        return t("reason_INVALID_TOKEN");
      case "QRIS_PAYMENT_SCANNED":
        return t("reason_QRIS_PAYMENT_SCANNED");
      case "UNAUTHORIZED_GATE":
        return t("reason_UNAUTHORIZED_GATE");
      case "TICKET_INACTIVE":
        return t("reason_TICKET_INACTIVE");
      case "WRONG_DATE":
        return t("reason_WRONG_DATE", {
          visitDate: String(detail?.visitDate ?? "-"),
        });
      case "OUTSIDE_HOURS":
        return t("reason_OUTSIDE_HOURS", {
          openTime: String(detail?.openTime ?? "-"),
          closeTime: String(detail?.closeTime ?? "-"),
        });
      case "NOT_WHITE_TICKET":
        return t("reason_NOT_WHITE_TICKET");
      case "ALREADY_SCANNED_AT_GATE":
        return t("reason_ALREADY_SCANNED_AT_GATE");
      default:
        return reason;
    }
  }

  return (
    <div className="space-y-6">
      {/* Notice Kontras Tinggi Luar Ruangan */}
      <div className="flex items-center gap-2 rounded-xl border-2 border-telaga-500 bg-obsidian px-4 py-2 text-xs font-bold text-telaga-200">
        <i className="bi bi-brightness-high-fill text-base text-fajar" aria-hidden="true" />
        <span>{t("highContrastNotice")}</span>
      </div>

      {/* Header Petugas, Destinasi, dan Pemilih Gerbang */}
      <section className="relative overflow-hidden surface-solid-dark rounded-3xl border border-telaga-700/60 bg-gradient-to-br from-hutan/90 via-obsidian/95 to-obsidian p-6 sm:p-7 shadow-2xl before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-fajar before:to-telaga-400">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-telaga-400/80 bg-telaga-950 px-3 py-1 text-xs font-extrabold text-telaga-200 uppercase shadow-inner">
              <i className="bi bi-shield-fill-check text-fajar" aria-hidden="true" />
              <span>{t("eyebrow")} — {staff.destinationName}</span>
            </span>
            <h1 className="mt-2 font-heading text-2xl font-extrabold text-kabut sm:text-3xl">
              {t("heading")}
            </h1>
            <p className="mt-1 text-xs text-kabut/80">
              {t("staffLabel")}{" "}
              <strong className="text-fajar font-bold">{staff.name}</strong> ({staff.jobTitle})
            </p>
          </div>

          {/* Penghitung Pengunjung Masuk Hari Ini di Gerbang Terpilih */}
          <div className="relative overflow-hidden rounded-2xl border border-fajar/50 bg-gradient-to-br from-fajar/10 via-obsidian/90 to-obsidian p-4 text-center sm:text-right shadow-lg">
            <div className="flex items-center justify-center sm:justify-end gap-2 text-xs font-bold tracking-wider text-kabut/80 uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{t("todayAdmittedCount")}</span>
            </div>
            <p
              data-testid="staff-today-admitted-count"
              className="mt-1 font-heading text-3xl sm:text-4xl font-black text-fajar"
            >
              {todayAdmittedCount}{" "}
              <span className="text-sm font-semibold text-kabut/75">
                {t("todayAdmittedUnit")}
              </span>
            </p>
          </div>
        </div>

        {/* Pemilih Gerbang Jaga (Hanya Gerbang yang Ditugaskan) */}
        <div className="mt-6 border-t border-telaga-800/80 pt-4">
          <p className="text-xs font-extrabold tracking-wider text-fajar uppercase flex items-center gap-2">
            <i className="bi bi-geo-alt-fill text-xs" aria-hidden="true" />
            <span>{t("gateSelectLabel")}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-3">
            {[GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA].map((gate) => {
              const isAssigned =
                Array.isArray(staff?.assignedGates) &&
                staff.assignedGates.includes(gate);
              const isSelected = selectedGate === gate;
              const gateName =
                gate === GateType.GERBANG_BATU_LAWANG
                  ? t("gateBatuLawang")
                  : t("gateGunungBendera");

              return (
                <button
                  key={gate}
                  type="button"
                  data-testid={`staff-gate-btn-${gate}`}
                  disabled={!isAssigned}
                  onClick={() => handleSelectGate(gate)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border-2 px-5 py-3 text-sm font-extrabold transition-all cursor-pointer",
                    isSelected
                      ? "border-fajar bg-fajar text-obsidian shadow-lg shadow-fajar/20 scale-102"
                      : isAssigned
                        ? "border-telaga-700/80 bg-obsidian/80 text-kabut hover:border-fajar hover:bg-obsidian"
                        : "border-kabut/10 bg-obsidian/30 text-kabut/40 cursor-not-allowed"
                  )}
                >
                  <i
                    className={cn(
                      "bi",
                      gate === GateType.GERBANG_BATU_LAWANG
                        ? "bi-geo-alt-fill"
                        : "bi-signpost-2-fill"
                    )}
                    aria-hidden="true"
                  />
                  <span>{gateName}</span>
                  {!isAssigned ? (
                    <span className="text-[11px] font-normal text-red-400">
                      {t("notAssignedBadge")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Navigasi Staf */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-telaga-800/80 pt-4">
          {[
            { id: "scanner" as const, label: t("tabScanner"), icon: "bi-qr-code-scan" },
            { id: "history" as const, label: t("tabHistory"), icon: "bi-clock-history" },
            { id: "search" as const, label: t("tabSearch"), icon: "bi-search" },
            { id: "schedule" as const, label: t("tabSchedule"), icon: "bi-calendar2-week" },
            { id: "profile" as const, label: "Profil Petugas", icon: "bi-person-gear" },
          ].map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`staff-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold uppercase transition-all cursor-pointer sm:text-sm",
                  isCurrent
                    ? "bg-fajar text-obsidian shadow-md shadow-fajar/25 font-black"
                    : "bg-obsidian/60 border border-telaga-800/60 text-kabut hover:border-telaga-600 hover:text-white"
                )}
              >
                <i className={cn("bi", tab.icon)} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: PEMINDAI KAMERA (FORMAT DANA) & INPUT MANUAL KONTROL PENUH */}
      {activeTab === "scanner" ? (
        <section className="space-y-6">
          <div className="surface-solid-dark rounded-3xl border border-telaga-700/60 bg-gradient-to-br from-hutan/80 via-obsidian/95 to-obsidian p-6 sm:p-7 shadow-2xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-heading text-xl font-black text-kabut sm:text-2xl flex items-center gap-2">
                  <i className="bi bi-qr-code-scan text-fajar" aria-hidden="true" />
                  <span>{t("tabScanner")}</span>
                </h2>
                <p className="mt-1 text-xs text-kabut/80">
                  {t("guardingGateLabel")}{" "}
                  <strong className="text-fajar font-bold">
                    {selectedGate === GateType.GERBANG_BATU_LAWANG
                      ? t("gateBatuLawang")
                      : t("gateGunungBendera")}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                data-testid="toggle-camera-btn"
                onClick={cameraActive ? stopCamera : () => void startCamera()}
                className={cn(
                  "btn-ui py-3.5 px-6 text-sm font-black shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer",
                  cameraActive ? "btn-kabut" : "btn-fajar"
                )}
              >
                <i
                  className={cn(
                    "bi",
                    cameraActive ? "bi-camera-video-off-fill" : "bi-qr-code-scan"
                  )}
                  aria-hidden="true"
                />
                <span>
                  {cameraActive
                    ? t("cameraStop")
                    : t("scannerOpenBtn") || "Buka Pemindai QR (Mode Kamera DANA)"}
                </span>
              </button>
            </div>

            {/* Banner Panduan Singkat Mode Kamera DANA */}
            <div className="mt-6 rounded-2xl border border-fajar/40 bg-gradient-to-r from-fajar/15 via-obsidian/90 to-obsidian p-5 shadow-inner">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-fajar">
                    <i className="bi bi-shield-check" aria-hidden="true" />
                    <span>Mode Validasi Cepat Gerbang</span>
                  </span>
                  <p className="text-sm font-bold text-kabut">
                    Arahkan kamera ke tiket QR pengunjung. Sistem otomatis mendeteksi tanda tangan HMAC, URL tiket, maupun kode publik.
                  </p>
                  <p className="text-xs text-kabut/70">
                    Mendukung lampu senter & pergantian kamera depan/belakang untuk situasi malam atau pencahayaan minim.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="btn-ui btn-fajar py-3 px-5 text-xs font-black self-start sm:self-auto shrink-0 shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  <i className="bi bi-camera-fill mr-2" aria-hidden="true" />
                  <span>Pindai Sekarang</span>
                </button>
              </div>
            </div>

            {cameraError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border-2 border-amber-500/50 bg-amber-950/60 p-4 text-xs font-semibold text-amber-200"
              >
                <i className="bi bi-exclamation-triangle-fill mr-2" aria-hidden="true" />
                {cameraError}
              </div>
            ) : null}

            {/* Input Manual Kode Tiket */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executeScan(manualCode);
              }}
              className="mt-6 rounded-2xl border-2 border-kabut/20 bg-hutan p-5"
            >
              <label
                htmlFor={manualInputId}
                className="block text-xs font-extrabold tracking-wider text-kabut uppercase"
              >
                {t("manualInputLabel")}
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id={manualInputId}
                  data-testid="manual-ticket-input"
                  type="text"
                  required
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder={t("manualInputHint")}
                  className="flex-1 rounded-xl border-2 border-kabut/30 bg-obsidian px-4 py-3 font-mono text-base font-bold text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
                />
                <button
                  type="submit"
                  data-testid="manual-ticket-submit-btn"
                  disabled={isSubmittingScan || !manualCode.trim()}
                  className="btn-ui btn-fajar py-3 font-black disabled:opacity-40"
                >
                  <i
                    className={cn(
                      "bi",
                      isSubmittingScan
                        ? "bi-arrow-repeat animate-spin"
                        : "bi-check2-circle"
                    )}
                    aria-hidden="true"
                  />
                  <span>{t("manualSubmitBtn")}</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {/* JENDELA PEMINDAI FULLSCREEN GAYA DANA / E-WALLET */}
      {isScannerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none overflow-hidden"
        >
          {/* Header Bar Pemindai */}
          <div className="relative z-20 flex items-center justify-between px-4 py-3.5 bg-gradient-to-b from-black/95 via-black/80 to-transparent">
            <button
              type="button"
              onClick={stopCamera}
              data-testid="close-scanner-modal-btn"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-black text-kabut backdrop-blur-md hover:bg-white/10 transition-colors"
            >
              <i className="bi bi-chevron-left" aria-hidden="true" />
              <span>{t("cancelBtn") || "Tutup"}</span>
            </button>

            <div className="text-center">
              <h2 className="font-heading text-sm font-extrabold sm:text-base text-white">
                {t("scannerModalTitle") || "Pemindai Tiket Masuk"}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-fajar">
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                <span>
                  {selectedGate === GateType.GERBANG_BATU_LAWANG
                    ? t("gateBatuLawang")
                    : t("gateGunungBendera")}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Senter (Torch) */}
              {torchAvailable ? (
                <button
                  type="button"
                  onClick={toggleTorch}
                  data-testid="toggle-torch-btn"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border transition-all backdrop-blur-md",
                    isTorchOn
                      ? "border-fajar bg-fajar text-obsidian shadow-[0_0_15px_#F59E0B]"
                      : "border-white/20 bg-black/60 text-white hover:border-fajar"
                  )}
                  title={isTorchOn ? t("scannerTorchOff") : t("scannerTorchOn")}
                >
                  <i
                    className={cn(
                      "bi",
                      isTorchOn ? "bi-lightning-fill text-base" : "bi-lightning text-base"
                    )}
                    aria-hidden="true"
                  />
                </button>
              ) : null}

              {/* Tombol Balik Kamera (Depan / Belakang) */}
              <button
                type="button"
                onClick={flipCamera}
                data-testid="switch-camera-btn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md hover:border-fajar transition-colors"
                title={t("scannerSwitchCamera") || "Ganti Kamera"}
              >
                <i className="bi bi-camera-reverse-fill text-base" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Area Kamera Viewfinder */}
          <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            <video
              ref={setVideoRef}
              playsInline
              autoPlay
              muted
              onCanPlay={() => {
                if (videoRef.current && videoRef.current.paused) {
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Cutout Mask Vignette Gelap di Sekitar Kotak Fokus (Khas DANA) */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
              {/* Bagian Atas Mask Gelap */}
              <div className="flex-1 bg-black/65 w-full backdrop-blur-[1px]" />

              {/* Baris Tengah: Samping Kiri + Kotak Bidik + Samping Kanan */}
              <div className="flex items-center justify-center w-full">
                <div className="flex-1 bg-black/65 h-64 sm:h-72 backdrop-blur-[1px]" />

                {/* Kotak Bidik QR (Targeting Box) */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border border-fajar/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-auto">
                  {/* 4 Sudut Reticle Khas E-Wallet DANA */}
                  <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-fajar rounded-tl-2xl shadow-[0_0_12px_#F59E0B]" />
                  <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-fajar rounded-tr-2xl shadow-[0_0_12px_#F59E0B]" />
                  <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-fajar rounded-bl-2xl shadow-[0_0_12px_#F59E0B]" />
                  <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-fajar rounded-br-2xl shadow-[0_0_12px_#F59E0B]" />

                  {/* Garis Laser Animasi Bergerak Naik-Turun */}
                  <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-fajar to-transparent shadow-[0_0_15px_#F59E0B] animate-scan-laser pointer-events-none" />

                  {/* Titik Target Tengah */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                    <i className="bi bi-plus-lg text-4xl text-fajar" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex-1 bg-black/65 h-64 sm:h-72 backdrop-blur-[1px]" />
              </div>

              {/* Bagian Bawah Mask Gelap: Petunjuk Visual */}
              <div className="flex-1 bg-black/65 w-full flex flex-col items-center justify-start pt-5 px-6 backdrop-blur-[1px] space-y-3">
                <div className="text-center space-y-1">
                  <p className="font-heading text-sm sm:text-base font-black text-white tracking-wide">
                    {t("scannerViewfinderPrompt")}
                  </p>
                  <p className="text-xs text-kabut/80 font-medium">
                    {t("scannerViewfinderSubtitle")}
                  </p>
                </div>

                {/* Status Indikator Deteksi */}
                <div className="inline-flex items-center gap-2 rounded-full border border-fajar/40 bg-black/75 px-4 py-1.5 text-xs font-bold backdrop-blur-md">
                  {isSubmittingScan ? (
                    <>
                      <i className="bi bi-arrow-repeat animate-spin text-fajar text-sm" aria-hidden="true" />
                      <span className="text-fajar font-bold">{t("scannerValidating")}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-emerald-300 font-bold">{t("scannerDetecting")}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Input Manual Cepat & Ringkasan Hari Ini */}
          <div className="relative z-20 bg-obsidian border-t-2 border-kabut/20 p-4 space-y-3">
            {isManualInputVisible ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void executeScan(manualCode);
                }}
                className="flex gap-2"
              >
                <input
                  data-testid="scanner-modal-manual-input"
                  type="text"
                  required
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder={t("manualInputHint")}
                  className="flex-1 rounded-xl border-2 border-kabut/30 bg-hutan px-4 py-2.5 font-mono text-sm font-bold text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmittingScan || !manualCode.trim()}
                  className="btn-ui btn-fajar py-2.5 px-4 text-xs font-black disabled:opacity-40"
                >
                  {isSubmittingScan ? "Memproses..." : "Validasi"}
                </button>
              </form>
            ) : null}

            <div className="flex items-center justify-between text-xs font-bold text-kabut/80">
              <button
                type="button"
                onClick={() => setIsManualInputVisible((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-fajar hover:underline"
              >
                <i className="bi bi-keyboard-fill" aria-hidden="true" />
                <span>
                  {isManualInputVisible
                    ? "Tutup Input Manual"
                    : t("scannerManualInputToggle")}
                </span>
              </button>

              <span className="text-kabut/70">
                Masuk hari ini:{" "}
                <strong className="text-fajar font-extrabold">
                  {todayAdmittedCount} {t("todayAdmittedUnit")}
                </strong>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL HASIL PINDAI DIGITAL BOARDING PASS E-TICKET (DESAIN PREMIUM KONTEMPORER) */}
      {scanOutcome ? (
        <div
          data-testid="scan-overlay-result"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 select-none"
        >
          <div
            className={cn(
              "relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl transition-all border-2",
              scanOutcome.result === ScanResult.ACCEPTED
                ? "bg-[#0a1713] border-emerald-500/70 shadow-[0_0_60px_rgba(16,185,129,0.35)]"
                : "bg-[#180a0d] border-rose-500/70 shadow-[0_0_60px_rgba(244,63,94,0.35)]"
            )}
          >
            {/* Header Tiket Atas */}
            <div
              className={cn(
                "p-6 pb-5 text-center relative",
                scanOutcome.result === ScanResult.ACCEPTED
                  ? "bg-gradient-to-b from-emerald-600/30 via-emerald-950/20 to-transparent"
                  : "bg-gradient-to-b from-rose-600/30 via-rose-950/20 to-transparent"
              )}
            >
              {/* Lingkaran Ikon Melayang dengan Glow Halus */}
              <div
                className={cn(
                  "mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-xl",
                  scanOutcome.result === ScanResult.ACCEPTED
                    ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-obsidian shadow-[0_0_25px_rgba(16,185,129,0.5)]"
                    : "bg-gradient-to-tr from-rose-600 to-red-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.5)]"
                )}
              >
                <i
                  className={cn(
                    "bi",
                    scanOutcome.result === ScanResult.ACCEPTED
                      ? "bi-check-lg"
                      : "bi-x-lg"
                  )}
                  aria-hidden="true"
                />
              </div>

              {/* Status Badge Pill */}
              <div className="mt-3.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black tracking-wider uppercase border",
                    scanOutcome.result === ScanResult.ACCEPTED
                      ? "bg-emerald-950/90 text-emerald-300 border-emerald-400/50"
                      : "bg-rose-950/90 text-rose-300 border-rose-400/50"
                  )}
                >
                  <i
                    className={cn(
                      "bi",
                      scanOutcome.result === ScanResult.ACCEPTED
                        ? "bi-shield-check"
                        : "bi-exclamation-triangle-fill"
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {scanOutcome.result === ScanResult.ACCEPTED
                      ? t("scanResultAccepted")
                      : t("scanResultRejected")}
                  </span>
                </span>
              </div>

              <h2 className="mt-2 font-heading text-2xl font-black text-white tracking-tight">
                {scanOutcome.result === ScanResult.ACCEPTED
                  ? "Akses Masuk Diizinkan"
                  : "Pindaian Ditolak"}
              </h2>

              <p
                className={cn(
                  "mt-1.5 text-xs font-semibold px-2 leading-relaxed",
                  scanOutcome.result === ScanResult.ACCEPTED
                    ? "text-emerald-200/90"
                    : "text-rose-200/90"
                )}
              >
                {getReasonText(scanOutcome.reason, scanOutcome.detail)}
              </p>
            </div>

            {/* Perforated Stub Divider (Robekan Khas Tiket Boarding Pass) */}
            <div className="relative flex items-center justify-between px-3">
              <div className="h-6 w-6 -ml-6 rounded-full bg-black/90 border border-kabut/20 shadow-inner" />
              <div className="flex-1 border-b-2 border-dashed border-kabut/25 mx-2" />
              <div className="h-6 w-6 -mr-6 rounded-full bg-black/90 border border-kabut/20 shadow-inner" />
            </div>

            {/* Isi Tiket: Rombongan & Rincian Tiket */}
            <div className="p-6 pt-4 space-y-4">
              {scanOutcome.ticket ? (
                <>
                  {/* Hero Kotak Kapasitas Rombongan */}
                  <div className="rounded-2xl border-2 border-fajar/60 bg-gradient-to-br from-amber-500/15 via-obsidian to-amber-600/10 p-4 text-center shadow-lg">
                    <p className="text-[11px] font-black uppercase tracking-widest text-fajar">
                      {t("admitGroupConfirm")}
                    </p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <i className="bi bi-people-fill text-2xl text-fajar" aria-hidden="true" />
                      <p
                        data-testid="scan-confirm-admit-count"
                        className="font-heading text-4xl font-black text-white"
                      >
                        {scanOutcome.ticket.admitCount}
                      </p>
                      <span className="text-base font-bold text-kabut">
                        {t("todayAdmittedUnit")}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-kabut/75">
                      {scanOutcome.result === ScanResult.ACCEPTED
                        ? "Silakan persilakan seluruh anggota rombongan masuk bersamaan."
                        : "Tiket tidak dapat digunakan untuk akses masuk."}
                    </p>
                  </div>

                  {/* Ringkasan Data Tiket */}
                  <div className="rounded-2xl border border-kabut/20 bg-hutan/80 p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-kabut/10 pb-2">
                      <span className="text-kabut/70 flex items-center gap-1.5">
                        <i className="bi bi-qr-code text-fajar" aria-hidden="true" />
                        {t("ticketCodeLabel")}
                      </span>
                      <span className="font-mono text-sm font-extrabold text-white">
                        {scanOutcome.ticket.publicCode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-kabut/10 pb-2">
                      <span className="text-kabut/70 flex items-center gap-1.5">
                        <i className="bi bi-person-fill text-telaga-300" aria-hidden="true" />
                        {t("visitorLabel")}
                      </span>
                      <span className="font-bold text-kabut truncate max-w-[200px]">
                        {scanOutcome.ticket.visitorName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-kabut/70 flex items-center gap-1.5">
                        <i className="bi bi-ticket-detailed-fill text-fajar" aria-hidden="true" />
                        {t("productLabel")}
                      </span>
                      <span className="font-bold text-fajar">
                        {scanOutcome.ticket.productName}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* Bila bukan tiket (misal QRIS pembayaran atau token tak dikenal) */
                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-center space-y-2">
                  <i className="bi bi-info-circle-fill text-2xl text-amber-400" aria-hidden="true" />
                  <p className="text-xs font-bold text-amber-200 leading-relaxed">
                    {scanOutcome.reason === "QRIS_PAYMENT_SCANNED"
                      ? "Perhatian: Yang Anda pindai adalah barcode pembayaran QRIS. Untuk tiket masuk gerbang, pastikan membuka menu 'Tiket Saya' di akun pemesan setelah pembayaran lunas."
                      : "Barcode yang dipindai tidak terdaftar sebagai tiket masuk resmi Desa Cupang."}
                  </p>
                </div>
              )}

              {/* Tombol Aksi Utama */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  data-testid="next-scan-btn"
                  onClick={dismissOutcome}
                  className="btn-ui btn-fajar w-full py-3.5 text-sm font-black shadow-xl flex items-center justify-center gap-2"
                >
                  <i className="bi bi-camera-fill text-base" aria-hidden="true" />
                  <span>{t("scannerNextScanBtn") || "Lanjut Pindai Berikutnya"}</span>
                </button>

                {/* Tombol Reset Uji Coba (Khusus jika ditolak karena ALREADY_SCANNED_AT_GATE) */}
                {scanOutcome.reason === "ALREADY_SCANNED_AT_GATE" && scanOutcome.ticket ? (
                  <button
                    type="button"
                    disabled={isResettingScan}
                    onClick={() =>
                      handleResetTicketScan(
                        scanOutcome.ticket!.id,
                        scanOutcome.ticket!.publicCode
                      )
                    }
                    className="w-full rounded-xl border border-amber-500/50 bg-amber-950/60 py-2.5 px-4 text-xs font-bold text-amber-200 hover:bg-amber-900 transition-colors flex items-center justify-center gap-2"
                  >
                    <i
                      className={cn(
                        "bi",
                        isResettingScan
                          ? "bi-arrow-repeat animate-spin"
                          : "bi-arrow-counterclockwise"
                      )}
                      aria-hidden="true"
                    />
                    <span>
                      {isResettingScan
                        ? "Mereset Tiket..."
                        : "Reset Scan Tiket Ini (Mode Uji Coba)"}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    dismissOutcome();
                    stopCamera();
                  }}
                  className="w-full py-2 text-center text-xs font-bold text-kabut/60 hover:text-kabut transition-colors"
                >
                  Tutup Pemindai Kamera
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TAB 2: RIWAYAT HARI INI */}
      {activeTab === "history" ? (
        <section className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-black text-kabut">
              {t("historyHeading")} (
              {selectedGate === GateType.GERBANG_BATU_LAWANG
                ? t("gateBatuLawang")
                : t("gateGunungBendera")}
              )
            </h2>
            <button
              type="button"
              onClick={() => reloadGateHistory(selectedGate)}
              className="btn-ui btn-glass text-xs"
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              <span>{t("refreshBtn")}</span>
            </button>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border-2 border-kabut/15 bg-hutan p-8 text-center text-sm text-kabut/75">
              {t("historyEmpty")}
            </div>
          ) : (
            <div className="divide-y-2 divide-kabut/10 rounded-2xl border-2 border-kabut/20 bg-hutan overflow-hidden">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black uppercase",
                          item.result === ScanResult.ACCEPTED
                            ? "bg-[#2F8F83] text-obsidian"
                            : "bg-red-600 text-white"
                        )}
                      >
                        {item.result === ScanResult.ACCEPTED
                          ? t("scanAcceptedBadge")
                          : t("scanRejectedBadge")}
                      </span>
                      <span className="font-mono text-sm font-extrabold text-kabut">
                        {item.publicCode}
                      </span>
                      <span className="rounded-md border border-fajar/40 bg-obsidian px-2 py-0.5 text-[11px] font-bold text-fajar">
                        {item.admitCount} {t("peopleUnit")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-kabut/80">
                      {item.visitorName} · {item.reason}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-kabut/70">
                    {formatTimestampWib(new Date(item.scannedAtIso), locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 3: CARI TIKET & TOMBOL DARURAT "TAMPILKAN KONTAK" */}
      {activeTab === "search" ? (
        <section className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-black text-kabut">
              {t("searchHeading")}
            </h2>
            <p className="mt-1 text-xs text-kabut/80">{t("searchHint")}</p>
          </div>

          <form onSubmit={handleSearchTickets} className="flex gap-3">
            <input
              id={searchInputId}
              data-testid="staff-ticket-search-input"
              type="text"
              required
              minLength={3}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 rounded-xl border-2 border-kabut/30 bg-hutan px-4 py-2.5 text-sm font-bold text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
            />
            <button
              type="submit"
              data-testid="staff-ticket-search-submit"
              disabled={isSearching || searchQuery.trim().length < 3}
              className="btn-ui btn-fajar py-2.5 font-black disabled:opacity-40"
            >
              <i
                className={cn(
                  "bi",
                  isSearching ? "bi-arrow-repeat animate-spin" : "bi-search"
                )}
                aria-hidden="true"
              />
              <span>{t("searchBtn")}</span>
            </button>
          </form>

          {searchResults.length > 0 ? (
            <div className="divide-y-2 divide-kabut/10 rounded-2xl border-2 border-kabut/20 bg-hutan overflow-hidden">
              {searchResults.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-extrabold text-fajar">
                        {ticket.publicCode}
                      </span>
                      <span className="rounded-md border border-telaga-500 bg-obsidian px-2 py-0.5 text-xs font-bold text-telaga-200">
                        {ticket.admitCount} {t("peopleUnit")}
                      </span>
                    </div>
                    <p className="text-xs text-kabut font-bold">
                      {ticket.visitorName} · {ticket.productName}
                    </p>
                    <p className="text-xs text-kabut/75">
                      {t("visitDatePrefix")}{" "}
                      {formatVisitDateDisplay(ticket.visitDateYmd, locale)}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid={`reveal-contact-btn-${ticket.publicCode}`}
                    onClick={() => {
                      setRevealTargetTicket(ticket);
                      setEmergencyReason("");
                      setRevealedPhone(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-500/60 bg-amber-950/60 px-3.5 py-2 text-xs font-black text-amber-200 hover:bg-amber-900"
                  >
                    <i className="bi bi-telephone-exclamation-fill" aria-hidden="true" />
                    <span>{t("revealContactBtn")}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : isSearching ? null : (
            <div className="rounded-2xl border-2 border-kabut/10 bg-hutan p-6 text-center text-xs text-kabut/70">
              {t("searchEmpty")}
            </div>
          )}

          {/* Modal Pembukaan Kontak Darurat dengan Alasan Wajib Dicatat ke AuditLog (§6.D.2) */}
          {revealTargetTicket ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-3xl border-2 border-fajar bg-obsidian p-6 text-kabut shadow-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading text-lg font-black text-fajar">
                      {t("revealContactModalTitle")}
                    </h3>
                    <p className="text-xs text-kabut/75">
                      {revealTargetTicket.visitorName} ({revealTargetTicket.publicCode})
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="close-reveal-modal-btn"
                    onClick={() => setRevealTargetTicket(null)}
                    className="rounded-lg p-1 text-kabut hover:text-white"
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                </div>

                <p className="text-xs text-kabut/85 leading-relaxed">
                  {t("revealContactModalDesc")}
                </p>

                {revealedPhone ? (
                  <div className="rounded-2xl border-2 border-telaga-500 bg-hutan p-4 text-center">
                    <p className="text-xs font-bold text-telaga-200">
                      {t("officialWaTitle")}
                    </p>
                    <p
                      data-testid="revealed-visitor-phone"
                      className="mt-1 font-mono text-2xl font-black text-fajar"
                    >
                      {revealedPhone}
                    </p>
                    <a
                      href={`https://wa.me/${revealedPhone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ui btn-fajar mt-3 text-xs font-black inline-flex"
                    >
                      <i className="bi bi-whatsapp mr-1.5" aria-hidden="true" />
                      <span>{t("contactOnWaBtn")}</span>
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleConfirmRevealContact} className="space-y-3">
                    <div>
                      <label
                        htmlFor={emergencyReasonId}
                        className="block text-xs font-extrabold uppercase text-kabut"
                      >
                        {t("emergencyReasonLabel")}
                      </label>
                      <textarea
                        id={emergencyReasonId}
                        data-testid="emergency-reason-input"
                        required
                        minLength={5}
                        rows={3}
                        value={emergencyReason}
                        onChange={(e) => setEmergencyReason(e.target.value)}
                        placeholder={t("emergencyReasonHint")}
                        className="mt-1 w-full rounded-xl border-2 border-kabut/30 bg-hutan p-3 text-xs text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setRevealTargetTicket(null)}
                        className="btn-ui btn-glass text-xs"
                      >
                        {t("cancelBtn")}
                      </button>
                      <button
                        type="submit"
                        data-testid="emergency-reason-submit-btn"
                        disabled={isRevealing || emergencyReason.trim().length < 5}
                        className="btn-ui btn-fajar text-xs font-black disabled:opacity-40"
                      >
                        {isRevealing ? "Membuka..." : t("emergencyReasonSubmit")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* TAB 4: JADWAL & STATUS TUGAS MANDIRI + LIBUR MENDADAK COOLDOWN 30 MENIT (§5.7) */}
      {activeTab === "schedule" ? (
        <section className="space-y-6">
          <div className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7 space-y-5">
            <div>
              <h2 className="font-heading text-xl font-black text-kabut">
                {t("dutyHeading")}
              </h2>
              <p className="mt-1 text-xs text-kabut/80">
                {t("dutyDescription")}
              </p>
            </div>

            {/* Mode Override Radio */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  mode: StaffOverrideMode.FOLLOW_SCHEDULE,
                  title: t("modeFollowSchedule"),
                  desc: "Sesuai jadwal mingguan sistem",
                },
                {
                  mode: StaffOverrideMode.FORCE_ACTIVE,
                  title: t("modeForceActive"),
                  desc: "Tetap aktif di luar jam shift",
                },
                {
                  mode: StaffOverrideMode.FORCE_INACTIVE,
                  title: t("modeForceInactive"),
                  desc: "Nonaktif / istirahat sementara",
                },
              ].map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  data-testid={`override-mode-${item.mode}`}
                  disabled={isUpdatingMode}
                  onClick={() => handleUpdateOverrideMode(item.mode)}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all",
                    overrideMode === item.mode
                      ? "border-fajar bg-fajar/15 text-kabut"
                      : "border-kabut/20 bg-hutan text-kabut/80 hover:border-kabut/40"
                  )}
                >
                  <span className="font-heading text-sm font-extrabold text-fajar">
                    {item.title}
                  </span>
                  <span className="mt-1 text-xs text-kabut/75">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Libur Mendadak dengan Cooldown 30 Menit Enforced */}
          <div className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7 space-y-4">
            <h3 className="font-heading text-lg font-black text-amber-300">
              <i className="bi bi-clock-history mr-2" aria-hidden="true" />
              {t("suddenLeaveHeading")}
            </h3>
            <p className="text-xs text-kabut/80 leading-relaxed">
              {t("suddenLeaveDesc")}
            </p>

            {cooldownSeconds > 0 ? (
              <div
                data-testid="leave-cooldown-notice"
                className="rounded-2xl border-2 border-amber-500/60 bg-amber-950/60 p-4 text-xs font-bold text-amber-200"
              >
                <i className="bi bi-hourglass-split mr-2 text-base" aria-hidden="true" />
                {t("cooldownActiveNotice", {
                  minutes: Math.ceil(cooldownSeconds / 60),
                })}
              </div>
            ) : (
              <form onSubmit={handleSubmitSuddenLeave} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-kabut">
                    {t("suddenLeaveReasonLabel")}
                  </label>
                  <input
                    type="text"
                    data-testid="sudden-leave-reason-input"
                    value={suddenLeaveReason}
                    onChange={(e) => setSuddenLeaveReason(e.target.value)}
                    placeholder={t("suddenLeavePlaceholder")}
                    className="mt-1 w-full rounded-xl border-2 border-kabut/30 bg-hutan px-4 py-2.5 text-xs text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="sudden-leave-submit-btn"
                  disabled={isSubmittingLeave}
                  className="btn-ui btn-fajar text-xs font-black"
                >
                  <i className="bi bi-person-x-fill mr-1.5" aria-hidden="true" />
                  <span>{isSubmittingLeave ? "Memproses..." : t("suddenLeaveSubmit")}</span>
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}

      {/* TAB 5: PROFIL PETUGAS */}
      {activeTab === "profile" && authCtx ? (
        <MemberProfileTab authCtx={authCtx} />
      ) : null}
    </div>
  );
}

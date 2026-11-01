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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
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

  // Kamera scanner loop
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
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
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
          const now = Date.now();
          if (now - lastScannedTimeRef.current > 3000) {
            lastScannedTimeRef.current = now;
            void executeScan(qrCode.data);
          }
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(() => scanFrameRef.current());
  }, [executeScan]);

  useEffect(() => {
    scanFrameRef.current = scanFrame;
  }, [scanFrame]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      scanLoopRef.current = requestAnimationFrame(() => scanFrameRef.current());
    } catch {
      setCameraError(t("cameraError"));
      setCameraActive(false);
    }
  }, [t]);

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
      <section className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-telaga-400 bg-telaga-950 px-3 py-1 text-xs font-extrabold text-telaga-200 uppercase">
              <i className="bi bi-shield-fill-check" aria-hidden="true" />
              <span>{t("eyebrow")} — {staff.destinationName}</span>
            </span>
            <h1 className="mt-2 font-heading text-2xl font-extrabold text-kabut sm:text-3xl">
              {t("heading")}
            </h1>
            <p className="mt-1 text-xs text-kabut/80">
              {t("staffLabel")}{" "}
              <strong className="text-fajar">{staff.name}</strong> ({staff.jobTitle})
            </p>
          </div>

          {/* Penghitung Pengunjung Masuk Hari Ini di Gerbang Terpilih */}
          <div className="rounded-2xl border-2 border-fajar bg-hutan p-4 text-center sm:text-right">
            <p className="text-xs font-extrabold tracking-wider text-kabut uppercase">
              {t("todayAdmittedCount")}
            </p>
            <p
              data-testid="staff-today-admitted-count"
              className="mt-0.5 font-heading text-3xl font-black text-fajar"
            >
              {todayAdmittedCount}{" "}
              <span className="text-sm font-semibold text-kabut">
                {t("todayAdmittedUnit")}
              </span>
            </p>
          </div>
        </div>

        {/* Pemilih Gerbang Jaga (Hanya Gerbang yang Ditugaskan) */}
        <div className="mt-6 border-t-2 border-kabut/20 pt-4">
          <p className="text-xs font-extrabold tracking-wider text-fajar uppercase">
            {t("gateSelectLabel")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-3">
            {[GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA].map((gate) => {
              const isAssigned = staff.assignedGates.includes(gate);
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
                    "inline-flex items-center gap-2 rounded-2xl border-2 px-5 py-3 text-sm font-extrabold transition-all",
                    isSelected
                      ? "border-fajar bg-fajar text-obsidian shadow-lg"
                      : isAssigned
                        ? "border-kabut/30 bg-hutan text-kabut hover:border-fajar"
                        : "border-kabut/10 bg-obsidian/40 text-kabut/40 cursor-not-allowed"
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
        <div className="mt-6 flex flex-wrap gap-2 border-t-2 border-kabut/15 pt-4">
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
                  "inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-xs font-black uppercase transition-colors sm:text-sm",
                  isCurrent
                    ? "border-fajar bg-fajar text-obsidian"
                    : "border-kabut/20 bg-hutan/80 text-kabut hover:border-kabut/50"
                )}
              >
                <i className={cn("bi", tab.icon)} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: PEMINDAI KAMERA & INPUT MANUAL KONTROL PENUH */}
      {activeTab === "scanner" ? (
        <section className="space-y-6">
          <div className="rounded-3xl border-2 border-kabut/25 bg-obsidian p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-heading text-xl font-black text-kabut sm:text-2xl">
                  {t("tabScanner")}
                </h2>
                <p className="mt-1 text-xs text-kabut/80">
                  {t("guardingGateLabel")}{" "}
                  <strong className="text-fajar">
                    {selectedGate === GateType.GERBANG_BATU_LAWANG
                      ? t("gateBatuLawang")
                      : t("gateGunungBendera")}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                data-testid="toggle-camera-btn"
                onClick={cameraActive ? stopCamera : startCamera}
                className={cn(
                  "btn-ui py-3 text-sm font-black",
                  cameraActive ? "btn-kabut" : "btn-fajar"
                )}
              >
                <i
                  className={cn(
                    "bi",
                    cameraActive ? "bi-camera-video-off-fill" : "bi-camera-video-fill"
                  )}
                  aria-hidden="true"
                />
                <span>{cameraActive ? t("cameraStop") : t("cameraStart")}</span>
              </button>
            </div>

            {/* Jendela Video Kamera */}
            {cameraActive ? (
              <div className="relative mt-5 overflow-hidden rounded-2xl border-4 border-fajar bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="mx-auto max-h-96 w-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-60 w-60 rounded-3xl border-4 border-dashed border-fajar/80 shadow-2xl" />
                </div>
                <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-obsidian/90 px-3 py-1.5 text-center text-xs font-bold text-fajar backdrop-blur-sm">
                  {t("cameraActive")}
                </div>
              </div>
            ) : null}

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

      {/* OVERLAY HASIL PINDAI LAYAR PENUH HIJAU/MERAH DENGAN ADMIT COUNT KONFIRMASI (§6.D.1) */}
      {scanOutcome ? (
        <div
          data-testid="scan-overlay-result"
          onClick={() => setScanOutcome(null)}
          className={cn(
            "fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center p-6 text-center select-none backdrop-blur-md",
            scanOutcome.result === ScanResult.ACCEPTED
              ? "bg-[#062419]/95 text-[#E8F1EC] border-8 border-[#2F8F83]"
              : "bg-[#2E0808]/95 text-[#FEE2E2] border-8 border-red-600"
          )}
        >
          <div className="max-w-xl space-y-4">
            <span
              className={cn(
                "inline-flex h-24 w-24 items-center justify-center rounded-full text-5xl",
                scanOutcome.result === ScanResult.ACCEPTED
                  ? "bg-[#2F8F83] text-obsidian shadow-2xl"
                  : "bg-red-600 text-white shadow-2xl"
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
            </span>

            <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
              {scanOutcome.result === ScanResult.ACCEPTED
                ? t("scanResultAccepted")
                : t("scanResultRejected")}
            </h2>

            <p className="text-base font-bold sm:text-lg">
              {getReasonText(scanOutcome.reason, scanOutcome.detail)}
            </p>

            {scanOutcome.ticket ? (
              <div
                className={cn(
                  "mt-4 rounded-2xl border-2 p-5 text-left text-sm",
                  scanOutcome.result === ScanResult.ACCEPTED
                    ? "border-[#2F8F83] bg-black/40"
                    : "border-red-400 bg-black/40"
                )}
              >
                {/* Konfirmasi Jumlah Pengunjung Rombongan Sangat Jelas */}
                <div className="rounded-xl border-2 border-fajar bg-hutan p-3 text-center">
                  <p className="text-xs font-extrabold uppercase text-kabut">
                    {t("admitGroupConfirm")}
                  </p>
                  <p
                    data-testid="scan-confirm-admit-count"
                    className="font-heading text-4xl font-black text-fajar"
                  >
                    {scanOutcome.ticket.admitCount}{" "}
                    <span className="text-base font-bold text-kabut">
                      {t("todayAdmittedUnit")}
                    </span>
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-kabut/75">{t("ticketCodeLabel")}</dt>
                    <dd className="font-mono text-sm font-extrabold text-kabut">
                      {scanOutcome.ticket.publicCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-kabut/75">{t("visitorLabel")}</dt>
                    <dd className="font-bold text-kabut truncate">
                      {scanOutcome.ticket.visitorName}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-kabut/75">{t("productLabel")}</dt>
                    <dd className="font-bold text-fajar">
                      {scanOutcome.ticket.productName}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <p className="pt-4 text-xs font-bold text-kabut/80 uppercase">
              {t("dismissOverlayBtn")}
            </p>
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

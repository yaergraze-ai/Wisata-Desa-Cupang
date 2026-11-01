"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus, TicketStatus } from "@prisma/client";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import {
  formatTimestampWib,
  formatVisitDateDisplay,
  normalizeIndonesianWhatsapp,
} from "@/lib/datetime-wib";
import { cn } from "@/lib/cn";
import type { ServerOrderQuoteResult } from "@/server/pricing/quote-service";
import type {
  MemberDashboardSnapshot,
  SerializedOrderSummary,
  SerializedWalletTicket,
} from "@/server/orders/order-service";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { PerforatedTicketCard } from "@/components/dashboard/member/PerforatedTicketCard";
import { ReviewModal } from "@/components/dashboard/member/ReviewModal";
import { RefundModal } from "@/components/dashboard/member/RefundModal";
import { MemberProfileTab } from "@/components/dashboard/member/MemberProfileTab";

export type MemberDashboardTab = "overview" | "buy" | "wallet" | "orders" | "profile";

const WALLET_STORAGE_KEY = "wisata_cirebon_wallet_cache";

interface CachedWalletPayload {
  userId: string;
  savedAtIso: string;
  tickets: SerializedWalletTicket[];
}

interface MidtransSnapWindow extends Window {
  snap?: {
    pay: (
      token: string,
      options?: {
        language?: "id" | "en";
        onSuccess?: () => void;
        onPending?: () => void;
        onError?: () => void;
        onClose?: () => void;
      }
    ) => void;
  };
}

export interface MemberDashboardClientProps {
  locale: AppLocale;
  userId: string;
  userName: string;
  userEmail: string;
  userWhatsapp: string | null;
  authCtx?: AuthenticatedContext;
  initialTab: MemberDashboardTab;
  initialQuote: ServerOrderQuoteResult;
  initialSnapshot: MemberDashboardSnapshot;
  initialFocusOrderId?: string | null;
}

export function MemberDashboardClient({
  locale,
  userId,
  userName,
  userEmail,
  userWhatsapp,
  authCtx,
  initialTab,
  initialQuote,
  initialSnapshot,
  initialFocusOrderId = null,
}: MemberDashboardClientProps) {
  const t = useTranslations("MemberDashboard");
  const tCalc = useTranslations("Calculator");
  const tShell = useTranslations("DashboardShell");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<MemberDashboardTab>(initialTab);
  const [orders, setOrders] = useState<SerializedOrderSummary[]>(
    initialSnapshot.orders
  );
  const [walletTickets, setWalletTickets] = useState<SerializedWalletTicket[]>(
    initialSnapshot.walletTickets
  );
  const [isOffline, setIsOffline] = useState(false);
  const [cachedSavedAtIso, setCachedSavedAtIso] = useState<string | null>(null);

  // State Wizard 3 Langkah (Pos 1 -> Pos 2 -> Pos 3)
  const initialFocusOrder = useMemo(() => {
    if (initialFocusOrderId) {
      return (
        initialSnapshot.orders.find((o) => o.id === initialFocusOrderId) ?? null
      );
    }
    return null;
  }, [initialFocusOrderId, initialSnapshot.orders]);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(() => {
    if (initialFocusOrder) {
      return initialFocusOrder.status === OrderStatus.PAID ? 3 : 2;
    }
    return 1;
  });
  const [activeCheckoutOrder, setActiveCheckoutOrder] =
    useState<SerializedOrderSummary | null>(initialFocusOrder);

  // State Langkah 1
  const [visitDate, setVisitDate] = useState(initialQuote.visitDate);
  const [putihQty, setPutihQty] = useState(() => {
    const line = initialQuote.lines.find((l) => l.code === "TIKET_PUTIH");
    return line?.qty ?? 2;
  });
  const [regulerQty, setRegulerQty] = useState(() => {
    const line = initialQuote.lines.find((l) => l.code === "REGULER_BL");
    return line?.qty ?? 0;
  });
  const [quote, setQuote] = useState<ServerOrderQuoteResult>(initialQuote);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [visitorName, setVisitorName] = useState(userName);
  const [visitorWhatsapp, setVisitorWhatsapp] = useState(userWhatsapp ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // State Langkah 2
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [refreshingOrder, setRefreshingOrder] = useState(false);
  const [openingSnap, setOpeningSnap] = useState(false);

  // State Modal Ulasan & Refund (Fase 7)
  const [reviewModalTicket, setReviewModalTicket] =
    useState<SerializedWalletTicket | null>(null);
  const [refundModalOrder, setRefundModalOrder] =
    useState<SerializedOrderSummary | null>(null);

  const isFirstQuoteMount = useRef(true);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Sinkronkan tab aktif ke query string tanpa reload halaman
  const selectTab = useCallback((nextTab: MemberDashboardTab) => {
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  // Simpan dompet tiket ke localStorage khusus userId yang sedang login (§6.C.3 & §6.I)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;

    const payload: CachedWalletPayload = {
      userId,
      savedAtIso: new Date().toISOString(),
      tickets: walletTickets,
    };
    try {
      window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Abaikan bila kuota penyimpanan peramban penuh
    }
  }, [userId, walletTickets]);

  // Deteksi status daring/luring & muat cache perangkat bila luring
  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyOfflineState() {
      const offlineNow = !navigator.onLine;
      setIsOffline(offlineNow);
      if (offlineNow) {
        try {
          const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw) as CachedWalletPayload;
          if (parsed && parsed.userId === userId && Array.isArray(parsed.tickets)) {
            setCachedSavedAtIso(parsed.savedAtIso);
            setWalletTickets((prev) =>
              prev.length > 0 ? prev : parsed.tickets
            );
          }
        } catch {
          // Abaikan cache korup
        }
      }
    }

    applyOfflineState();
    window.addEventListener("online", applyOfflineState);
    window.addEventListener("offline", applyOfflineState);
    return () => {
      window.removeEventListener("online", applyOfflineState);
      window.removeEventListener("offline", applyOfflineState);
    };
  }, [userId]);

  // Muat skrip resmi Midtrans Snap hanya ketika kunci Midtrans aktif & langkah 2 dibuka
  useEffect(() => {
    const cfg = initialSnapshot.paymentConfig;
    if (!cfg.configured || !cfg.clientKey || typeof document === "undefined") {
      return;
    }
    const existing = document.getElementById("midtrans-snap-script");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = cfg.snapScriptUrl;
    script.async = true;
    script.setAttribute("data-client-key", cfg.clientKey);
    document.body.appendChild(script);
  }, [initialSnapshot.paymentConfig]);

  // Ambil ulang kalkulasi harga & kuota server saat tanggal/jumlah diubah di Pos 1
  const refreshServerQuote = useCallback(
    async (nextDate: string, nextReguler: number, nextPutih: number) => {
      quoteAbortRef.current?.abort();
      const controller = new AbortController();
      quoteAbortRef.current = controller;
      setQuoteLoading(true);

      try {
        const qs = new URLSearchParams({
          visitDate: nextDate,
          regulerQty: String(nextReguler),
          putihQty: String(nextPutih),
          locale,
        });
        const res = await fetch(`/api/public/quote?${qs.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as ServerOrderQuoteResult;
          setQuote(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Pertahankan hasil kalkulasi sebelumnya
        }
      } finally {
        if (quoteAbortRef.current === controller) {
          setQuoteLoading(false);
        }
      }
    },
    [locale]
  );

  useEffect(() => {
    if (isFirstQuoteMount.current) {
      isFirstQuoteMount.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void refreshServerQuote(visitDate, regulerQty, putihQty);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [putihQty, refreshServerQuote, regulerQty, visitDate]);

  // Segarkan snapshot pesanan & dompet dari server
  const reloadDashboardSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?locale=${locale}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const snap = (await res.json()) as MemberDashboardSnapshot;
      setOrders(snap.orders);
      setWalletTickets(snap.walletTickets);
      return snap;
    } catch {
      return null;
    }
  }, [locale]);

  // Periksa status satu pesanan (dipakai oleh tombol segarkan & polling Pos 2)
  const checkSingleOrderStatus = useCallback(
    async (orderId: string, showSpinner = false) => {
      if (showSpinner) setRefreshingOrder(true);
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}?locale=${locale}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { order: SerializedOrderSummary };
        const updatedOrder = json.order;

        setActiveCheckoutOrder(updatedOrder);
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === updatedOrder.id);
          return exists
            ? prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            : [updatedOrder, ...prev];
        });

        if (updatedOrder.status === OrderStatus.PAID) {
          setWalletTickets((prev) => {
            const other = prev.filter((tk) => tk.orderId !== updatedOrder.id);
            return [...updatedOrder.tickets, ...other];
          });
          if (wizardStep === 2) {
            setWizardStep(3);
            toast.success(t("orderPaidToast"));
          }
        }
      } finally {
        if (showSpinner) setRefreshingOrder(false);
      }
    },
    [locale, t, wizardStep]
  );

  // Detak hitung mundur 1 detik & polling 5 detik saat berada di Pos 2 dengan pesanan PENDING
  useEffect(() => {
    if (
      activeTab !== "buy" ||
      wizardStep !== 2 ||
      !activeCheckoutOrder ||
      activeCheckoutOrder.status !== OrderStatus.PENDING
    ) {
      return;
    }

    const tickInterval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    const pollInterval = window.setInterval(() => {
      if (navigator.onLine) {
        void checkSingleOrderStatus(activeCheckoutOrder.id, false);
      }
    }, 5000);

    return () => {
      window.clearInterval(tickInterval);
      window.clearInterval(pollInterval);
    };
  }, [activeCheckoutOrder, activeTab, checkSingleOrderStatus, wizardStep]);

  function adjustPutih(delta: number) {
    setPutihQty((prev) => {
      const next = Math.max(0, prev + delta);
      if (next + regulerQty > quote.maxTicketsPerOrder) return prev;
      return next;
    });
  }

  function adjustReguler(delta: number) {
    setRegulerQty((prev) => {
      const next = Math.max(0, prev + delta);
      if (next + putihQty > quote.maxTicketsPerOrder) return prev;
      return next;
    });
  }

  function renderBlockingMessage(): string | null {
    switch (quote.blockingCode) {
      case "ZERO_QTY":
        return tCalc("blockingZeroQty");
      case "EXCEEDS_MAX_TICKETS":
        return tCalc("blockingMaxTickets", { max: quote.maxTicketsPerOrder });
      case "PAST_DATE":
      case "INVALID_DATE_FORMAT":
        return tCalc("blockingPastDate");
      case "OUTSIDE_BOOKING_WINDOW":
        return tCalc("blockingWindow", { days: quote.bookingWindowDays });
      case "SAME_DAY_CUTOFF":
        return tCalc("blockingCutoff", {
          destination: quote.cutoffDestinationName ?? "",
          cutoff: quote.cutoffTimeWib ?? "",
        });
      case "INSUFFICIENT_QUOTA":
        return tCalc("blockingQuota", {
          destination: quote.insufficientDestination?.name ?? "",
          remaining: quote.insufficientDestination?.remaining ?? 0,
          requested: quote.insufficientDestination?.requested ?? 0,
        });
      default:
        return null;
    }
  }

  async function handleCreateOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (visitorName.trim().length < 2) {
      setFormError(t("errHolderName"));
      return;
    }

    const normalizedWa = normalizeIndonesianWhatsapp(visitorWhatsapp);
    if (!normalizedWa) {
      setFormError(t("errHolderWa"));
      return;
    }

    if (!quote.canCheckout) {
      setFormError(renderBlockingMessage() ?? t("errCreateOrder"));
      return;
    }

    setCreatingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate,
          putihQty,
          regulerQty,
          visitorName: visitorName.trim(),
          visitorWhatsapp: normalizedWa,
          locale,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        order?: SerializedOrderSummary;
        error?: string;
      };

      if (!res.ok || !json.order) {
        const msg = json.error || t("errCreateOrder");
        setFormError(msg);
        toast.error(msg);
        void refreshServerQuote(visitDate, regulerQty, putihQty);
        return;
      }

      setActiveCheckoutOrder(json.order);
      setOrders((prev) => [json.order!, ...prev]);
      setNowMs(Date.now());
      setWizardStep(2);
      toast.success(t("orderCreatedToast"));
      void refreshServerQuote(visitDate, regulerQty, putihQty);
    } catch {
      setFormError(t("errCreateOrder"));
      toast.error(t("errCreateOrder"));
    } finally {
      setCreatingOrder(false);
    }
  }

  function handleLaunchMidtransSnap(order: SerializedOrderSummary) {
    if (!order.snapToken || typeof window === "undefined") return;
    const win = window as MidtransSnapWindow;
    if (!win.snap) {
      if (order.snapRedirectUrl) {
        window.open(order.snapRedirectUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setOpeningSnap(true);
    win.snap.pay(order.snapToken, {
      language: locale,
      onSuccess: () => {
        setOpeningSnap(false);
        void checkSingleOrderStatus(order.id, true);
      },
      onPending: () => {
        setOpeningSnap(false);
        void checkSingleOrderStatus(order.id, true);
      },
      onError: () => {
        setOpeningSnap(false);
        void checkSingleOrderStatus(order.id, true);
      },
      onClose: () => {
        setOpeningSnap(false);
        void checkSingleOrderStatus(order.id, false);
      },
    });
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingId(orderId);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/cancel?locale=${locale}`,
        { method: "POST" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        order?: SerializedOrderSummary;
        error?: string;
      };

      if (!res.ok || !json.order) {
        toast.error(json.error || t("errCancelOrder"));
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === json.order!.id ? json.order! : o))
      );
      if (activeCheckoutOrder?.id === orderId) {
        setActiveCheckoutOrder(null);
        setWizardStep(1);
      }
      toast.success(t("cancelSuccessToast"));
      void refreshServerQuote(visitDate, regulerQty, putihQty);
      void reloadDashboardSnapshot();
    } catch {
      toast.error(t("errCancelOrder"));
    } finally {
      setCancellingId(null);
    }
  }

  function handleResumePendingOrder(order: SerializedOrderSummary) {
    setActiveCheckoutOrder(order);
    setNowMs(Date.now());
    setWizardStep(2);
    selectTab("buy");
  }

  // Hitung statistik nyata untuk tab Ringkasan
  const activeTickets = useMemo(
    () => walletTickets.filter((tk) => tk.status === TicketStatus.ACTIVE),
    [walletTickets]
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === OrderStatus.PENDING && !o.effectiveExpired
      ),
    [orders]
  );

  const nearestVisitYmd = useMemo(() => {
    const todayYmd = initialQuote.minVisitDate;
    const upcoming = activeTickets
      .map((tk) => tk.visitDateYmd)
      .filter((d) => d >= todayYmd)
      .sort();
    return upcoming[0] ?? null;
  }, [activeTickets, initialQuote.minVisitDate]);

  // Format sisa waktu kunci kuota MM:SS di Pos 2
  const remainingSeconds = useMemo(() => {
    if (!activeCheckoutOrder) return 0;
    const diffMs =
      new Date(activeCheckoutOrder.expiresAtIso).getTime() - nowMs;
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [activeCheckoutOrder, nowMs]);

  const countdownFormatted = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [remainingSeconds]);

  const putihLine = quote.lines.find((l) => l.code === "TIKET_PUTIH");
  const regulerLine = quote.lines.find((l) => l.code === "REGULER_BL");
  const blockingMessage = renderBlockingMessage();

  const tabs: Array<{ id: MemberDashboardTab; label: string; icon: string; badge?: number }> = [
    { id: "overview", label: t("tabOverview"), icon: "bi-grid-1x2-fill" },
    { id: "buy", label: t("tabBuy"), icon: "bi-bag-plus-fill" },
    {
      id: "wallet",
      label: t("tabWallet"),
      icon: "bi-qr-code",
      badge: activeTickets.length > 0 ? activeTickets.length : undefined,
    },
    {
      id: "orders",
      label: t("tabOrders"),
      icon: "bi-receipt-cutoff",
      badge: pendingOrders.length > 0 ? pendingOrders.length : undefined,
    },
    {
      id: "profile",
      label: t("tabProfile"),
      icon: "bi-person-gear",
    },
  ];

  function formatOrderStatusLabel(status: OrderStatus): {
    label: string;
    className: string;
  } {
    switch (status) {
      case OrderStatus.PAID:
        return {
          label: t("orderStatusPaid"),
          className: "border-telaga-400/50 bg-telaga-950 text-telaga-200",
        };
      case OrderStatus.PENDING:
        return {
          label: t("orderStatusPending"),
          className: "border-fajar/50 bg-fajar/15 text-fajar",
        };
      case OrderStatus.CANCELLED:
        return {
          label: t("orderStatusCancelled"),
          className: "border-kabut/25 bg-obsidian text-kabut/75",
        };
      case OrderStatus.REFUND_REQUESTED:
        return {
          label: t("orderStatusRefundRequested"),
          className: "border-fajar/50 bg-hutan text-fajar",
        };
      case OrderStatus.REFUNDED:
        return {
          label: t("orderStatusRefunded"),
          className: "border-telaga-400/35 bg-obsidian text-telaga-200",
        };
      case OrderStatus.EXPIRED:
      default:
        return {
          label: t("orderStatusExpired"),
          className: "border-red-500/35 bg-red-950/60 text-red-200",
        };
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Sambutan & Navigasi Tab dengan Garis Aktif Motion layoutId (§7.2) */}
      <section className="surface-solid-dark p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold text-kabut sm:text-3xl">
              {tShell("welcome", { name: userName })}
            </h1>
            <p className="mt-1 text-xs text-kabut/75">
              {tShell("signedInAs", { email: userEmail })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setWizardStep(1);
              setActiveCheckoutOrder(null);
              selectTab("buy");
            }}
            className="btn-ui btn-fajar self-start md:self-auto"
          >
            <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
            <span>{t("tabBuy")}</span>
          </button>
        </div>

        {/* Baris Tab */}
        <nav
          aria-label={t("tabsNavAria")}
          className="mt-6 flex flex-wrap gap-2 border-t border-kabut/15 pt-4"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`member-tab-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors sm:text-sm",
                  isSelected
                    ? "text-obsidian"
                    : "bg-obsidian/55 text-kabut hover:bg-obsidian"
                )}
              >
                {isSelected ? (
                  <motion.span
                    layoutId="member-tab-indicator"
                    className="absolute inset-0 rounded-xl bg-fajar"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <i
                  className={cn("bi relative z-10", tab.icon)}
                  aria-hidden="true"
                />
                <span className="relative z-10">{tab.label}</span>
                {tab.badge ? (
                  <span
                    className={cn(
                      "relative z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold",
                      isSelected
                        ? "bg-obsidian text-fajar"
                        : "bg-telaga-700 text-kabut"
                    )}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </section>

      {/* Banner Peringatan Pesanan PENDING yang Menunggu Pembayaran */}
      {pendingOrders.length > 0 && activeTab !== "buy" ? (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-fajar/50 bg-hutan p-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fajar/15 text-fajar">
              <i className="bi bi-hourglass-split text-lg" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-sm font-bold text-fajar">
                {t("pendingAlertTitle", {
                  orderNumber: pendingOrders[0]!.orderNumber,
                })}
              </p>
              <p className="mt-0.5 text-xs text-kabut/85">
                {t("pendingAlertDesc", {
                  date: formatVisitDateDisplay(
                    pendingOrders[0]!.visitDateYmd,
                    locale
                  ),
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleResumePendingOrder(pendingOrders[0]!)}
            className="btn-ui btn-fajar shrink-0"
          >
            <i className="bi bi-credit-card-2-front-fill" aria-hidden="true" />
            <span>{t("resumePaymentBtn")}</span>
          </button>
        </div>
      ) : null}

      {/* TAB 1: RINGKASAN */}
      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface-solid-dark p-5">
              <p className="text-xs font-bold tracking-wider text-kabut/75 uppercase">
                {t("activeTicketsStat")}
              </p>
              <p className="mt-2 font-heading text-3xl font-extrabold text-fajar">
                {activeTickets.length}
              </p>
            </div>

            <div className="surface-solid-dark p-5">
              <p className="text-xs font-bold tracking-wider text-kabut/75 uppercase">
                {t("nearestVisitStat")}
              </p>
              <p className="mt-2 font-heading text-xl font-bold text-kabut">
                {nearestVisitYmd
                  ? formatVisitDateDisplay(nearestVisitYmd, locale)
                  : t("noUpcomingVisit")}
              </p>
            </div>

            <div className="surface-solid-dark p-5">
              <p className="text-xs font-bold tracking-wider text-kabut/75 uppercase">
                {t("totalOrdersStat")}
              </p>
              <p className="mt-2 font-heading text-3xl font-extrabold text-telaga-200">
                {orders.length}
              </p>
            </div>
          </div>

          {/* Tindakan Cepat */}
          <section className="surface-solid-dark p-5 sm:p-6">
            <h2 className="font-heading text-lg font-bold text-kabut">
              {t("quickActionsHeading")}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setWizardStep(1);
                  setActiveCheckoutOrder(null);
                  selectTab("buy");
                }}
                className="flex flex-col items-start rounded-2xl border border-kabut/15 bg-obsidian/70 p-4 text-left transition-colors hover:border-fajar"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-fajar/15 text-fajar">
                  <i className="bi bi-bag-plus-fill text-lg" aria-hidden="true" />
                </span>
                <p className="mt-3 font-heading text-base font-bold text-kabut">
                  {t("quickBuyTitle")}
                </p>
                <p className="mt-1 text-xs text-kabut/75">{t("quickBuyDesc")}</p>
              </button>

              <button
                type="button"
                onClick={() => selectTab("wallet")}
                className="flex flex-col items-start rounded-2xl border border-kabut/15 bg-obsidian/70 p-4 text-left transition-colors hover:border-telaga-300"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-telaga-950 text-telaga-200">
                  <i className="bi bi-qr-code-scan text-lg" aria-hidden="true" />
                </span>
                <p className="mt-3 font-heading text-base font-bold text-kabut">
                  {t("quickWalletTitle")}
                </p>
                <p className="mt-1 text-xs text-kabut/75">
                  {t("quickWalletDesc")}
                </p>
              </button>

              <Link
                href="/jalur"
                className="flex flex-col items-start rounded-2xl border border-kabut/15 bg-obsidian/70 p-4 text-left transition-colors hover:border-fajar"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-hutan border border-telaga-700 text-fajar">
                  <i className="bi bi-signpost-split-fill text-lg" aria-hidden="true" />
                </span>
                <p className="mt-3 font-heading text-base font-bold text-kabut">
                  {t("quickTrailTitle")}
                </p>
                <p className="mt-1 text-xs text-kabut/75">
                  {t("quickTrailDesc")}
                </p>
              </Link>
            </div>
          </section>

          {/* Cuplikan Tiket Terbaru */}
          {walletTickets.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-kabut">
                  {t("recentTicketsHeading")}
                </h2>
                <button
                  type="button"
                  onClick={() => selectTab("wallet")}
                  className="text-xs font-bold text-fajar hover:underline"
                >
                  {t("openFullWalletBtn")} →
                </button>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                {walletTickets.slice(0, 2).map((tk) => (
                  <PerforatedTicketCard
                    key={tk.id}
                    ticket={tk}
                    locale={locale}
                    isOffline={isOffline}
                    onWriteReview={setReviewModalTicket}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* TAB 2: BELI TIKET — WIZARD 3 LANGKAH BERMOTIF JALUR (§6.C.2) */}
      {activeTab === "buy" ? (
        <section className="surface-solid-dark p-5 sm:p-8">
          <div className="max-w-3xl">
            <h2 className="font-heading text-xl font-bold text-kabut sm:text-2xl">
              {t("wizardHeading")}
            </h2>
            <p className="mt-1 text-xs text-kabut/80 sm:text-sm">
              {t("wizardSubheading")}
            </p>
          </div>

          {/* Stepper Bermotif Jalur Pendakian */}
          <ol
            aria-label={t("wizardStepsAria")}
            className="mt-6 grid gap-3 rounded-2xl border border-kabut/15 bg-obsidian/80 p-4 sm:grid-cols-3"
          >
            {[
              { step: 1 as const, label: t("step1Label"), icon: "bi-compass-fill" },
              {
                step: 2 as const,
                label: t("step2Label"),
                icon: "bi-credit-card-2-front-fill",
              },
              {
                step: 3 as const,
                label: t("step3Label"),
                icon: "bi-patch-check-fill",
              },
            ].map((item) => {
              const isCurrent = wizardStep === item.step;
              const isDone = wizardStep > item.step;
              return (
                <li
                  key={item.step}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-bold",
                    isCurrent
                      ? "border-fajar bg-fajar/15 text-fajar"
                      : isDone
                        ? "border-telaga-400/45 bg-telaga-950/80 text-telaga-200"
                        : "border-kabut/10 bg-hutan/40 text-kabut/60"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                      isCurrent
                        ? "bg-fajar text-obsidian"
                        : isDone
                          ? "bg-telaga-700 text-kabut"
                          : "bg-obsidian text-kabut/60"
                    )}
                  >
                    <i className={cn("bi", item.icon)} aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </li>
              );
            })}
          </ol>

          <AnimatePresence mode="wait">
            {/* POS 1: PILIH PAKET, TANGGAL & PEMEGANG */}
            {wizardStep === 1 ? (
              <motion.form
                key="wizard-step-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreateOrderSubmit}
                className="mt-6 grid gap-6 lg:grid-cols-12"
              >
                <div className="space-y-5 lg:col-span-7">
                  {/* Pilihan Tanggal Kunjungan */}
                  <div className="rounded-2xl border border-kabut/15 bg-obsidian/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="checkout-visit-date"
                        className="text-xs font-bold tracking-wider text-fajar uppercase"
                      >
                        {t("visitDateLabel")}
                      </label>
                      <span className="text-xs text-kabut/75">
                        {t("visitDateRangeHint", {
                          min: formatVisitDateDisplay(quote.minVisitDate, locale),
                          max: formatVisitDateDisplay(quote.maxVisitDate, locale),
                        })}
                      </span>
                    </div>
                    <input
                      id="checkout-visit-date"
                      type="date"
                      min={quote.minVisitDate}
                      max={quote.maxVisitDate}
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-kabut/25 bg-hutan px-3.5 py-2.5 text-sm font-semibold text-kabut focus:border-fajar focus:outline-none"
                    />

                    {/* Bar Sisa Kuota per Destinasi */}
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {quote.destinations.map((dest) => {
                        const pct =
                          dest.capacity > 0
                            ? Math.min(
                                100,
                                Math.round((dest.remaining / dest.capacity) * 100)
                              )
                            : 0;
                        return (
                          <div
                            key={dest.id}
                            className="rounded-xl border border-kabut/10 bg-hutan/80 p-3"
                          >
                            <p className="text-xs font-semibold text-kabut">
                              {t("quotaBarLabel", {
                                name: dest.name,
                                remaining: dest.remaining,
                                capacity: dest.capacity,
                              })}
                            </p>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-obsidian">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  dest.remaining <= 10
                                    ? "bg-red-400"
                                    : "bg-fajar"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kartu Pilihan 1: TIKET PUTIH (Kertas Kabut Terang) */}
                  {putihLine ? (
                    <div className="rounded-2xl border-2 border-[#195E56] bg-[#F6FAF8] p-4 text-obsidian sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#195E56] px-3 py-1 text-[11px] font-extrabold text-[#F6FAF8] uppercase">
                          <i className="bi bi-stars text-fajar" aria-hidden="true" />
                          <span>{t("putihBadge")}</span>
                        </span>
                        <span className="font-heading text-lg font-extrabold text-[#195E56]">
                          {formatRupiah(putihLine.unitTotal, locale)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                          <h3 className="font-heading text-lg font-extrabold text-obsidian">
                            {putihLine.name}
                          </h3>
                          <p className="mt-0.5 text-xs font-semibold text-[#195E56]">
                            {t("putihGatesInfo")}
                          </p>
                          <p className="mt-1 text-xs text-obsidian/80">
                            {t("unitBreakdown", {
                              base: formatRupiah(putihLine.unitBase, locale),
                              parking: formatRupiah(
                                putihLine.unitParking,
                                locale
                              ),
                              total: formatRupiah(putihLine.unitTotal, locale),
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            data-testid="checkout-putih-minus"
                            aria-label={t("decreaseQtyAria", {
                              name: putihLine.name,
                            })}
                            onClick={() => adjustPutih(-1)}
                            disabled={putihQty <= 0}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#195E56] bg-white font-bold text-[#195E56] disabled:opacity-40"
                          >
                            <i className="bi bi-dash-lg" aria-hidden="true" />
                          </button>
                          <span
                            data-testid="checkout-putih-qty"
                            className="w-10 text-center font-heading text-lg font-extrabold text-obsidian"
                          >
                            {putihQty}
                          </span>
                          <button
                            type="button"
                            data-testid="checkout-putih-plus"
                            aria-label={t("increaseQtyAria", {
                              name: putihLine.name,
                            })}
                            onClick={() => adjustPutih(1)}
                            disabled={
                              putihQty + regulerQty >= quote.maxTicketsPerOrder
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#195E56] font-bold text-[#F6FAF8] disabled:opacity-40"
                          >
                            <i className="bi bi-plus-lg" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Kartu Pilihan 2: TIKET REGULER BATU LAWANG (Hutan Gelap) */}
                  {regulerLine ? (
                    <div className="rounded-2xl border-2 border-telaga-500 bg-obsidian/85 p-4 text-kabut sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-telaga-400/40 bg-hutan px-3 py-1 text-[11px] font-bold text-telaga-200 uppercase">
                          <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                          <span>{t("regulerBadge")}</span>
                        </span>
                        <span className="font-heading text-lg font-extrabold text-fajar">
                          {formatRupiah(regulerLine.unitTotal, locale)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                          <h3 className="font-heading text-lg font-bold text-kabut">
                            {regulerLine.name}
                          </h3>
                          <p className="mt-0.5 text-xs font-medium text-telaga-200">
                            {t("regulerGatesInfo")}
                          </p>
                          <p className="mt-1 text-xs text-kabut/75">
                            {t("unitBreakdown", {
                              base: formatRupiah(regulerLine.unitBase, locale),
                              parking: formatRupiah(
                                regulerLine.unitParking,
                                locale
                              ),
                              total: formatRupiah(
                                regulerLine.unitTotal,
                                locale
                              ),
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            data-testid="checkout-reguler-minus"
                            aria-label={t("decreaseQtyAria", {
                              name: regulerLine.name,
                            })}
                            onClick={() => adjustReguler(-1)}
                            disabled={regulerQty <= 0}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-kabut/25 bg-hutan font-bold text-kabut disabled:opacity-40"
                          >
                            <i className="bi bi-dash-lg" aria-hidden="true" />
                          </button>
                          <span
                            data-testid="checkout-reguler-qty"
                            className="w-10 text-center font-heading text-lg font-extrabold text-kabut"
                          >
                            {regulerQty}
                          </span>
                          <button
                            type="button"
                            data-testid="checkout-reguler-plus"
                            aria-label={t("increaseQtyAria", {
                              name: regulerLine.name,
                            })}
                            onClick={() => adjustReguler(1)}
                            disabled={
                              putihQty + regulerQty >= quote.maxTicketsPerOrder
                            }
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-fajar font-bold text-obsidian disabled:opacity-40"
                          >
                            <i className="bi bi-plus-lg" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Kolom Kanan: Data Pemegang + Ringkasan Harga Server + Tombol Kunci Kuota */}
                <div className="space-y-5 lg:col-span-5">
                  <div className="rounded-2xl border border-kabut/15 bg-obsidian/80 p-5 space-y-4">
                    <h3 className="font-heading text-base font-bold text-kabut">
                      {t("holderSectionTitle")}
                    </h3>

                    <div>
                      <label
                        htmlFor="checkout-holder-name"
                        className="block text-xs font-bold text-kabut/85"
                      >
                        {t("holderNameLabel")}
                      </label>
                      <input
                        id="checkout-holder-name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        placeholder={t("holderNameHint")}
                        className="mt-1.5 w-full rounded-xl border border-kabut/25 bg-hutan px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45 focus:border-fajar focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-holder-wa"
                        className="block text-xs font-bold text-kabut/85"
                      >
                        {t("holderWaLabel")}
                      </label>
                      <input
                        id="checkout-holder-wa"
                        type="tel"
                        required
                        value={visitorWhatsapp}
                        onChange={(e) => setVisitorWhatsapp(e.target.value)}
                        placeholder={t("holderWaHint")}
                        className="mt-1.5 w-full rounded-xl border border-kabut/25 bg-hutan px-3.5 py-2.5 text-sm text-kabut placeholder:text-kabut/45 focus:border-fajar focus:outline-none"
                      />
                      {initialSnapshot.whatsappIntegrationActive ? (
                        <p className="mt-1.5 text-[11px] text-fajar">
                          {t("waOtpNotice")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Ringkasan Biaya Terhitung Server */}
                  <div className="rounded-2xl border border-telaga-700 bg-obsidian/90 p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-kabut/80">
                      <span>
                        {t("summaryTicketsLine", {
                          count: quote.totalVisitors,
                        })}
                      </span>
                      <span className="font-semibold text-kabut">
                        {formatRupiah(quote.baseSubtotal, locale)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-kabut/80">
                      <span>{t("summaryParkingLine")}</span>
                      <span className="font-semibold text-kabut">
                        {formatRupiah(quote.parkingSubtotal, locale)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-kabut/15 pt-3">
                      <span className="font-heading text-sm font-bold text-kabut">
                        {t("summaryGrandTotal")}
                      </span>
                      <span
                        data-testid="checkout-grand-total"
                        className="font-heading text-2xl font-extrabold text-fajar"
                      >
                        {formatRupiah(quote.grandTotal, locale)}
                      </span>
                    </div>

                    <p className="text-[11px] text-kabut/70">
                      {t("paymentWindowNote", {
                        minutes: quote.paymentWindowMinutes,
                      })}
                    </p>

                    {blockingMessage ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-400/45 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-200"
                      >
                        {blockingMessage}
                      </div>
                    ) : null}

                    {formError ? (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-400/45 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-200"
                      >
                        {formError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      data-testid="checkout-submit-lock-btn"
                      disabled={
                        creatingOrder || quoteLoading || !quote.canCheckout
                      }
                      className="btn-ui btn-fajar w-full justify-center py-3 text-sm disabled:opacity-45"
                    >
                      <i
                        className={cn(
                          "bi",
                          creatingOrder
                            ? "bi-arrow-repeat animate-spin"
                            : "bi-lock-fill"
                        )}
                        aria-hidden="true"
                      />
                      <span>
                        {creatingOrder
                          ? t("lockingQuotaBusy")
                          : t("lockQuotaCta")}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.form>
            ) : null}

            {/* POS 2: PEMBAYARAN MIDTRANS SNAP, HITUNG MUNDUR & PEMBATALAN KUOTA NYATA */}
            {wizardStep === 2 && activeCheckoutOrder ? (
              <motion.div
                key="wizard-step-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-6 space-y-6"
              >
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="space-y-4 rounded-2xl border border-kabut/15 bg-obsidian/80 p-5 lg:col-span-7 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold tracking-wider text-kabut/70 uppercase">
                          {t("orderNumberLabel")}
                        </p>
                        <p
                          data-testid="step2-order-number"
                          className="font-mono text-lg font-extrabold text-fajar"
                        >
                          {activeCheckoutOrder.orderNumber}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "rounded-xl border px-4 py-2 text-right",
                          remainingSeconds <= 180
                            ? "border-red-400/50 bg-red-950/60 text-red-200"
                            : "border-fajar/45 bg-fajar/12 text-fajar"
                        )}
                      >
                        <p className="text-[11px] font-bold uppercase">
                          {remainingSeconds > 0
                            ? t("countdownLabel")
                            : t("countdownExpiredLabel")}
                        </p>
                        <p
                          data-testid="step2-countdown"
                          className="font-mono text-xl font-extrabold"
                        >
                          {countdownFormatted}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-kabut/10 border-y border-kabut/15 py-3 text-sm">
                      <div className="flex justify-between py-2">
                        <span className="text-kabut/75">
                          {t("fieldVisitDate")}
                        </span>
                        <span className="font-bold text-kabut">
                          {formatVisitDateDisplay(
                            activeCheckoutOrder.visitDateYmd,
                            locale
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-kabut/75">{t("fieldHolder")}</span>
                        <span className="font-semibold text-kabut">
                          {activeCheckoutOrder.visitorName} (
                          {activeCheckoutOrder.visitorWhatsapp})
                        </span>
                      </div>
                      {activeCheckoutOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between py-2"
                        >
                          <span className="text-kabut">
                            {item.productName} × {item.qty}
                          </span>
                          <span className="font-bold text-kabut">
                            {formatRupiah(item.subtotal, locale)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-3">
                        <span className="font-heading font-bold text-kabut">
                          {t("summaryGrandTotal")}
                        </span>
                        <span className="font-heading text-xl font-extrabold text-fajar">
                          {formatRupiah(activeCheckoutOrder.totalAmount, locale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Panel Aksi Pembayaran & Pembatalan */}
                  <div className="space-y-4 rounded-2xl border border-telaga-700 bg-obsidian/90 p-5 lg:col-span-5 sm:p-6">
                    <h3 className="font-heading text-lg font-bold text-kabut">
                      {t("step2Heading")}
                    </h3>
                    <p className="text-xs text-kabut/80">
                      {t("step2Subheading")}
                    </p>

                    {initialSnapshot.paymentConfig.configured &&
                    activeCheckoutOrder.snapToken ? (
                      <div className="space-y-2.5 pt-2">
                        <button
                          type="button"
                          disabled={openingSnap || remainingSeconds <= 0}
                          onClick={() =>
                            handleLaunchMidtransSnap(activeCheckoutOrder)
                          }
                          className="btn-ui btn-fajar w-full justify-center py-3 text-sm disabled:opacity-45"
                        >
                          <i
                            className="bi bi-qr-code-scan"
                            aria-hidden="true"
                          />
                          <span>
                            {openingSnap
                              ? t("openingSnapBusy")
                              : t("payWithSnapBtn")}
                          </span>
                        </button>

                        {activeCheckoutOrder.snapRedirectUrl ? (
                          <a
                            href={activeCheckoutOrder.snapRedirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ui btn-glass w-full justify-center text-xs"
                          >
                            <i
                              className="bi bi-box-arrow-up-right"
                              aria-hidden="true"
                            />
                            <span>{t("openRedirectSnapLink")}</span>
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-fajar/40 bg-hutan p-4 text-xs text-kabut/90 space-y-1.5">
                        <p className="font-bold text-fajar">
                          <i
                            className="bi bi-info-circle-fill mr-1.5"
                            aria-hidden="true"
                          />
                          {t("midtransUnconfiguredTitle")}
                        </p>
                        <p className="leading-relaxed text-kabut/80">
                          {t("midtransUnconfiguredDesc")}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="step2-refresh-status-btn"
                      disabled={refreshingOrder}
                      onClick={() =>
                        void checkSingleOrderStatus(
                          activeCheckoutOrder.id,
                          true
                        )
                      }
                      className="btn-ui btn-glass w-full justify-center text-xs"
                    >
                      <i
                        className={cn(
                          "bi bi-arrow-clockwise",
                          refreshingOrder && "animate-spin"
                        )}
                        aria-hidden="true"
                      />
                      <span>
                        {refreshingOrder
                          ? t("refreshingStatusBusy")
                          : t("refreshStatusBtn")}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="step2-cancel-order-btn"
                      disabled={cancellingId === activeCheckoutOrder.id}
                      onClick={() =>
                        void handleCancelOrder(activeCheckoutOrder.id)
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/45 bg-red-950/50 px-4 py-2.5 text-xs font-bold text-red-200 transition-colors hover:bg-red-950 disabled:opacity-45"
                    >
                      <i className="bi bi-x-circle" aria-hidden="true" />
                      <span>
                        {cancellingId === activeCheckoutOrder.id
                          ? t("cancellingOrderBusy")
                          : t("cancelOrderBtn")}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* POS 3: E-TICKET RESMI TERBIT */}
            {wizardStep === 3 && activeCheckoutOrder ? (
              <motion.div
                key="wizard-step-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-6 space-y-6"
              >
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-telaga-400/50 bg-telaga-950/60 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-heading text-xl font-bold text-kabut">
                      <i
                        className="bi bi-patch-check-fill mr-2 text-fajar"
                        aria-hidden="true"
                      />
                      {t("step3Heading")}
                    </h3>
                    <p className="mt-1 text-xs text-kabut/85 sm:text-sm">
                      {t("step3Subheading")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => selectTab("wallet")}
                      className="btn-ui btn-fajar"
                    >
                      <i className="bi bi-qr-code" aria-hidden="true" />
                      <span>{t("openFullWalletBtn")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCheckoutOrder(null);
                        setWizardStep(1);
                      }}
                      className="btn-ui btn-glass"
                    >
                      <i className="bi bi-plus-circle" aria-hidden="true" />
                      <span>{t("bookAnotherBtn")}</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {activeCheckoutOrder.tickets.map((tk) => (
                    <PerforatedTicketCard
                      key={tk.id}
                      ticket={tk}
                      locale={locale}
                      isOffline={isOffline}
                      onWriteReview={setReviewModalTicket}
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}

      {/* TAB 3: DOMPET TIKET (DENGAN DUKUNGAN CACHE LURING) */}
      {activeTab === "wallet" ? (
        <section className="space-y-5">
          <div className="surface-solid-dark p-5 sm:p-6">
            <h2 className="font-heading text-xl font-bold text-kabut sm:text-2xl">
              {t("walletHeading")}
            </h2>
            <p className="mt-1 text-xs text-kabut/80 sm:text-sm">
              {t("walletSubheading")}
            </p>

            {isOffline ? (
              <div className="mt-4 rounded-xl border border-fajar/50 bg-obsidian/90 p-3.5 text-xs text-kabut">
                <p className="font-bold text-fajar">
                  <i className="bi bi-wifi-off mr-1.5" aria-hidden="true" />
                  {t("offlineBannerTitle")}
                </p>
                {cachedSavedAtIso ? (
                  <p className="mt-1 text-kabut/80">
                    {t("offlineBannerDesc", {
                      time: formatTimestampWib(
                        new Date(cachedSavedAtIso),
                        locale
                      ),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {walletTickets.length === 0 ? (
            <div className="surface-solid-dark flex flex-col items-center justify-center p-10 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-obsidian text-fajar">
                <i
                  className="bi bi-ticket-perforated text-2xl"
                  aria-hidden="true"
                />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold text-kabut">
                {t("emptyWalletTitle")}
              </h3>
              <p className="mt-1 max-w-md text-xs text-kabut/75 sm:text-sm">
                {t("emptyWalletDesc")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setWizardStep(1);
                  setActiveCheckoutOrder(null);
                  selectTab("buy");
                }}
                className="btn-ui btn-fajar mt-5"
              >
                <i className="bi bi-bag-plus-fill" aria-hidden="true" />
                <span>{t("tabBuy")}</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {walletTickets.map((tk) => (
                <PerforatedTicketCard
                  key={tk.id}
                  ticket={tk}
                  locale={locale}
                  isOffline={isOffline}
                  onWriteReview={setReviewModalTicket}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 4: RIWAYAT PESANAN */}
      {activeTab === "orders" ? (
        <section className="surface-solid-dark p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-kabut">
              {t("ordersHeading")}
            </h2>
            <p className="mt-1 text-xs text-kabut/80">{t("ordersSubheading")}</p>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-kabut/15 bg-obsidian/65 p-8 text-center text-sm text-kabut/75">
              {t("ordersEmpty")}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const badge = formatOrderStatusLabel(order.status);
                const canResume =
                  order.status === OrderStatus.PENDING && !order.effectiveExpired;
                return (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-kabut/15 bg-obsidian/75 p-4 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-kabut">
                          {order.orderNumber}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <p className="text-xs text-kabut/80">
                        {formatVisitDateDisplay(order.visitDateYmd, locale)} ·{" "}
                        {order.items
                          .map((i) => `${i.productName} (${i.qty})`)
                          .join(", ")}
                      </p>
                      <p className="font-heading text-base font-extrabold text-fajar">
                        {formatRupiah(order.totalAmount, locale)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canResume ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResumePendingOrder(order)}
                            className="btn-ui btn-fajar text-xs"
                          >
                            <i
                              className="bi bi-credit-card-2-front-fill"
                              aria-hidden="true"
                            />
                            <span>{t("resumePaymentBtn")}</span>
                          </button>
                          <button
                            type="button"
                            disabled={cancellingId === order.id}
                            onClick={() => void handleCancelOrder(order.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/40 bg-red-950/50 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-950 disabled:opacity-40"
                          >
                            <i className="bi bi-x-circle" aria-hidden="true" />
                            <span>{t("cancelOrderBtn")}</span>
                          </button>
                        </>
                      ) : null}

                      {order.status === OrderStatus.PAID ? (
                        <>
                          <button
                            type="button"
                            onClick={() => selectTab("wallet")}
                            className="btn-ui btn-glass text-xs"
                          >
                            <i className="bi bi-qr-code" aria-hidden="true" />
                            <span>{t("viewIssuedTicketsBtn")}</span>
                          </button>

                          {!order.tickets.some(
                            (tk) => tk.acceptedScans && tk.acceptedScans.length > 0
                          ) && !order.latestRefundStatus ? (
                            <button
                              type="button"
                              data-testid={`refund-order-${order.orderNumber}`}
                              onClick={() => setRefundModalOrder(order)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/60 transition"
                            >
                              <i
                                className="bi bi-arrow-counterclockwise"
                                aria-hidden="true"
                              />
                              <span>{t("requestRefundBtn")}</span>
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 5: PROFIL & PRIVASI (UU PDP) */}
      {activeTab === "profile" && authCtx ? (
        <MemberProfileTab authCtx={authCtx} />
      ) : null}

      {/* MODAL ULASAN BERFOTO (FASE 7) */}
      {reviewModalTicket ? (
        <ReviewModal
          ticket={reviewModalTicket}
          isOpen={Boolean(reviewModalTicket)}
          onClose={() => setReviewModalTicket(null)}
          onSuccess={() => {
            router.refresh();
          }}
        />
      ) : null}

      {/* MODAL AJUKAN REFUND (FASE 7) */}
      {refundModalOrder ? (
        <RefundModal
          order={refundModalOrder}
          locale={locale}
          isOpen={Boolean(refundModalOrder)}
          onClose={() => setRefundModalOrder(null)}
          onSuccess={() => {
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

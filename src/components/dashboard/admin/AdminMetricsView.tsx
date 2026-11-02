"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/currency";
import type { AdminMetricsSnapshot, SalesPeriodMetric } from "@/server/admin/admin-metrics-service";

type AnalyticsPeriod = "daily" | "weekly" | "monthly" | "yearly";
type AnalyticsMetricType = "revenue" | "tickets";

export function AdminMetricsView() {
  const t = useTranslations("AdminDashboard");
  const [metrics, setMetrics] = useState<AdminMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter Grafik Interaktif Multi-Periode & Jenis Metrik
  const [period, setPeriod] = useState<AnalyticsPeriod>("daily");
  const [metricType, setMetricType] = useState<AnalyticsMetricType>("revenue");

  useEffect(() => {
    let ignore = false;
    async function loadMetrics() {
      try {
        const res = await fetch("/api/admin/metrics");
        if (!res.ok) throw new Error("Gagal memuat metrik.");
        const data = (await res.json()) as { metrics: AdminMetricsSnapshot };
        if (!ignore) setMetrics(data.metrics);
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat metrik.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadMetrics();
    return () => {
      ignore = true;
    };
  }, []);

  // Normalisasi data grafik untuk periode aktif
  const currentChartData = useMemo<SalesPeriodMetric[]>(() => {
    if (!metrics) return [];
    if (metrics.analytics && metrics.analytics[period]) {
      return metrics.analytics[period];
    }
    // Fallback kompatibel ke sales7Days jika analytics belum tersedia
    return metrics.sales7Days.map((s) => ({
      periodKey: s.date,
      label: s.date.slice(5),
      revenue: s.revenue,
      ticketsCount: s.ticketsCount,
      scansCount: 0,
    }));
  }, [metrics, period]);

  // Kalkulasi ringkasan KPI untuk periode dan metrik yang dipilih
  const summaryKpi = useMemo(() => {
    if (currentChartData.length === 0) {
      return { total: 0, average: 0, peakLabel: "-", peakValue: 0, totalScans: 0 };
    }

    let total = 0;
    let totalScans = 0;
    let peakValue = -1;
    let peakLabel = "-";

    for (const item of currentChartData) {
      const val = metricType === "revenue" ? item.revenue : item.ticketsCount;
      total += val;
      totalScans += item.scansCount;
      if (val > peakValue) {
        peakValue = val;
        peakLabel = item.label;
      }
    }

    const average = Math.round(total / currentChartData.length);
    return {
      total,
      average,
      peakLabel,
      peakValue: Math.max(0, peakValue),
      totalScans,
    };
  }, [currentChartData, metricType]);

  if (isLoading) {
    return (
      <div className="surface-solid-dark p-8 rounded-2xl flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-kabut/70">
          <i className="bi bi-arrow-repeat animate-spin text-2xl text-fajar" aria-hidden="true" />
          <span>{t("loadingMetrics")}</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="surface-solid-dark p-8 rounded-2xl text-center text-red-300">
        <i className="bi bi-exclamation-triangle text-3xl mb-2" aria-hidden="true" />
        <p>{error ?? t("failedLoadMetrics")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-metrics-view">
      {/* 4 KARTU METRIK UTAMA (DESAIN KONTEMPORER LUXURY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kartu 1: Total Pendapatan */}
        <div className="relative overflow-hidden surface-solid-dark p-6 rounded-3xl border border-telaga-700/60 shadow-xl bg-gradient-to-br from-fajar/10 via-obsidian/90 to-obsidian before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-fajar before:to-amber-500 hover:border-fajar/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider block">
                {t("metricTotalRevenue")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-heading font-extrabold text-fajar">
                {formatRupiah(metrics.totalRevenue)}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fajar/15 border border-fajar/30 text-fajar shadow-inner">
              <i className="bi bi-cash-stack text-lg" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-kabut/65">
            <i className="bi bi-shield-check text-telaga-400 text-[11px]" aria-hidden="true" />
            <span>{t("metricRevenueDesc")}</span>
          </div>
        </div>

        {/* Kartu 2: Pesanan Terbayar */}
        <div className="relative overflow-hidden surface-solid-dark p-6 rounded-3xl border border-telaga-700/60 shadow-xl bg-gradient-to-br from-telaga-950/60 via-obsidian/90 to-obsidian before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-telaga-400 before:to-emerald-500 hover:border-telaga-400/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider block">
                {t("metricPaidOrders")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-heading font-extrabold text-kabut">
                {metrics.paidOrdersCount.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-telaga-900 border border-telaga-700/60 text-telaga-300 shadow-inner">
              <i className="bi bi-receipt text-lg" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-kabut/65">
            <i className="bi bi-check2-circle text-telaga-400 text-[11px]" aria-hidden="true" />
            <span>{t("metricPaidOrdersDesc")}</span>
          </div>
        </div>

        {/* Kartu 3: Tiket Valid */}
        <div className="relative overflow-hidden surface-solid-dark p-6 rounded-3xl border border-telaga-700/60 shadow-xl bg-gradient-to-br from-cyan-950/40 via-obsidian/90 to-obsidian before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-cyan-400 before:to-blue-500 hover:border-cyan-400/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider block">
                {t("metricValidTickets")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-heading font-extrabold text-cyan-200">
                {metrics.validTicketsCount.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-950 border border-cyan-700/50 text-cyan-300 shadow-inner">
              <i className="bi bi-ticket-perforated text-lg" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-kabut/65">
            <i className="bi bi-qr-code text-cyan-400 text-[11px]" aria-hidden="true" />
            <span>{t("metricValidTicketsDesc")}</span>
          </div>
        </div>

        {/* Kartu 4: Pemindaian Hari Ini */}
        <div className="relative overflow-hidden surface-solid-dark p-6 rounded-3xl border border-telaga-700/60 shadow-xl bg-gradient-to-br from-emerald-950/50 via-obsidian/90 to-obsidian before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:to-telaga-300 hover:border-emerald-400/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider block">
                {t("metricScansToday")}
              </span>
              <p className="mt-2 text-2xl sm:text-3xl font-heading font-extrabold text-emerald-300">
                {metrics.scansTodayCount.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-700/50 text-emerald-300 shadow-inner">
              <i className="bi bi-qr-code-scan text-lg" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-kabut/65">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>{t("metricScansTodayDesc")}</span>
          </div>
        </div>
      </div>

      {/* GRAFIK MULTI-PERIODE & OKUPANSI GERBANG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Grafik Multi-Periode Interaktif */}
        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 lg:col-span-2 space-y-5">
          {/* Header Grafik & Kontrol Filter */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-telaga-800/60 pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-kabut flex items-center gap-2">
                <i className="bi bi-graph-up-arrow text-fajar" aria-hidden="true" />
                <span>{t("analyticsChartTitle")}</span>
              </h2>
              <p className="text-xs text-kabut/70 mt-0.5">{t("analyticsChartSubtitle")}</p>
            </div>

            {/* Toggle Jenis Metrik: Pendapatan vs Tiket */}
            <div className="flex items-center rounded-xl bg-obsidian p-1 border border-telaga-700/50 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMetricType("revenue")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  metricType === "revenue"
                    ? "bg-fajar text-obsidian shadow-sm font-bold"
                    : "text-kabut/70 hover:text-kabut"
                }`}
              >
                <i className="bi bi-cash-stack" aria-hidden="true" />
                <span>{t("metricRevenueToggle")}</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricType("tickets")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  metricType === "tickets"
                    ? "bg-emerald-500 text-obsidian shadow-sm font-bold"
                    : "text-kabut/70 hover:text-kabut"
                }`}
              >
                <i className="bi bi-ticket-perforated" aria-hidden="true" />
                <span>{t("metricTicketsToggle")}</span>
              </button>
            </div>
          </div>

          {/* Tab Pilihan Periode: Harian, Mingguan, Bulanan, Tahunan */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "daily", label: t("chartPeriodDaily") },
                { key: "weekly", label: t("chartPeriodWeekly") },
                { key: "monthly", label: t("chartPeriodMonthly") },
                { key: "yearly", label: t("chartPeriodYearly") },
              ] as const
            ).map((p) => {
              const isActive = period === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition border ${
                    isActive
                      ? "bg-telaga-700/80 border-telaga-500 text-kabut shadow"
                      : "bg-obsidian/60 border-telaga-800 text-kabut/60 hover:text-kabut hover:border-telaga-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Ringkasan Indikator KPI Periode Terpilih */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-obsidian/70 border border-telaga-800/60 p-3">
              <span className="text-[11px] font-semibold text-kabut/60 uppercase block">
                {t("totalSelectedPeriod")}
              </span>
              <p className="mt-1 text-base sm:text-lg font-heading font-bold text-kabut">
                {metricType === "revenue"
                  ? formatRupiah(summaryKpi.total)
                  : `${summaryKpi.total.toLocaleString("id-ID")} Tiket`}
              </p>
            </div>

            <div className="rounded-xl bg-obsidian/70 border border-telaga-800/60 p-3">
              <span className="text-[11px] font-semibold text-kabut/60 uppercase block">
                {t("avgPerPeriod")}
              </span>
              <p className="mt-1 text-base sm:text-lg font-heading font-bold text-telaga-300">
                {metricType === "revenue"
                  ? formatRupiah(summaryKpi.average)
                  : `${summaryKpi.average.toLocaleString("id-ID")} / titik`}
              </p>
            </div>

            <div className="rounded-xl bg-obsidian/70 border border-telaga-800/60 p-3">
              <span className="text-[11px] font-semibold text-kabut/60 uppercase block">
                {t("peakPeriod")}
              </span>
              <p className="mt-1 text-base sm:text-lg font-heading font-bold text-fajar truncate">
                {summaryKpi.peakLabel}:{" "}
                <span className="text-sm">
                  {metricType === "revenue"
                    ? formatRupiah(summaryKpi.peakValue)
                    : `${summaryKpi.peakValue.toLocaleString("id-ID")} Tiket`}
                </span>
              </p>
            </div>
          </div>

          {/* Kanvas Grafik Area */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={currentChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="metricRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="metricTicketsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#134e4a" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickMargin={8}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val: number) => {
                    if (metricType === "revenue") {
                      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}Jt`;
                      if (val >= 1_000) return `${(val / 1_000).toFixed(0)}Rb`;
                      return String(val);
                    }
                    return String(val);
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#081c15",
                    borderColor: "#115e59",
                    borderRadius: "0.75rem",
                    color: "#f8fafc",
                    fontSize: "0.75rem",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                  }}
                  formatter={(val: unknown) => [
                    metricType === "revenue"
                      ? formatRupiah(Number(val ?? 0))
                      : `${Number(val ?? 0).toLocaleString("id-ID")} Tiket`,
                    metricType === "revenue"
                      ? t("metricTotalRevenue")
                      : t("metricValidTickets"),
                  ]}
                  labelFormatter={(lbl: unknown) => `Periode: ${String(lbl ?? "")}`}
                />
                <Area
                  type="monotone"
                  dataKey={metricType === "revenue" ? "revenue" : "ticketsCount"}
                  stroke={metricType === "revenue" ? "#d97706" : "#10b981"}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={
                    metricType === "revenue"
                      ? "url(#metricRevenueGrad)"
                      : "url(#metricTicketsGrad)"
                  }
                  activeDot={{
                    r: 6,
                    fill: metricType === "revenue" ? "#f59e0b" : "#34d399",
                    stroke: "#081c15",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Okupansi Gerbang Hari Ini */}
        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6">
          <div>
            <h2 className="font-heading text-lg font-bold text-kabut">
              {t("gateOccupancyTitle")}
            </h2>
            <p className="text-xs text-kabut/70">{t("gateOccupancySubtitle")}</p>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-semibold text-kabut mb-1.5">
                <span>{t("gateBatuLawang")}</span>
                <span className="text-fajar font-bold">
                  {metrics.scansByGate.GERBANG_BATU_LAWANG} {t("scanUnit")}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-obsidian overflow-hidden border border-telaga-700">
                <div
                  className="h-full bg-fajar transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (metrics.scansByGate.GERBANG_BATU_LAWANG / 500) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-kabut mb-1.5">
                <span>{t("gateGunungBendera")}</span>
                <span className="text-telaga-300 font-bold">
                  {metrics.scansByGate.PINTU_GUNUNG_BENDERA} {t("scanUnit")}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-obsidian overflow-hidden border border-telaga-700">
                <div
                  className="h-full bg-telaga-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (metrics.scansByGate.PINTU_GUNUNG_BENDERA / 500) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-telaga-700/50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-kabut/70">{t("pendingRefunds")}</span>
              <span className="font-bold text-fajar">{metrics.pendingRefundsCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-kabut/70">{t("unmoderatedReviews")}</span>
              <span className="font-bold text-amber-300">{metrics.pendingReviewsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABEL TRANSAKSI TERBARU */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-4">
        <h2 className="font-heading text-lg font-bold text-kabut">
          {t("recentOrdersTitle")}
        </h2>

        {metrics.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-kabut/60">
            {t("noOrdersYet")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">{t("thOrderNumber")}</th>
                  <th className="pb-3 font-semibold">{t("thVisitor")}</th>
                  <th className="pb-3 font-semibold">{t("thVisitDate")}</th>
                  <th className="pb-3 font-semibold">{t("thTotal")}</th>
                  <th className="pb-3 font-semibold">{t("thStatus")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut">
                {metrics.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-obsidian/40 transition">
                    <td className="py-3 font-mono font-bold text-fajar">{o.orderNumber}</td>
                    <td className="py-3">
                      <div className="font-semibold">{o.visitorName}</div>
                      <div className="text-[11px] text-kabut/60">{o.visitorWhatsapp}</div>
                    </td>
                    <td className="py-3">{o.visitDate}</td>
                    <td className="py-3 font-semibold">{formatRupiah(o.totalAmount)}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === "PAID"
                            ? "bg-green-950/80 text-green-300 border border-green-700/50"
                            : o.status === "PENDING"
                            ? "bg-amber-950/80 text-amber-300 border border-amber-700/50"
                            : "bg-red-950/80 text-red-300 border border-red-700/50"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

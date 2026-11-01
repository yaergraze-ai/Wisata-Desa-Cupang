"use client";

import { useEffect, useState } from "react";
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
import type { AdminMetricsSnapshot } from "@/server/admin/admin-metrics-service";

export function AdminMetricsView() {
  const t = useTranslations("AdminDashboard");
  const [metrics, setMetrics] = useState<AdminMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      {/* 4 KARTU METRIK UTAMA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 relative overflow-hidden">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("metricTotalRevenue")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-fajar">
            {formatRupiah(metrics.totalRevenue)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-kabut/60">
            <i className="bi bi-cash-stack text-telaga-400" aria-hidden="true" />
            <span>{t("metricRevenueDesc")}</span>
          </div>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 relative overflow-hidden">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("metricPaidOrders")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-kabut">
            {metrics.paidOrdersCount.toLocaleString("id-ID")}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-kabut/60">
            <i className="bi bi-receipt text-telaga-400" aria-hidden="true" />
            <span>{t("metricPaidOrdersDesc")}</span>
          </div>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 relative overflow-hidden">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("metricValidTickets")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-kabut">
            {metrics.validTicketsCount.toLocaleString("id-ID")}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-kabut/60">
            <i className="bi bi-ticket-perforated text-telaga-400" aria-hidden="true" />
            <span>{t("metricValidTicketsDesc")}</span>
          </div>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 relative overflow-hidden">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("metricScansToday")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-telaga-300">
            {metrics.scansTodayCount.toLocaleString("id-ID")}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-kabut/60">
            <i className="bi bi-qr-code-scan text-fajar" aria-hidden="true" />
            <span>{t("metricScansTodayDesc")}</span>
          </div>
        </div>
      </div>

      {/* GRAFIK PENJUALAN & OKUPANSI GERBANG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Tren Penjualan 7 Hari */}
        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-kabut">
                {t("salesTrendTitle")}
              </h2>
              <p className="text-xs text-kabut/70">{t("salesTrendSubtitle")}</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-obsidian border border-telaga-700 text-kabut/80">
              {t("badgeLast7Days")}
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.sales7Days} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#134e4a" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#081c15",
                    borderColor: "#115e59",
                    borderRadius: "0.75rem",
                    color: "#f8fafc",
                    fontSize: "0.75rem",
                  }}
                  formatter={(val: unknown) => [
                    formatRupiah(Number(val ?? 0)),
                    t("metricTotalRevenue"),
                  ]}
                  labelFormatter={(lbl: unknown) => `${t("datePrefix")}: ${String(lbl ?? "")}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
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

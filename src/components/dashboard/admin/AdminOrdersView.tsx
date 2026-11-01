"use client";

import { useEffect, useState } from "react";
import { OrderStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { formatRupiah } from "@/lib/currency";
import type { SerializedAdminOrder } from "@/server/admin/admin-orders-service";

export function AdminOrdersView() {
  const t = useTranslations("AdminDashboard");
  const [orders, setOrders] = useState<SerializedAdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Modal inspection
  const [inspectOrder, setInspectOrder] = useState<SerializedAdminOrder | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  async function fetchOrders(currentPage = 1, status = statusFilter, query = search) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("limit", "15");
      if (status !== "ALL") params.set("status", status);
      if (query.trim()) params.set("search", query.trim());

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat pesanan.");
      const data = (await res.json()) as {
        orders: SerializedAdminOrder[];
        total: number;
        page: number;
        totalPages: number;
      };
      setOrders(data.orders);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat pesanan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "15");
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) throw new Error("Gagal memuat pesanan.");
        const data = (await res.json()) as {
          orders: SerializedAdminOrder[];
          total: number;
          page: number;
          totalPages: number;
        };
        if (!ignore) {
          setOrders(data.orders);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat pesanan.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: search.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Gagal mengekspor CSV.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pesanan-wisata-cirebon-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal ekspor CSV.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm(t("confirmCancelOrder"))) return;
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Dibatalkan manual oleh Administrator" }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal membatalkan pesanan.");
      }
      await fetchOrders(page, statusFilter, search);
      setInspectOrder(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal membatalkan pesanan.");
    } finally {
      setCancellingOrderId(null);
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-orders-view">
      {/* FILTER BAR & ACTION EXPORT */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchOrders(1, statusFilter, search);
            }}
            className="w-full sm:w-64 rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-xs text-kabut placeholder:text-kabut/40"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-xs text-kabut"
          >
            <option value="ALL">{t("allStatus")}</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="REFUND_REQUESTED">REFUND_REQUESTED</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            type="button"
            onClick={() => fetchOrders(1, statusFilter, search)}
            className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut hover:bg-obsidian/70"
          >
            <i className="bi bi-search mr-1.5" aria-hidden="true" />
            <span>{t("filterSearchBtn")}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-kabut/60">
            {t("totalRecords", { count: total })}
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {isExporting ? (
              <i className="bi bi-arrow-repeat animate-spin mr-1.5" aria-hidden="true" />
            ) : (
              <i className="bi bi-file-earmark-spreadsheet mr-1.5" aria-hidden="true" />
            )}
            <span>{t("exportCsvBtn")}</span>
          </button>
        </div>
      </div>

      {/* TABEL PESANAN */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
            <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
            <span>{t("loadingOrders")}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-300">{error}</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-kabut/60">{t("noOrdersFound")}</div>
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
                  <th className="pb-3 font-semibold">{t("thTickets")}</th>
                  <th className="pb-3 text-right font-semibold">{t("thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut">
                {orders.map((o) => (
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
                            : o.status === "REFUND_REQUESTED"
                            ? "bg-purple-950/80 text-purple-300 border border-purple-700/50"
                            : "bg-red-950/80 text-red-300 border border-red-700/50"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono">{o.ticketsCount} {t("ticketsUnit")}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectOrder(o)}
                        className="rounded-lg bg-obsidian border border-telaga-700 px-3 py-1 text-[11px] font-semibold text-kabut hover:bg-obsidian/70 transition"
                      >
                        {t("detailBtn")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINASI */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-4 border-t border-telaga-700/40 text-xs">
            <span className="text-kabut/60">
              {t("pageCounter", { page, totalPages })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => fetchOrders(page - 1, statusFilter, search)}
                className="rounded-lg bg-obsidian border border-telaga-700 px-3 py-1 text-kabut disabled:opacity-40"
              >
                {t("prevPageBtn")}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => fetchOrders(page + 1, statusFilter, search)}
                className="rounded-lg bg-obsidian border border-telaga-700 px-3 py-1 text-kabut disabled:opacity-40"
              >
                {t("nextPageBtn")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* MODAL INSPEKSI PESANAN */}
      {inspectOrder ? (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="order-inspect-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-hutan border border-telaga-700/60 p-6 sm:p-7 shadow-2xl text-kabut space-y-6">
            <div className="flex items-start justify-between border-b border-telaga-700/60 pb-4">
              <div>
                <span className="text-xs font-semibold text-fajar uppercase tracking-wider block">
                  {t("orderDetailHeading")}
                </span>
                <h3 className="text-xl font-heading font-bold text-kabut">
                  {inspectOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="rounded-lg p-1 text-kabut/60 hover:text-kabut"
              >
                <i className="bi bi-x-lg text-lg" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-kabut/60 block">{t("thVisitor")}</span>
                <span className="font-semibold text-kabut">{inspectOrder.visitorName}</span>
              </div>
              <div>
                <span className="text-kabut/60 block">{t("thWhatsapp")}</span>
                <span className="font-semibold text-kabut">{inspectOrder.visitorWhatsapp}</span>
              </div>
              <div>
                <span className="text-kabut/60 block">{t("thVisitDate")}</span>
                <span className="font-semibold text-kabut">{inspectOrder.visitDate}</span>
              </div>
              <div>
                <span className="text-kabut/60 block">{t("thTotal")}</span>
                <span className="font-semibold text-fajar font-mono">
                  {formatRupiah(inspectOrder.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-kabut/60 block">{t("thStatus")}</span>
                <span className="font-bold">{inspectOrder.status}</span>
              </div>
              <div>
                <span className="text-kabut/60 block">{t("thCreatedAt")}</span>
                <span className="text-kabut/80">{inspectOrder.createdAt.slice(0, 16)}</span>
              </div>
            </div>

            {/* DAFTAR TIKET TERBIT */}
            <div className="space-y-3">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-kabut/80">
                {t("ticketsInOrder", { count: inspectOrder.tickets.length })}
              </h4>
              <div className="space-y-2">
                {inspectOrder.tickets.map((tItem) => (
                  <div
                    key={tItem.id}
                    className="p-3.5 rounded-xl bg-obsidian/70 border border-telaga-700/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-fajar">
                        {tItem.publicCode}
                      </div>
                      <div className="text-kabut/70 mt-0.5">{tItem.productName}</div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-telaga-800 text-telaga-200">
                        {tItem.status}
                      </span>
                      <div className="text-[11px] text-kabut/60 mt-1">
                        {t("scansRecorded", { count: tItem.scansCount })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AKSI BATAL BILA STATUS PENDING */}
            <div className="pt-4 border-t border-telaga-700/60 flex items-center justify-between">
              {inspectOrder.status === OrderStatus.PENDING ? (
                <button
                  type="button"
                  disabled={cancellingOrderId === inspectOrder.id}
                  onClick={() => handleCancelOrder(inspectOrder.id)}
                  className="rounded-xl border border-red-700/60 bg-red-950/60 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-900 transition disabled:opacity-50"
                >
                  {cancellingOrderId === inspectOrder.id ? (
                    <i className="bi bi-arrow-repeat animate-spin mr-1.5" aria-hidden="true" />
                  ) : (
                    <i className="bi bi-x-circle mr-1.5" aria-hidden="true" />
                  )}
                  <span>{t("cancelPendingOrderBtn")}</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-5 py-2 text-xs font-semibold text-kabut"
              >
                {t("closeModalBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

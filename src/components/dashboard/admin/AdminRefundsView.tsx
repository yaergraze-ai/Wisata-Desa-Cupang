"use client";

import { useEffect, useState } from "react";
import { RefundStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { formatRupiah } from "@/lib/currency";

export interface AdminRefundItemDto {
  id: string;
  orderId: string;
  orderNumber: string;
  visitorName: string;
  visitorWhatsapp: string;
  visitDate: string;
  totalAmount: number;
  reason: string;
  notes: string | null;
  status: RefundStatus;
  createdAt: string;
}

export function AdminRefundsView() {
  const t = useTranslations("AdminDashboard");
  const [requests, setRequests] = useState<AdminRefundItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal keputusan refund
  const [activeRequest, setActiveRequest] = useState<AdminRefundItemDto | null>(null);
  const [decisionType, setDecisionType] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRefunds() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/refunds");
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errJson?.error || `Gagal memuat antrean refund (${res.status}).`);
      }
      const data = (await res.json()) as { requests: AdminRefundItemDto[] };
      setRequests(data.requests ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat antrean refund.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/refunds");
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errJson?.error || `Gagal memuat antrean refund (${res.status}).`);
        }
        const data = (await res.json()) as { requests: AdminRefundItemDto[] };
        if (!ignore) {
          setRequests(data.requests ?? []);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat antrean refund.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleDecideRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRequest) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/refunds/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundRequestId: activeRequest.id,
          decision: decisionType,
          decisionNotes: decisionNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal memproses keputusan refund.");
      }
      setActiveRequest(null);
      setDecisionNotes("");
      await loadRefunds();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal memproses refund.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="surface-solid-dark p-4 sm:p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="admin-refunds-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut sm:text-xl">
            {t("refundsQueueTitle")}
          </h2>
          <p className="text-xs text-kabut/70 mt-0.5">{t("refundsQueueSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={loadRefunds}
          className="btn-ui self-start sm:self-auto rounded-xl bg-obsidian border border-telaga-700 px-3.5 py-2 text-xs text-kabut hover:border-fajar/60 transition"
        >
          <i className="bi bi-arrow-clockwise mr-1.5" aria-hidden="true" />
          <span>{t("filterSearchBtn")}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingRefunds")}</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-300 bg-red-950/20 rounded-xl border border-red-900/40">{error}</div>
      ) : requests.length === 0 ? (
        <div className="p-8 text-center text-kabut/60 rounded-xl border border-telaga-700/30 bg-obsidian/30">{t("noRefundRequests")}</div>
      ) : (
        <>
          {/* MOBILE CARD VIEW (< md) */}
          <div className="block md:hidden space-y-3.5">
            {requests.map((r) => {
              const waDigits = r.visitorWhatsapp.replace(/\D/g, "");
              const waUrl = waDigits ? `https://wa.me/${waDigits.startsWith("0") ? "62" + waDigits.slice(1) : waDigits}` : null;
              return (
                <article
                  key={r.id}
                  className="surface-solid-dark rounded-xl border border-telaga-700/50 p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-telaga-700/30 pb-2.5">
                    <span className="font-mono text-xs font-bold text-fajar tracking-wide">
                      {r.orderNumber}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === "PENDING"
                          ? "bg-amber-950/80 text-amber-300 border border-amber-600/50"
                          : r.status === "APPROVED"
                          ? "bg-green-950/80 text-green-300 border border-green-600/50"
                          : "bg-red-950/80 text-red-300 border border-red-600/50"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-kabut text-sm">{r.visitorName}</p>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:underline mt-0.5"
                          >
                            <i className="bi bi-whatsapp text-xs" aria-hidden="true" />
                            <span>{r.visitorWhatsapp}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-kabut/60">{r.visitorWhatsapp}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-kabut/60 block">{t("thTotal")}</span>
                        <span className="font-mono font-bold text-fajar text-sm">
                          {formatRupiah(r.totalAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-kabut/75 pt-1">
                      <i className="bi bi-calendar3 text-fajar/80" aria-hidden="true" />
                      <span>{t("thVisitDate")}: <strong className="text-kabut">{r.visitDate}</strong></span>
                    </div>

                    <div className="rounded-lg bg-obsidian/70 border border-telaga-700/40 p-2.5 mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-kabut/60">
                        {t("refundReasonLabel")}
                      </p>
                      <p className="text-xs text-kabut mt-0.5 font-medium leading-relaxed">
                        {r.reason}
                      </p>
                      {r.notes ? (
                        <p className="text-[11px] text-kabut/70 italic mt-1 border-t border-telaga-700/30 pt-1">
                          {r.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {r.status === "PENDING" ? (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-telaga-700/30">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRequest(r);
                          setDecisionType("APPROVE");
                          setDecisionNotes("");
                        }}
                        className="btn-ui rounded-xl bg-green-900/60 border border-green-600/70 py-2.5 px-3 text-xs font-bold text-green-200 hover:bg-green-800 transition justify-center"
                      >
                        <i className="bi bi-check-circle mr-1" aria-hidden="true" />
                        <span>{t("approveRefundBtn")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRequest(r);
                          setDecisionType("REJECT");
                          setDecisionNotes("");
                        }}
                        className="btn-ui rounded-xl bg-red-900/60 border border-red-600/70 py-2.5 px-3 text-xs font-bold text-red-200 hover:bg-red-800 transition justify-center"
                      >
                        <i className="bi bi-x-circle mr-1" aria-hidden="true" />
                        <span>{t("rejectRefundBtn")}</span>
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {/* DESKTOP TABLE VIEW (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">{t("thOrderNumber")}</th>
                  <th className="pb-3 font-semibold">{t("thVisitor")}</th>
                  <th className="pb-3 font-semibold">{t("thVisitDate")}</th>
                  <th className="pb-3 font-semibold">{t("refundReasonLabel")}</th>
                  <th className="pb-3 font-semibold">{t("thTotal")}</th>
                  <th className="pb-3 font-semibold">{t("thStatus")}</th>
                  <th className="pb-3 text-right font-semibold">{t("thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-obsidian/40 transition">
                    <td className="py-3 font-mono font-bold text-fajar">{r.orderNumber}</td>
                    <td className="py-3">
                      <div className="font-semibold">{r.visitorName}</div>
                      <div className="text-[11px] text-kabut/60">{r.visitorWhatsapp}</div>
                    </td>
                    <td className="py-3">{r.visitDate}</td>
                    <td className="py-3 max-w-[200px]">
                      <div className="font-medium truncate">{r.reason}</div>
                      {r.notes ? (
                        <div className="text-[11px] text-kabut/60 truncate">{r.notes}</div>
                      ) : null}
                    </td>
                    <td className="py-3 font-semibold font-mono text-fajar">
                      {formatRupiah(r.totalAmount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "PENDING"
                            ? "bg-amber-950 text-amber-300 border border-amber-700/60"
                            : r.status === "APPROVED"
                            ? "bg-green-950 text-green-300 border border-green-700/60"
                            : "bg-red-950 text-red-300 border border-red-700/60"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {r.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRequest(r);
                              setDecisionType("APPROVE");
                              setDecisionNotes("");
                            }}
                            className="rounded-lg bg-green-900/60 border border-green-700/70 px-2.5 py-1 text-[11px] font-bold text-green-200 hover:bg-green-800 transition"
                          >
                            {t("approveRefundBtn")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRequest(r);
                              setDecisionType("REJECT");
                              setDecisionNotes("");
                            }}
                            className="rounded-lg bg-red-900/60 border border-red-700/70 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-800 transition"
                          >
                            {t("rejectRefundBtn")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-kabut/40 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL KEPUTUSAN REFUND */}
      {activeRequest ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-obsidian/80 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-hutan border border-telaga-700/60 p-4 sm:p-6 shadow-2xl text-kabut space-y-4">
            <h3 className="font-heading text-lg font-bold">
              {decisionType === "APPROVE" ? t("approvalHeading") : t("rejectionHeading")}
            </h3>
            <div className="p-3.5 rounded-xl bg-obsidian/70 border border-telaga-700/50 text-xs space-y-1">
              <div>
                {t("refundOrderNumberLabel")} <strong className="text-fajar font-mono">{activeRequest.orderNumber}</strong>
              </div>
              <div>{t("thVisitor")}: {activeRequest.visitorName}</div>
              <div>
                {t("refundAmountLabel")}{" "}
                <strong className="text-fajar font-mono">{formatRupiah(activeRequest.totalAmount)}</strong>
              </div>
            </div>

            <form onSubmit={handleDecideRefund} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-kabut mb-1">
                  {t("decisionNoteLabel")}
                </label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder={t("decisionNotePlaceholder")}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut placeholder:text-kabut/40"
                  required={decisionType === "REJECT"}
                />
              </div>

              {decisionType === "APPROVE" ? (
                <div className="p-3 rounded-xl bg-green-950/50 border border-green-700/50 text-[11px] text-green-200">
                  <i className="bi bi-info-circle mr-1.5" aria-hidden="true" />
                  {t("refundsQueueSubtitle")}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setActiveRequest(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`btn-ui rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 ${
                    decisionType === "APPROVE"
                      ? "btn-fajar"
                      : "bg-red-800 border border-red-600 text-white"
                  }`}
                >
                  {isSubmitting ? t("submittingDecisionBtn") : t("confirmDecisionBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

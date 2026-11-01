"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatRupiah } from "@/lib/currency";
import type { AppLocale } from "@/i18n/routing";
import type { SerializedOrderSummary } from "@/server/orders/order-service";

export interface RefundModalProps {
  order: SerializedOrderSummary;
  locale: AppLocale;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundModal({
  order,
  locale,
  isOpen,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const t = useTranslations("MemberDashboard");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setErrorMessage("Alasan pengajuan refund minimal 10 karakter.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          reason: reason.trim(),
        }),
      });

      const payload = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error || "Gagal mengajukan refund.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengajukan refund."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
    >
      <div
        data-testid="refund-modal-content"
        className="relative w-full max-w-lg rounded-2xl bg-hutan border border-telaga-700/60 p-6 sm:p-7 shadow-2xl text-kabut space-y-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-300">
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
              <span>{t("requestRefundBtn")}</span>
            </span>
            <h3
              id="refund-modal-title"
              className="mt-2 font-heading text-xl font-bold sm:text-2xl"
            >
              {t("refundModalTitle")}
            </h3>
            <p className="mt-1 text-xs text-kabut/80">
              {order.orderNumber} • {formatRupiah(order.totalAmount, locale)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-kabut/70 hover:bg-obsidian/60 hover:text-kabut transition"
            aria-label={t("cancelModalBtn")}
          >
            <i className="bi bi-x-lg text-lg" aria-hidden="true" />
          </button>
        </div>

        {/* Kebijakan H-24 */}
        <div className="rounded-xl border border-telaga-700/60 bg-obsidian/60 p-3.5 text-xs text-kabut/85 space-y-1.5">
          <p className="font-semibold text-fajar flex items-center gap-1.5">
            <i className="bi bi-info-circle-fill" aria-hidden="true" />
            <span>{t("refundPolicyTitle")}</span>
          </p>
          <p className="leading-relaxed">
            {t("refundPolicyNotice", {
              hours: 24,
              visitDate: order.visitDateYmd,
            })}
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="refund-reason"
              className="block text-xs font-bold text-kabut/90"
            >
              {t("refundReasonLabel")}
            </label>
            <textarea
              id="refund-reason"
              data-testid="refund-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("refundReasonPlaceholder")}
              rows={3}
              required
              minLength={10}
              maxLength={1000}
              className="mt-1.5 w-full rounded-xl border border-telaga-700/80 bg-obsidian/70 p-3 text-sm text-kabut placeholder:text-kabut/40 focus:border-fajar focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-ui rounded-xl border border-telaga-700 bg-obsidian/80 px-4 py-2 text-xs font-semibold text-kabut hover:bg-obsidian transition"
            >
              {t("cancelModalBtn")}
            </button>
            <button
              type="submit"
              data-testid="refund-submit-button"
              disabled={isSubmitting || reason.trim().length < 10}
              className="btn-ui btn-fajar rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <i
                    className="bi bi-arrow-repeat animate-spin mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("refundSubmittingBtn")}</span>
                </>
              ) : (
                <>
                  <i
                    className="bi bi-arrow-counterclockwise mr-1.5"
                    aria-hidden="true"
                  />
                  <span>{t("refundSubmitBtn")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

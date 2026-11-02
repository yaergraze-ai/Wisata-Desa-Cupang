"use client";

import { GateType, TicketStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import {
  formatTimestampWib,
  formatVisitDateDisplay,
} from "@/lib/datetime-wib";
import { cn } from "@/lib/cn";
import type { SerializedWalletTicket } from "@/server/orders/order-service";

export interface PerforatedTicketCardProps {
  ticket: SerializedWalletTicket;
  locale: AppLocale;
  isOffline?: boolean;
  onWriteReview?: (ticket: SerializedWalletTicket) => void;
}

export function PerforatedTicketCard({
  ticket,
  locale,
  isOffline = false,
  onWriteReview,
}: PerforatedTicketCardProps) {
  const t = useTranslations("MemberDashboard");
  const isWhite = ticket.productCode === "TIKET_PUTIH";
  const isUsed = Boolean(ticket.displayUsed || ticket.acceptedScans.length > 0);

  const statusLabel =
    ticket.status === TicketStatus.CANCELLED
      ? t("ticketStatusCancelled")
      : ticket.status === TicketStatus.REFUNDED
        ? t("ticketStatusRefunded")
        : ticket.status === TicketStatus.EXPIRED
          ? t("ticketStatusExpired")
          : isUsed
            ? (t("ticketStatusUsed") || "Telah Digunakan & Diarsipkan")
            : t("ticketStatusActive");

  const statusBadgeClass =
    ticket.status !== TicketStatus.ACTIVE
      ? isWhite
        ? "bg-red-100 text-red-900 border-red-300"
        : "bg-red-950/80 text-red-200 border-red-500/40"
      : isUsed
        ? "bg-zinc-800 text-zinc-300 border-zinc-600 font-extrabold"
        : isWhite
          ? "bg-[#195E56] text-[#F6FAF8] border-[#195E56]"
          : "bg-telaga-950 text-telaga-200 border-telaga-400/50";

  const visitDateFormatted = formatVisitDateDisplay(
    ticket.visitDateYmd,
    locale
  );

  const shareText = t("shareWaTemplate", {
    product: ticket.productName,
    code: ticket.publicCode,
    date: visitDateFormatted,
    count: ticket.admitCount,
  });
  const waShareHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  function handleDownloadPngOfflineFallback(
    e: React.MouseEvent<HTMLAnchorElement>
  ) {
    if (!isOffline) return;
    e.preventDefault();
    const link = document.createElement("a");
    link.href = ticket.qrDataUrl;
    link.download = `qr-${ticket.publicCode}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <article
      data-testid={`wallet-ticket-${ticket.publicCode}`}
      className={cn(
        "relative overflow-hidden rounded-3xl border-2 shadow-xl transition-all",
        isUsed
          ? "border-zinc-700/80 bg-[#14161b] text-zinc-300 shadow-md"
          : isWhite
            ? "border-[#195E56] bg-[#F6FAF8] text-obsidian"
            : "border-telaga-500 bg-hutan text-kabut"
      )}
    >
      {/* Pita Tajuk Atas */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 sm:px-6",
          isUsed
            ? "bg-[#1c1f26] text-zinc-400 border-b border-zinc-700/60"
            : isWhite
              ? "bg-[#195E56] text-[#F6FAF8]"
              : "border-b border-kabut/15 bg-obsidian text-kabut"
        )}
      >
        <div className="flex items-center gap-2">
          <i
            className={cn(
              "bi text-base",
              isUsed
                ? "bi-archive-fill text-zinc-400"
                : isWhite
                  ? "bi-ticket-perforated-fill text-fajar"
                  : "bi-ticket-detailed text-fajar"
            )}
            aria-hidden="true"
          />
          <span className="font-heading text-xs font-extrabold tracking-wider uppercase">
            {isUsed
              ? `ARSIP: ${ticket.productName}`
              : isWhite
                ? t("cardWhiteType")
                : t("cardRegularType")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
              isUsed
                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                : isWhite
                  ? "bg-obsidian/25 text-[#F6FAF8]"
                  : "bg-hutan text-fajar border border-fajar/35"
            )}
          >
            <i className="bi bi-people-fill" aria-hidden="true" />
            <span>{t("admitCountBadge", { count: ticket.admitCount })}</span>
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide uppercase",
              statusBadgeClass
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Bagian Atas: Informasi Pemegang & Kunjungan */}
      <div className="grid gap-4 px-5 pt-5 pb-4 sm:grid-cols-2 sm:px-6">
        <div>
          <p
            className={cn(
              "text-[11px] font-bold tracking-wider uppercase",
              isUsed ? "text-zinc-500" : isWhite ? "text-[#195E56]" : "text-kabut/70"
            )}
          >
            {t("fieldTicketCode")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-extrabold tracking-tight">
            {ticket.publicCode}
          </p>
        </div>

        <div>
          <p
            className={cn(
              "text-[11px] font-bold tracking-wider uppercase",
              isUsed ? "text-zinc-500" : isWhite ? "text-[#195E56]" : "text-kabut/70"
            )}
          >
            {t("fieldVisitDate")}
          </p>
          <p
            className={cn(
              "mt-0.5 font-heading text-base font-bold",
              isUsed ? "text-zinc-300" : isWhite ? "text-obsidian" : "text-fajar"
            )}
          >
            {visitDateFormatted}
          </p>
        </div>

        <div>
          <p
            className={cn(
              "text-[11px] font-bold tracking-wider uppercase",
              isUsed ? "text-zinc-500" : isWhite ? "text-[#195E56]" : "text-kabut/70"
            )}
          >
            {t("fieldHolder")}
          </p>
          <p className="mt-0.5 text-sm font-semibold">{ticket.visitorName}</p>
          <p
            className={cn(
              "text-xs",
              isUsed ? "text-zinc-400" : isWhite ? "text-obsidian/75" : "text-kabut/75"
            )}
          >
            {ticket.visitorWhatsapp}
          </p>
        </div>

        <div>
          <p
            className={cn(
              "text-[11px] font-bold tracking-wider uppercase",
              isUsed ? "text-zinc-500" : isWhite ? "text-[#195E56]" : "text-kabut/70"
            )}
          >
            {t("fieldOrderNo")} / {t("fieldTariff")}
          </p>
          <p className="mt-0.5 font-mono text-xs font-bold">
            {ticket.orderNumber}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold",
              isUsed ? "text-zinc-400" : isWhite ? "text-[#195E56]" : "text-telaga-200"
            )}
          >
            {formatRupiah(ticket.subtotal, locale)} ({ticket.admitCount}×{" "}
            {formatRupiah(ticket.unitTotal, locale)})
          </p>
        </div>
      </div>

      {/* Garis Perforasi dengan Takik Lingkaran Kiri & Kanan */}
      <div className="relative flex items-center py-2" aria-hidden="true">
        <span className="-ml-3.5 h-7 w-7 shrink-0 rounded-full border-r-2 border-inherit bg-obsidian" />
        <div
          className={cn(
            "mx-2 w-full border-t-2 border-dashed",
            isUsed
              ? "border-zinc-700/60"
              : isWhite
                ? "border-[#195E56]/45"
                : "border-telaga-400/40"
          )}
        />
        <span className="-mr-3.5 h-7 w-7 shrink-0 rounded-full border-l-2 border-inherit bg-obsidian" />
      </div>

      {/* Bagian Bawah: QR Besar & Checklist Gerbang */}
      <div className="flex flex-col gap-5 px-5 pt-3 pb-6 sm:flex-row sm:items-center sm:px-6">
        <div className="relative mx-auto shrink-0 rounded-2xl border-2 border-zinc-700/60 bg-white p-3 shadow-sm sm:mx-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ticket.qrDataUrl}
            alt={`QR ${ticket.publicCode}`}
            width={168}
            height={168}
            className={cn(
              "h-40 w-40 sm:h-44 sm:w-44 transition-all",
              isUsed && "opacity-25 grayscale blur-[0.6px]"
            )}
          />

          {isUsed ? (
            <div className="absolute inset-0 flex items-center justify-center p-2 bg-black/40 backdrop-blur-[1px]">
              <div className="rounded-xl border-2 border-zinc-500 bg-zinc-950/90 px-3 py-1.5 text-center shadow-2xl -rotate-12">
                <span className="block text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                  ARSIP RESMI
                </span>
                <span className="block text-xs font-black tracking-wider text-zinc-100 uppercase">
                  TELAH TERPAKAI
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 space-y-3.5">
          <div>
            <p
              className={cn(
                "text-xs font-bold tracking-wider uppercase",
                isUsed ? "text-zinc-400" : isWhite ? "text-[#195E56]" : "text-fajar"
              )}
            >
              {t("gatesChecklistLabel")}
            </p>
            <ul className="mt-2 space-y-2">
              {ticket.allowedGates.map((gate) => {
                const scan = ticket.acceptedScans.find((s) => s.gate === gate);
                const gateTitle =
                  gate === GateType.GERBANG_BATU_LAWANG
                    ? t("gateBatuLawang")
                    : t("gateGunungBendera");

                return (
                  <li
                    key={gate}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs",
                      scan
                        ? isUsed
                          ? "border-zinc-700 bg-zinc-900/80 text-zinc-300"
                          : isWhite
                            ? "border-[#195E56] bg-[#195E56]/12 text-obsidian"
                            : "border-telaga-400/50 bg-obsidian/70 text-telaga-200"
                        : isWhite
                          ? "border-obsidian/15 bg-white text-obsidian"
                          : "border-kabut/15 bg-obsidian/45 text-kabut"
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <i
                        className={cn(
                          "bi",
                          scan
                            ? "bi-check-circle-fill text-zinc-400"
                            : "bi-qr-code-scan"
                        )}
                        aria-hidden="true"
                      />
                      <span>{gateTitle}</span>
                    </span>
                    <span className="font-semibold text-zinc-400">
                      {scan
                        ? t("gateScanned", {
                            time: formatTimestampWib(
                              new Date(scan.scannedAtIso),
                              locale
                            ),
                          })
                        : t("gateReady")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pemberitahuan Retensi Otomatis 30 Hari */}
          {isUsed ? (
            <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                <i className="bi bi-clock-history text-zinc-400" aria-hidden="true" />
                <span>Arsip Tiket Terpakai</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Tiket ini telah dipindai di gerbang masuk. Sesuai kebijakan retensi otomatis, arsip tiket terpakai akan dibersihkan dari basis data setelah 30 hari.
              </p>
            </div>
          ) : null}

          {/* Tombol Unduh PDF, Unduh PNG, Bagikan WhatsApp, Tulis Ulasan */}
          <div className="flex flex-wrap gap-2 pt-1 items-center">
            {ticket.acceptedScans.length > 0 && ticket.status === TicketStatus.ACTIVE ? (
              ticket.hasReview ? (
                <span
                  data-testid="review-submitted-badge"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border",
                    isWhite
                      ? "bg-[#195E56]/15 text-[#195E56] border-[#195E56]/30"
                      : "bg-fajar/20 text-fajar border-fajar/40"
                  )}
                >
                  <i className="bi bi-patch-check-fill" aria-hidden="true" />
                  <span>{t("reviewSubmittedBadge")}</span>
                </span>
              ) : onWriteReview ? (
                <button
                  type="button"
                  data-testid="write-review-btn"
                  onClick={() => onWriteReview(ticket)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-transform hover:scale-105 shadow-sm bg-fajar text-obsidian hover:bg-fajar/90"
                >
                  <i className="bi bi-star-fill text-amber-900" aria-hidden="true" />
                  <span>{t("writeReviewBtn")}</span>
                </button>
              ) : null
            ) : null}

            {!isOffline ? (
              <a
                href={`/api/tickets/${encodeURIComponent(ticket.id)}/pdf?locale=${locale}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors",
                  isUsed
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : isWhite
                      ? "bg-[#195E56] text-[#F6FAF8] hover:bg-obsidian"
                      : "bg-fajar text-obsidian hover:bg-fajar/90"
                )}
              >
                <i className="bi bi-file-earmark-pdf-fill" aria-hidden="true" />
                <span>{t("downloadPdfBtn")}</span>
              </a>
            ) : null}

            <a
              href={
                isOffline
                  ? ticket.qrDataUrl
                  : `/api/tickets/${encodeURIComponent(ticket.id)}/qr?download=1`
              }
              download={`qr-${ticket.publicCode}.png`}
              onClick={handleDownloadPngOfflineFallback}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors",
                isUsed
                  ? "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  : isWhite
                    ? "border-[#195E56] bg-white text-[#195E56] hover:bg-[#195E56]/10"
                    : "border-kabut/25 bg-obsidian/70 text-kabut hover:border-fajar"
              )}
            >
              <i className="bi bi-download" aria-hidden="true" />
              <span>{t("downloadPngBtn")}</span>
            </a>

            <a
              href={waShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors",
                isUsed
                  ? "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  : isWhite
                    ? "border-obsidian/20 bg-white text-obsidian hover:border-[#195E56]"
                    : "border-kabut/25 bg-obsidian/70 text-kabut hover:border-telaga-300"
              )}
            >
              <i className="bi bi-whatsapp" aria-hidden="true" />
              <span>{t("shareWaBtn")}</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

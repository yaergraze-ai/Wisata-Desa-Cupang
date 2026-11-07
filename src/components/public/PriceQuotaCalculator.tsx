"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import { formatVisitDateDisplay } from "@/lib/datetime-wib";
import { cn } from "@/lib/cn";
import type { ServerOrderQuoteResult } from "@/server/pricing/quote-service";

export interface PriceQuotaCalculatorProps {
  locale: AppLocale;
  initialQuote: ServerOrderQuoteResult;
}

export function PriceQuotaCalculator({
  locale,
  initialQuote,
}: PriceQuotaCalculatorProps) {
  const tCalc = useTranslations("Calculator");
  const router = useRouter();

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
  const [prevInitialQuote, setPrevInitialQuote] =
    useState<ServerOrderQuoteResult>(initialQuote);
  const [isLoading, setIsLoading] = useState(false);

  if (initialQuote !== prevInitialQuote) {
    setPrevInitialQuote(initialQuote);
    setQuote(initialQuote);
  }

  const isFirstMountRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchServerQuote = useCallback(
    async (nextDate: string, nextReguler: number, nextPutih: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);

      try {
        const qs = new URLSearchParams({
          visitDate: nextDate,
          regulerQty: String(nextReguler),
          putihQty: String(nextPutih),
          locale,
        });
        const res = await fetch(`/api/public/quote?${qs.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as ServerOrderQuoteResult;
          setQuote(data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Pertahankan hasil kalkulasi server sebelumnya bila jaringan terputus sesaat
        }
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    [locale]
  );

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchServerQuote(visitDate, regulerQty, putihQty);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [fetchServerQuote, putihQty, regulerQty, visitDate]);

  // Dengarkan pemilihan paket dari Panel Hero atau Kartu Perbandingan Tiket
  useEffect(() => {
    function onSelectPackage(event: Event) {
      const custom = event as CustomEvent<{
        packageCode?: "TIKET_PUTIH" | "REGULER_BL";
      }>;
      const pkg = custom.detail?.packageCode;
      if (pkg === "TIKET_PUTIH") {
        setPutihQty((prev) => (prev > 0 ? prev : 2));
      } else if (pkg === "REGULER_BL") {
        setPutihQty(0);
        setRegulerQty((prev) => (prev > 0 ? prev : 2));
      }
    }

    window.addEventListener("wisata:select-package", onSelectPackage);
    return () =>
      window.removeEventListener("wisata:select-package", onSelectPackage);
  }, []);

  function adjustPutih(delta: number) {
    setPutihQty((prev) => {
      const next = Math.max(0, prev + delta);
      if (next + regulerQty > quote.maxTicketsPerOrder) {
        return prev;
      }
      return next;
    });
  }

  function adjustReguler(delta: number) {
    setRegulerQty((prev) => {
      const next = Math.max(0, prev + delta);
      if (next + putihQty > quote.maxTicketsPerOrder) {
        return prev;
      }
      return next;
    });
  }

  function handleProceedToCheckout() {
    if (!quote.canCheckout) return;
    const params = new URLSearchParams({
      tab: "buy",
      date: quote.visitDate,
      putih: String(putihQty),
      reguler: String(regulerQty),
    });
    router.push(`/dashboard?${params.toString()}`);
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

  const putihLine = quote.lines.find((l) => l.code === "TIKET_PUTIH");
  const regulerLine = quote.lines.find((l) => l.code === "REGULER_BL");
  const blockingMessage = renderBlockingMessage();

  return (
    <div
      id="kalkulator-tiket"
      className="surface-solid-dark p-6 sm:p-8 scroll-mt-24 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-obsidian border border-telaga-700 px-3.5 py-1.5 text-xs font-bold text-fajar uppercase shadow-sm">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-fajar/20 text-fajar">
            <i className="bi bi-calculator-fill text-xs" aria-hidden="true" />
          </span>
          <span>{tCalc("eyebrow")}</span>
        </span>
        {isLoading ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-telaga-500/40 bg-telaga-950/80 px-3 py-1 text-xs font-semibold text-telaga-200 shadow-md">
            <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
            <span>{tCalc("Refreshing")}</span>
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 font-heading text-2xl font-bold text-kabut">
        {tCalc("heading")}
      </h3>
      <p className="mt-1.5 text-sm text-kabut/85">{tCalc("lead")}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Input Tanggal & Stepper Jumlah Pengunjung */}
        <div className="space-y-4 lg:col-span-7">
          <div>
            <label
              htmlFor="calc-visit-date"
              className="block text-sm font-semibold text-kabut"
            >
              {tCalc("visitDateLabel")}
            </label>
            <input
              id="calc-visit-date"
              type="date"
              min={quote.minVisitDate}
              max={quote.maxVisitDate}
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-kabut/25 bg-obsidian px-4 py-2.5 text-sm font-semibold text-kabut focus:border-fajar transition-colors"
            />
            <p className="mt-1 text-xs text-kabut/75">
              {tCalc("dateRangeHint", {
                minDate: formatVisitDateDisplay(quote.minVisitDate, locale),
                maxDate: formatVisitDateDisplay(quote.maxVisitDate, locale),
              })}
            </p>
          </div>

          {/* Stepper Tiket Putih */}
          <div className="rounded-xl border border-kabut/20 bg-obsidian/75 p-4 transition-all hover:border-fajar/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-fajar/40 bg-fajar/15 text-fajar shadow-sm">
                  <i
                    className="bi bi-ticket-perforated-fill text-base"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="font-heading text-base font-bold text-kabut">
                    {tCalc("whiteQtyLabel")}
                  </p>
                  <p className="text-xs text-kabut/80">{tCalc("whiteQtySub")}</p>
                  {putihLine ? (
                    <p className="mt-1 text-xs font-bold text-fajar">
                      {formatRupiah(putihLine.unitTotal, locale)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustPutih(-1)}
                  disabled={putihQty <= 0}
                  aria-label={tCalc("decreaseAria", {
                    name: tCalc("whiteQtyLabel"),
                  })}
                  className="btn-ui btn-hutan min-w-[44px] px-3"
                >
                  <i className="bi bi-dash-lg" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  className="inline-flex min-w-[40px] justify-center font-heading text-lg font-extrabold text-kabut"
                >
                  {putihQty}
                </span>
                <button
                  type="button"
                  onClick={() => adjustPutih(1)}
                  disabled={putihQty + regulerQty >= quote.maxTicketsPerOrder}
                  aria-label={tCalc("increaseAria", {
                    name: tCalc("whiteQtyLabel"),
                  })}
                  className="btn-ui btn-hutan min-w-[44px] px-3"
                >
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Stepper Tiket Reguler */}
          <div className="rounded-xl border border-kabut/20 bg-obsidian/75 p-4 transition-all hover:border-telaga-400/45">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-telaga-400/40 bg-telaga/20 text-telaga-200 shadow-sm">
                  <i className="bi bi-compass-fill text-base" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-heading text-base font-bold text-kabut">
                    {tCalc("regularQtyLabel")}
                  </p>
                  <p className="text-xs text-kabut/80">
                    {tCalc("regularQtySub")}
                  </p>
                  {regulerLine ? (
                    <p className="mt-1 text-xs font-bold text-fajar">
                      {formatRupiah(regulerLine.unitTotal, locale)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustReguler(-1)}
                  disabled={regulerQty <= 0}
                  aria-label={tCalc("decreaseAria", {
                    name: tCalc("regularQtyLabel"),
                  })}
                  className="btn-ui btn-hutan min-w-[44px] px-3"
                >
                  <i className="bi bi-dash-lg" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  className="inline-flex min-w-[40px] justify-center font-heading text-lg font-extrabold text-kabut"
                >
                  {regulerQty}
                </span>
                <button
                  type="button"
                  onClick={() => adjustReguler(1)}
                  disabled={putihQty + regulerQty >= quote.maxTicketsPerOrder}
                  aria-label={tCalc("increaseAria", {
                    name: tCalc("regularQtyLabel"),
                  })}
                  className="btn-ui btn-hutan min-w-[44px] px-3"
                >
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rincian Server & Status Kuota per Destinasi (Dengan Shadow Skeleton Saat Loading) */}
        <div className="relative flex flex-col justify-between rounded-2xl border border-kabut/20 bg-obsidian p-5 lg:col-span-5 shadow-[0_18px_44px_rgba(0,0,0,0.65)] overflow-hidden">
          {isLoading ? (
            <div
              aria-hidden="true"
              className="space-y-4 animate-pulse py-1"
            >
              <div className="h-3.5 w-40 rounded-md bg-telaga/30" />
              <div className="space-y-2.5">
                <div className="h-10 w-full rounded-xl bg-gradient-to-r from-hutan-800 via-hutan-900 to-obsidian border border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.65)]" />
                <div className="h-10 w-full rounded-xl bg-gradient-to-r from-hutan-800 via-hutan-900 to-obsidian border border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.65)]" />
              </div>
              <div className="h-3.5 w-36 rounded-md bg-telaga/30 pt-2" />
              <div className="space-y-2.5">
                <div className="h-5 w-full rounded-lg bg-white/10" />
                <div className="h-5 w-full rounded-lg bg-white/10" />
                <div className="h-5 w-full rounded-lg bg-white/10" />
                <div className="h-10 w-full rounded-xl bg-fajar/20 border border-fajar/30 shadow-[0_12px_28px_rgba(242,166,90,0.2)] mt-2" />
              </div>
              <div className="h-12 w-full rounded-xl bg-fajar/30 shadow-[0_14px_32px_rgba(242,166,90,0.25)] mt-4" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-bold tracking-wider text-telaga-200 uppercase">
                  {tCalc("quotaStatusHeading")}
                </p>
                <div className="mt-2.5 space-y-2">
                  {quote.destinations.map((dest) => (
                    <div
                      key={dest.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
                        dest.sufficient
                          ? "border-telaga-700 bg-hutan/65 text-kabut"
                          : "border-fajar bg-fajar/15 text-fajar"
                      )}
                    >
                      <span className="font-semibold">{dest.name}</span>
                      <span className="font-bold">
                        {dest.sufficient
                          ? tCalc("quotaAvailableBadge", {
                              remaining: dest.remaining,
                              capacity: dest.capacity,
                            })
                          : tCalc("quotaInsufficientBadge", {
                              remaining: dest.remaining,
                              requested: dest.requested,
                            })}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-xs font-bold tracking-wider text-telaga-200 uppercase">
                  {tCalc("breakdownHeading")}
                </p>
                <dl className="mt-2.5 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-kabut/85">
                    <dt>{tCalc("visitorsCountLabel")}</dt>
                    <dd className="font-semibold text-kabut">
                      {tCalc("visitorsCountValue", {
                        count: quote.totalVisitors,
                        max: quote.maxTicketsPerOrder,
                      })}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-kabut/85">
                    <dt>{tCalc("baseTicketsLabel")}</dt>
                    <dd className="font-semibold text-kabut">
                      {formatRupiah(quote.baseSubtotal, locale)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-kabut/85">
                    <dt>{tCalc("parkingLevyLabel")}</dt>
                    <dd className="font-semibold text-kabut">
                      {formatRupiah(quote.parkingSubtotal, locale)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-kabut/15 pt-3">
                    <dt className="font-heading text-base font-bold text-kabut">
                      {tCalc("grandTotalLabel")}
                    </dt>
                    <dd className="font-heading text-2xl font-extrabold text-fajar">
                      {formatRupiah(quote.grandTotal, locale)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5">
                {blockingMessage ? (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-fajar/60 bg-fajar/15 px-3.5 py-2.5 text-xs font-semibold text-fajar"
                  >
                    <i
                      className="bi bi-exclamation-triangle-fill mr-1.5"
                      aria-hidden="true"
                    />
                    <span>{blockingMessage}</span>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={!quote.canCheckout || isLoading}
                  className="w-full btn-ui btn-fajar"
                >
                  <i
                    className="bi bi-arrow-right-circle-fill text-base"
                    aria-hidden="true"
                  />
                  <span>{tCalc("ctaProceed")}</span>
                </button>
                <p className="mt-2 text-center text-xs text-kabut/75">
                  {tCalc("ctaLoginNote")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

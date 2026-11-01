"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatRupiah } from "@/lib/currency";
import type {
  MonthlyQuotaItem,
  ProductTariffDto,
} from "@/server/admin/admin-quota-tariffs-service";

export function AdminQuotasTariffsView() {
  const t = useTranslations("AdminDashboard");
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const [quotas, setQuotas] = useState<MonthlyQuotaItem[]>([]);
  const [products, setProducts] = useState<ProductTariffDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal edit kuota harian
  const [selectedDayQuota, setSelectedDayQuota] = useState<MonthlyQuotaItem | null>(null);
  const [newMaxQuota, setNewMaxQuota] = useState(1000);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);

  // Modal buat versi tarif baru
  const [showNewTariffModal, setShowNewTariffModal] = useState(false);
  const [targetProductId, setTargetProductId] = useState("");
  const [newBasePrice, setNewBasePrice] = useState(15000);
  const [newParkingFee, setNewParkingFee] = useState(3000);
  const [newValidFrom, setNewValidFrom] = useState(now.toISOString().slice(0, 10));
  const [isCreatingTariff, setIsCreatingTariff] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [quotaRes, tariffRes] = await Promise.all([
        fetch(`/api/admin/quotas?year=${year}&month=${month}`),
        fetch("/api/admin/tariffs"),
      ]);
      if (!quotaRes.ok || !tariffRes.ok) {
        throw new Error("Gagal memuat data kuota & tarif.");
      }
      const quotaData = (await quotaRes.json()) as { quotas: MonthlyQuotaItem[] };
      const tariffData = (await tariffRes.json()) as { products: ProductTariffDto[] };
      setQuotas(quotaData.quotas);
      setProducts(tariffData.products);
      if (tariffData.products.length > 0 && !targetProductId) {
        setTargetProductId(tariffData.products[0]!.productId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [quotaRes, tariffRes] = await Promise.all([
          fetch(`/api/admin/quotas?year=${year}&month=${month}`),
          fetch("/api/admin/tariffs"),
        ]);
        if (!quotaRes.ok || !tariffRes.ok) {
          throw new Error("Gagal memuat data kuota & tarif.");
        }
        const quotaData = (await quotaRes.json()) as { quotas: MonthlyQuotaItem[] };
        const tariffData = (await tariffRes.json()) as { products: ProductTariffDto[] };
        if (!ignore) {
          setQuotas(quotaData.quotas);
          setProducts(tariffData.products);
          if (tariffData.products.length > 0 && !targetProductId) {
            setTargetProductId(tariffData.products[0]!.productId);
          }
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat data.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleSaveQuota() {
    if (!selectedDayQuota) return;
    setIsUpdatingQuota(true);
    try {
      const res = await fetch("/api/admin/quotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDayQuota.date,
          maxQuota: Number(newMaxQuota),
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan kuota.");
      setSelectedDayQuota(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan kuota.");
    } finally {
      setIsUpdatingQuota(false);
    }
  }

  async function handleCreateTariff(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingTariff(true);
    try {
      const res = await fetch("/api/admin/tariffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: targetProductId,
          basePrice: Number(newBasePrice),
          parkingFee: Number(newParkingFee),
          validFrom: newValidFrom,
        }),
      });
      if (!res.ok) throw new Error("Gagal membuat tarif baru.");
      setShowNewTariffModal(false);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal membuat tarif baru.");
    } finally {
      setIsCreatingTariff(false);
    }
  }

  return (
    <div className="space-y-8" data-testid="admin-quotas-tariffs-view">
      {/* BAGIAN 1: KALENDER KUOTA HARIAN */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-kabut">
              {t("quotasCalendarTitle")}
            </h2>
            <p className="text-xs text-kabut/70">{t("quotasCalendarSubtitle")}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-xl border border-telaga-700 bg-obsidian px-3 py-1.5 text-xs text-kabut"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {t("monthLabel")} {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-telaga-700 bg-obsidian px-3 py-1.5 text-xs text-kabut"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
            <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
            <span>{t("loadingQuotas")}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-300">{error}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {quotas.map((q) => {
              const dayNum = q.date.slice(-2);
              const percentUsed = Math.min(100, Math.round((q.usedQuota / q.maxQuota) * 100));
              const isFull = q.availableQuota <= 0;

              return (
                <button
                  key={q.date}
                  type="button"
                  onClick={() => {
                    setSelectedDayQuota(q);
                    setNewMaxQuota(q.maxQuota);
                  }}
                  className="p-3 rounded-xl border border-telaga-700/60 bg-obsidian/70 hover:border-fajar/70 hover:bg-obsidian transition text-left space-y-1.5"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-kabut">{dayNum}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isFull
                          ? "bg-red-950 text-red-300"
                          : percentUsed > 75
                          ? "bg-amber-950 text-amber-300"
                          : "bg-green-950 text-green-300"
                      }`}
                    >
                      {percentUsed}%
                    </span>
                  </div>
                  <div className="text-[11px] text-kabut/70">
                    {t("remainingLabel")} <strong className="text-fajar font-mono">{q.availableQuota}</strong>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-telaga-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isFull ? "bg-red-500" : percentUsed > 75 ? "bg-amber-500" : "bg-telaga-500"
                      }`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* BAGIAN 2: TARIF TIKET BERVERSI */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-kabut">
              {t("versionedTariffsTitle")}
            </h2>
            <p className="text-xs text-kabut/70">{t("versionedTariffsSubtitle")}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewTariffModal(true)}
            className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold"
          >
            <i className="bi bi-plus-circle mr-1.5" aria-hidden="true" />
            <span>{t("createTariffVersionBtn")}</span>
          </button>
        </div>

        <div className="space-y-6">
          {products.map((p) => {
            const activeTariff = p.tariffs[0];
            return (
              <div
                key={p.productId}
                className="p-5 rounded-xl border border-telaga-700/60 bg-obsidian/60 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-telaga-700/40 pb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-fajar uppercase">
                      {p.productCode}
                    </span>
                    <h3 className="font-heading text-base font-bold text-kabut">{p.productName}</h3>
                  </div>
                  {activeTariff ? (
                    <div className="text-right">
                      <span className="text-[11px] text-kabut/60 block">{t("activeTariffBadge")}</span>
                      <span className="font-heading text-lg font-bold text-fajar">
                        {formatRupiah(activeTariff.totalPrice)}
                      </span>
                      <span className="text-[10px] text-kabut/60 block">
                        ({t("ticketSubtotalLabel")} {formatRupiah(activeTariff.basePrice)} + {t("parkingSubtotalLabel")}{" "}
                        {formatRupiah(activeTariff.parkingFee)})
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* RIWAYAT VERSI */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-kabut/70 uppercase tracking-wider block">
                    {t("tariffHistoryHeading")}
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-kabut/60 border-b border-telaga-700/40 text-[11px]">
                        <tr>
                          <th className="pb-2">{t("thTariffVersion")}</th>
                          <th className="pb-2">{t("thBasePrice")}</th>
                          <th className="pb-2">{t("thParkingFee")}</th>
                          <th className="pb-2">{t("thTotal")}</th>
                          <th className="pb-2">{t("thEffectiveDate")}</th>
                          <th className="pb-2">{t("thCreatedAt")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-telaga-700/20 text-kabut/90">
                        {p.tariffs.map((trf) => (
                          <tr key={trf.id}>
                            <td className="py-2 font-mono font-bold text-fajar">v{trf.version}</td>
                            <td className="py-2">{formatRupiah(trf.basePrice)}</td>
                            <td className="py-2">{formatRupiah(trf.parkingFee)}</td>
                            <td className="py-2 font-bold">{formatRupiah(trf.totalPrice)}</td>
                            <td className="py-2">{trf.validFrom}</td>
                            <td className="py-2 text-kabut/60">{trf.createdAt.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL EDIT KUOTA HARIAN */}
      {selectedDayQuota ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-5">
            <h3 className="font-heading text-lg font-bold">
              {t("editQuotaTitle", { date: selectedDayQuota.date })}
            </h3>
            <p className="text-xs text-kabut/70">
              {t("currentCapacityLabel", { cap: selectedDayQuota.maxQuota, sold: selectedDayQuota.usedQuota })}
            </p>

            <div>
              <label className="block text-xs font-semibold text-kabut mb-1.5">
                {t("newCapacityInputLabel")}
              </label>
              <input
                type="number"
                min={selectedDayQuota.usedQuota}
                max={50000}
                value={newMaxQuota}
                onChange={(e) => setNewMaxQuota(Number(e.target.value))}
                className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-sm text-kabut"
              />
              <span className="text-[11px] text-kabut/50 mt-1 block">
                {t("safeLimitHint")}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
              <button
                type="button"
                onClick={() => setSelectedDayQuota(null)}
                className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
              >
                {t("cancelModalBtn")}
              </button>
              <button
                type="button"
                disabled={isUpdatingQuota}
                onClick={handleSaveQuota}
                className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {isUpdatingQuota ? t("savingQuotaBtn") : t("saveQuotaBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL BUAT VERSI TARIF BARU */}
      {showNewTariffModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-5">
            <h3 className="font-heading text-lg font-bold">{t("createTariffModalTitle")}</h3>
            <form onSubmit={handleCreateTariff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-kabut mb-1">{t("thTickets")}</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                >
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName} ({p.productCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-kabut mb-1">{t("basePriceInputLabel")}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-kabut mb-1">{t("parkingFeeInputLabel")}</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={newParkingFee}
                  onChange={(e) => setNewParkingFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-kabut mb-1">{t("effectiveDateInputLabel")}</label>
                <input
                  type="date"
                  value={newValidFrom}
                  onChange={(e) => setNewValidFrom(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-obsidian/70 border border-telaga-700/40 text-[11px] text-fajar">
                {t("thTotal")}: <strong>{formatRupiah(Number(newBasePrice) + Number(newParkingFee))}</strong>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setShowNewTariffModal(false)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTariff}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isCreatingTariff ? t("savingTariffBtn") : t("saveTariffBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SecurityOverviewDto } from "@/server/super-admin/security-monitor-service";

export function SuperAdminSecurityView() {
  const t = useTranslations("SuperAdminDashboard");
  const [security, setSecurity] = useState<SecurityOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSecurity() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/security");
      if (!res.ok) throw new Error("Gagal memuat status keamanan.");
      const data = (await res.json()) as { security: SecurityOverviewDto };
      setSecurity(data.security);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data keamanan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/super-admin/security");
        if (!res.ok) throw new Error("Gagal memuat status keamanan.");
        const data = (await res.json()) as { security: SecurityOverviewDto };
        if (!ignore) {
          setSecurity(data.security);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat data keamanan.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="surface-solid-dark p-8 rounded-2xl flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-kabut/70">
          <i className="bi bi-arrow-repeat animate-spin text-2xl text-fajar" aria-hidden="true" />
          <span>{t("loadingSecurity")}</span>
        </div>
      </div>
    );
  }

  if (error || !security) {
    return (
      <div className="surface-solid-dark p-8 rounded-2xl text-center text-red-300">
        <p>{error ?? t("failedLoadMetrics")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="super-admin-security-view">
      {/* 4 KARTU MONITOR KEAMANAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("secFailedLogins")}
          </span>
          <p
            className={`mt-2 text-2xl sm:text-3xl font-heading font-bold ${
              security.failedLoginsLast24h > 5 ? "text-red-400" : "text-kabut"
            }`}
          >
            {security.failedLoginsLast24h}
          </p>
          <span className="mt-2 text-[11px] text-kabut/60 block">
            {t("secFailedLoginsDesc")}
          </span>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("secRateLimits")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-amber-300">
            {security.rateLimitEventsLast24h}
          </p>
          <span className="mt-2 text-[11px] text-kabut/60 block">
            {t("secRateLimitsDesc")}
          </span>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("secActiveSessions")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-fajar">
            {security.activeSessionsCount}
          </p>
          <span className="mt-2 text-[11px] text-kabut/60 block">
            {t("secActiveSessionsDesc")}
          </span>
        </div>

        <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60">
          <span className="text-xs font-semibold text-kabut/70 uppercase tracking-wider block">
            {t("sec2FaAdoption")}
          </span>
          <p className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-telaga-300">
            {security.twoFactorAdoptionRate.percentage}%
          </p>
          <span className="mt-2 text-[11px] text-kabut/60 block">
            {t("sec2FaAdoptionDesc")}
          </span>
        </div>
      </div>

      {/* TABEL PERISTIWA KEAMANAN TERAKHIR */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-kabut">
              {t("securityEventsTitle")}
            </h3>
            <p className="text-xs text-kabut/70">{t("securityEventsSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={loadSecurity}
            className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-3.5 py-1.5 text-xs text-kabut"
          >
            <i className="bi bi-arrow-clockwise mr-1.5" aria-hidden="true" />
            <span>{t("refreshSettingsBtn")}</span>
          </button>
        </div>

        {security.recentSuspiciousEvents.length === 0 ? (
          <div className="p-8 text-center text-kabut/60">
            {t("noSuspiciousEvents")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">{t("thSecTime")}</th>
                  <th className="pb-3 font-semibold">{t("thSecSensor")}</th>
                  <th className="pb-3 font-semibold">{t("thSecIp")}</th>
                  <th className="pb-3 font-semibold">{t("thSecDetails")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut font-mono text-[11px]">
                {security.recentSuspiciousEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-obsidian/40 transition">
                    <td className="py-2.5 text-kabut/70 whitespace-nowrap">
                      {evt.createdAt.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2.5 font-bold text-amber-300">{evt.action}</td>
                    <td className="py-2.5 text-kabut/60">{evt.ipAddress ?? "-"}</td>
                    <td className="py-2.5 text-kabut/80 max-w-md truncate">{evt.details}</td>
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

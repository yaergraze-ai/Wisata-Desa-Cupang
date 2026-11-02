"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { IntegrationHealthItem } from "@/server/super-admin/integration-health-service";

export function SuperAdminHealthView() {
  const t = useTranslations("SuperAdminDashboard");
  const [integrations, setIntegrations] = useState<IntegrationHealthItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  async function testIntegrations() {
    setIsTesting(true);
    try {
      const res = await fetch("/api/super-admin/health");
      if (!res.ok) throw new Error("Gagal menguji kesehatan integrasi.");
      const data = (await res.json()) as { integrations: IntegrationHealthItem[] };
      setIntegrations(data.integrations);
      setLastTestedAt(new Date().toLocaleTimeString("id-ID"));
    } catch {
      // ignore
    } finally {
      setIsTesting(false);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/super-admin/health");
        if (res.ok) {
          const data = (await res.json()) as { integrations: IntegrationHealthItem[] };
          if (!ignore) {
            setIntegrations(data.integrations);
            setLastTestedAt(new Date().toLocaleTimeString("id-ID"));
            setIsLoading(false);
          }
        }
      } catch {
        if (!ignore) setIsLoading(false);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="super-admin-health-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("healthTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("healthSubtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {lastTestedAt ? (
            <span className="text-[11px] text-kabut/60">
              {t("checkedAtLabel")} {lastTestedAt}
            </span>
          ) : null}
          <button
            type="button"
            disabled={isTesting}
            onClick={testIntegrations}
            className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {isTesting ? (
              <i className="bi bi-arrow-repeat animate-spin mr-1.5" aria-hidden="true" />
            ) : (
              <i className="bi bi-broadcast mr-1.5" aria-hidden="true" />
            )}
            <span>{isTesting ? t("testingHealthBtn") : t("testAllHealthBtn")}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("testingHealthBtn")}</span>
        </div>
      ) : (
        <div className="rounded-3xl border border-telaga-700/70 surface-solid-dark shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-telaga-700/60 bg-gradient-to-br from-hutan/90 via-obsidian/95 to-obsidian">
          {integrations.map((item) => {
            const isConnected = item.status === "CONNECTED";
            const isDegraded = item.status === "DEGRADED";

            return (
              <div
                key={item.id}
                className="relative p-5 space-y-3.5 flex flex-col justify-between transition-colors hover:bg-obsidian/70"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-kabut/60 uppercase tracking-wider">
                      {item.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        isConnected
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-600/50"
                          : isDegraded
                          ? "bg-amber-950 text-amber-300 border border-amber-600/50"
                          : "bg-red-950 text-red-300 border border-red-600/50"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isConnected
                            ? "bg-emerald-400 animate-pulse"
                            : isDegraded
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }`}
                      />
                      <span>{item.status}</span>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <h3 className="font-heading text-base font-bold text-kabut">{item.name}</h3>
                    {item.latencyMs !== null ? (
                      <span className="font-mono text-xs font-bold text-fajar">
                        {t("latencyLabel", { ms: item.latencyMs })}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-kabut/80 leading-relaxed">{item.message}</p>
                </div>

                {Object.keys(item.details).length > 0 ? (
                  <div className="pt-2 border-t border-telaga-700/30 text-[11px] text-kabut/60 font-mono space-y-0.5">
                    {Object.entries(item.details).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}:</span>
                        <span className="text-kabut/80">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

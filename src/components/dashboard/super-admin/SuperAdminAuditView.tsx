"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AuditLogItemDto } from "@/server/super-admin/audit-log-service";

export function SuperAdminAuditView() {
  const t = useTranslations("SuperAdminDashboard");
  const [logs, setLogs] = useState<AuditLogItemDto[]>([]);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [actionFilter, setActionFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [inspectMetadata, setInspectMetadata] = useState<Record<string, unknown> | null>(null);

  async function loadLogs(p = 1, a = actionFilter) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "20");
      if (a.trim()) params.set("action", a.trim());

      const res = await fetch(`/api/super-admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat log audit.");
      const data = (await res.json()) as {
        logs: AuditLogItemDto[];
        total: number;
        page: number;
        totalPages: number;
      };
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat log audit.");
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
        params.set("limit", "25");
        if (actionFilter.trim()) params.set("action", actionFilter.trim());

        const res = await fetch(`/api/super-admin/audit-logs?${params.toString()}`);
        if (!res.ok) throw new Error("Gagal memuat log audit.");
        const data = (await res.json()) as {
          logs: AuditLogItemDto[];
          total: number;
          page: number;
          totalPages: number;
        };
        if (!ignore) {
          setLogs(data.logs);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat log audit.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, [actionFilter]);

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/super-admin/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionFilter.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Gagal ekspor log audit.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-wisata-cirebon-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal ekspor log audit.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="super-admin-audit-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("auditTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("auditSubtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={t("auditFilterPlaceholder")}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadLogs(1, actionFilter);
            }}
            className="w-full sm:w-60 rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-1.5 text-xs text-kabut"
          />

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="btn-ui btn-fajar rounded-xl px-4 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            {isExporting ? (
              <i className="bi bi-arrow-repeat animate-spin mr-1.5" aria-hidden="true" />
            ) : (
              <i className="bi bi-file-earmark-spreadsheet mr-1.5" aria-hidden="true" />
            )}
            <span>{t("auditExportBtn")}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingAudit")}</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-300">{error}</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-kabut/60">{t("noAuditLogs")}</div>
      ) : (
        <>
          {/* TAMPILAN KARTU UNTUK PONSEL (md:hidden) - SUSUN KE BAWAH */}
          <div className="md:hidden space-y-3">
            {logs.map((l) => (
              <div
                key={`mobile-audit-${l.id}`}
                className="p-4 rounded-xl border border-telaga-700/60 bg-obsidian/80 space-y-2.5 shadow-md text-xs"
              >
                <div className="flex items-center justify-between gap-2 border-b border-telaga-700/40 pb-2">
                  <span className="font-bold text-amber-300 font-mono text-[11px] truncate">
                    {l.action}
                  </span>
                  <span className="text-[10px] text-kabut/60 font-mono shrink-0">
                    {l.createdAt.slice(0, 19).replace("T", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-kabut/50 uppercase block">Aktor</span>
                    <span className="font-semibold text-kabut">{l.actorName}</span>{" "}
                    <span className="text-[10px] text-fajar font-bold font-mono">
                      [{l.actorRole ?? "SYS"}]
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-kabut/50 uppercase block">IP Address</span>
                    <span className="font-mono text-[11px] text-kabut/70">{l.ipAddress ?? "-"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-telaga-700/30 text-[11px]">
                  <span className="text-kabut/70 truncate max-w-[200px]">
                    {l.entity} {l.entityId ? `(${l.entityId.slice(0, 8)}...)` : ""}
                  </span>
                  {l.metadata && Object.keys(l.metadata).length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setInspectMetadata(l.metadata)}
                      className="inline-flex items-center gap-1 rounded-lg bg-obsidian border border-telaga-700 px-2.5 py-1 text-[11px] font-semibold text-fajar hover:text-white transition"
                    >
                      <i className="bi bi-braces text-xs" aria-hidden="true" />
                      <span>{t("viewJsonBtn")}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* TAMPILAN TABEL UNTUK DESKTOP (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">{t("thAuditTime")}</th>
                  <th className="pb-3 font-semibold">{t("thAuditActor")}</th>
                  <th className="pb-3 font-semibold">{t("thAuditAction")}</th>
                  <th className="pb-3 font-semibold">{t("thAuditTarget")}</th>
                  <th className="pb-3 font-semibold">{t("thSecIp")}</th>
                  <th className="pb-3 text-right font-semibold">{t("thAuditDetails")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut font-mono text-[11px]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-obsidian/40 transition">
                    <td className="py-2.5 text-kabut/70 whitespace-nowrap">
                      {l.createdAt.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2.5">
                      <span className="font-semibold text-kabut">{l.actorName}</span>{" "}
                      <span className="text-[10px] text-fajar font-bold">[{l.actorRole ?? "SYS"}]</span>
                    </td>
                    <td className="py-2.5 font-bold text-amber-300">{l.action}</td>
                    <td className="py-2.5 text-kabut/80">
                      {l.entity} {l.entityId ? `(${l.entityId.slice(0, 8)}...)` : ""}
                    </td>
                    <td className="py-2.5 text-kabut/50">{l.ipAddress ?? "-"}</td>
                    <td className="py-2.5 text-right font-sans">
                      {l.metadata && Object.keys(l.metadata).length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setInspectMetadata(l.metadata)}
                          className="rounded bg-obsidian border border-telaga-700 px-2 py-0.5 text-[10px] text-kabut hover:text-white"
                        >
                          {t("viewJsonBtn")}
                        </button>
                      ) : (
                        <span className="text-kabut/40 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PAGINASI */}
      {totalPages > 1 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-telaga-700/40 text-xs">
          <span className="text-kabut/60 text-center sm:text-left">
            {t("userPageCounter", { page, totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadLogs(page - 1, actionFilter)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-obsidian border border-telaga-700 px-3 py-1.5 text-xs font-bold text-kabut hover:border-fajar disabled:opacity-30 transition"
            >
              <i className="bi bi-caret-left-fill text-fajar" aria-hidden="true" />
              <span>{t("userPrevBtn")}</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => loadLogs(page + 1, actionFilter)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-obsidian border border-telaga-700 px-3 py-1.5 text-xs font-bold text-kabut hover:border-fajar disabled:opacity-30 transition"
            >
              <span>{t("userNextBtn")}</span>
              <i className="bi bi-caret-right-fill text-fajar" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {/* MODAL JSON METADATA */}
      {inspectMetadata ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <div className="flex items-center justify-between border-b border-telaga-700/40 pb-3">
              <h3 className="font-heading text-sm font-bold">{t("auditModalTitle")}</h3>
              <button
                type="button"
                onClick={() => setInspectMetadata(null)}
                className="p-1 text-kabut/60 hover:text-kabut"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-obsidian border border-telaga-700/50 text-[11px] font-mono text-fajar overflow-x-auto max-h-72">
              {JSON.stringify(inspectMetadata, null, 2)}
            </pre>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setInspectMetadata(null)}
                className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-1.5 text-xs font-semibold text-kabut"
              >
                {t("closeAuditModalBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { SiteSettingItemDto } from "@/server/super-admin/site-settings-service";

export function SuperAdminSettingsView() {
  const t = useTranslations("SuperAdminDashboard");
  const [settings, setSettings] = useState<SiteSettingItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [activeSetting, setActiveSetting] = useState<SiteSettingItemDto | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadSettings() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/settings");
      if (!res.ok) throw new Error("Gagal memuat konfigurasi sistem.");
      const data = (await res.json()) as { settings: SiteSettingItemDto[] };
      setSettings(data.settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengaturan.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/super-admin/settings");
        if (!res.ok) throw new Error("Gagal memuat konfigurasi sistem.");
        const data = (await res.json()) as { settings: SiteSettingItemDto[] };
        if (!ignore) {
          setSettings(data.settings);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat pengaturan.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSaveSetting(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSetting) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeSetting.key,
          value: editValue,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan pengaturan.");
      setActiveSetting(null);
      await loadSettings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="super-admin-settings-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("settingsTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("settingsSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={loadSettings}
          className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-3 py-1.5 text-xs text-kabut"
        >
          <i className="bi bi-arrow-clockwise mr-1.5" aria-hidden="true" />
          <span>{t("refreshSettingsBtn")}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingSettings")}</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-300">{error}</div>
      ) : settings.length === 0 ? (
        <div className="p-8 text-center text-kabut/60">{t("noSettings")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
              <tr>
                <th className="pb-3 font-semibold">{t("thSettingKey")}</th>
                <th className="pb-3 font-semibold">{t("thSettingValue")}</th>
                <th className="pb-3 font-semibold">{t("thSettingDescription")}</th>
                <th className="pb-3 font-semibold">{t("thSettingUpdated")}</th>
                <th className="pb-3 text-right font-semibold">{t("thUserAction")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-telaga-700/30 text-kabut">
              {settings.map((s) => (
                <tr key={s.id} className="hover:bg-obsidian/40 transition">
                  <td className="py-3 font-mono font-bold text-fajar">{s.key}</td>
                  <td className="py-3 font-mono font-semibold max-w-xs truncate">{s.value}</td>
                  <td className="py-3 text-kabut/70">{s.description ?? "-"}</td>
                  <td className="py-3 text-[11px] text-kabut/50">{s.updatedAt.slice(0, 10)}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSetting(s);
                        setEditValue(s.value);
                      }}
                      className="rounded bg-obsidian border border-telaga-700 px-2.5 py-1 text-[11px] text-kabut hover:text-white"
                    >
                      {t("editSettingBtn")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL UBAH PENGATURAN */}
      {activeSetting ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <h3 className="font-heading text-base font-bold">
              {t("editSettingModalTitle", { key: activeSetting.key })}
            </h3>
            {activeSetting.description ? (
              <p className="text-xs text-kabut/70">{activeSetting.description}</p>
            ) : null}

            <form onSubmit={handleSaveSetting} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t("newSettingValueLabel")}</label>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full font-mono rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setActiveSetting(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelSettingModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSaving ? t("savingSettingBtn") : t("saveSettingBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

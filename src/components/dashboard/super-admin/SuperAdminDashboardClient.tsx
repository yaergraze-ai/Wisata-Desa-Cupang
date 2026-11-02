"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { SuperAdminUsersView } from "@/components/dashboard/super-admin/SuperAdminUsersView";
import { SuperAdminHealthView } from "@/components/dashboard/super-admin/SuperAdminHealthView";
import { SuperAdminAuditView } from "@/components/dashboard/super-admin/SuperAdminAuditView";
import { SuperAdminSettingsView } from "@/components/dashboard/super-admin/SuperAdminSettingsView";
import { SuperAdminSecurityView } from "@/components/dashboard/super-admin/SuperAdminSecurityView";

export type SuperAdminTab = "users" | "health" | "audit" | "settings" | "security";

export interface SuperAdminDashboardClientProps {
  locale: AppLocale;
  initialTab?: SuperAdminTab;
}

export function SuperAdminDashboardClient({
  initialTab = "users",
}: SuperAdminDashboardClientProps) {
  const t = useTranslations("SuperAdminDashboard");
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(initialTab);
  const [layoutMode, setLayoutMode] = useState<"scroll" | "wrap">("scroll");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const tabs: { key: SuperAdminTab; label: string; icon: string }[] = [
    { key: "users", label: t("tabUsers"), icon: "bi-people-fill" },
    { key: "health", label: t("tabHealth"), icon: "bi-activity" },
    { key: "audit", label: t("tabAudit"), icon: "bi-journal-text" },
    { key: "settings", label: t("tabSettings"), icon: "bi-sliders" },
    { key: "security", label: t("tabSecurity"), icon: "bi-shield-check" },
  ];

  const currentIndex = tabs.findIndex((t) => t.key === activeTab);

  function handleNextTab() {
    if (currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1]!.key;
      setActiveTab(nextTab);
      const el = document.getElementById(`super-admin-tab-${nextTab}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else {
      scrollContainerRef.current?.scrollBy({ left: 160, behavior: "smooth" });
    }
  }

  function handlePrevTab() {
    if (currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1]!.key;
      setActiveTab(prevTab);
      const el = document.getElementById(`super-admin-tab-${prevTab}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else {
      scrollContainerRef.current?.scrollBy({ left: -160, behavior: "smooth" });
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="super-admin-dashboard-client">
      {/* STATUS BANNER SUPER ADMIN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 text-xs text-kabut/80">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
            Portal Kontrol Super Admin — Audit Keamanan Aktif
          </span>
        </div>
        <span className="text-[11px] text-kabut/60 font-mono hidden sm:inline">
          Protokol Privasi & Enkripsi Maksimal
        </span>
      </div>

      {/* TAB NAVIGATION BAR */}
      <div className="surface-solid-dark p-2.5 sm:p-3 rounded-3xl border border-telaga-700/60 shadow-2xl bg-gradient-to-r from-hutan/90 via-obsidian/95 to-obsidian">
        {/* Kontrol Mobile: Judul Menu & Sakelar Tampilan Susun ke Bawah */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1 sm:hidden">
          <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider flex items-center gap-1.5">
            <i className="bi bi-shield-lock-fill text-fajar" aria-hidden="true" />
            <span>Menu Super Admin</span>
          </span>
          <button
            type="button"
            onClick={() => setLayoutMode(layoutMode === "scroll" ? "wrap" : "scroll")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-telaga-600/50 bg-obsidian px-2.5 py-1 text-[11px] font-semibold text-fajar hover:bg-obsidian/80 transition"
          >
            <i className={`bi ${layoutMode === "scroll" ? "bi-grid-fill" : "bi-arrows-expand"}`} aria-hidden="true" />
            <span>{layoutMode === "scroll" ? "Susun ke Bawah" : "Geser Samping"}</span>
          </button>
        </div>

        <div className="relative flex items-center gap-1">
          {/* Tombol Geser Kiri (<) di Mode Scroll */}
          {layoutMode === "scroll" ? (
            <button
              type="button"
              onClick={handlePrevTab}
              disabled={currentIndex <= 0}
              aria-label="Tab Sebelumnya"
              className="shrink-0 z-10 inline-flex items-center justify-center w-8 h-9 rounded-xl border border-telaga-600/60 bg-obsidian/90 text-fajar hover:bg-obsidian hover:border-fajar disabled:opacity-25 disabled:pointer-events-none transition shadow-sm"
              title="Tab Sebelumnya (<)"
            >
              <i className="bi bi-caret-left-fill text-xs" aria-hidden="true" />
            </button>
          ) : null}

          {/* Container Tab */}
          <div
            ref={scrollContainerRef}
            className={`flex-1 gap-1.5 ${
              layoutMode === "wrap"
                ? "grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap items-center"
                : "flex items-center overflow-x-auto scrollbar-none snap-x scroll-smooth py-0.5"
            }`}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  id={`super-admin-tab-${tab.key}`}
                  type="button"
                  data-testid={`super-admin-tab-${tab.key}`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    const el = document.getElementById(`super-admin-tab-${tab.key}`);
                    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                  }}
                  className={`shrink-0 snap-start flex items-center justify-center sm:justify-start gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? "bg-fajar text-obsidian shadow-md shadow-fajar/20 font-extrabold"
                      : "bg-obsidian/40 text-kabut hover:bg-obsidian hover:text-white"
                  }`}
                >
                  <i className={`bi ${tab.icon} shrink-0`} aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tombol Geser Kanan (>) di Mode Scroll */}
          {layoutMode === "scroll" ? (
            <button
              type="button"
              onClick={handleNextTab}
              disabled={currentIndex >= tabs.length - 1}
              aria-label="Tab Selanjutnya"
              className="shrink-0 z-10 inline-flex items-center justify-center w-8 h-9 rounded-xl border border-telaga-600/60 bg-obsidian/90 text-fajar hover:bg-obsidian hover:border-fajar disabled:opacity-25 disabled:pointer-events-none transition shadow-sm"
              title="Tab Selanjutnya (>)"
            >
              <i className="bi bi-caret-right-fill text-xs" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ACTIVE VIEW */}
      <div>
        {activeTab === "users" ? <SuperAdminUsersView /> : null}
        {activeTab === "health" ? <SuperAdminHealthView /> : null}
        {activeTab === "audit" ? <SuperAdminAuditView /> : null}
        {activeTab === "settings" ? <SuperAdminSettingsView /> : null}
        {activeTab === "security" ? <SuperAdminSecurityView /> : null}
      </div>
    </div>
  );
}

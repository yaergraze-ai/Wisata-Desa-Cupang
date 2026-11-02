"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { AdminMetricsView } from "@/components/dashboard/admin/AdminMetricsView";
import { AdminOrdersView } from "@/components/dashboard/admin/AdminOrdersView";
import { AdminQuotasTariffsView } from "@/components/dashboard/admin/AdminQuotasTariffsView";
import { AdminRefundsView } from "@/components/dashboard/admin/AdminRefundsView";
import { AdminReviewsView } from "@/components/dashboard/admin/AdminReviewsView";
import { AdminStaffView } from "@/components/dashboard/admin/AdminStaffView";
import { AdminMediaClient } from "@/components/dashboard/admin/AdminMediaClient";
import { AdminInboxView } from "@/components/dashboard/admin/AdminInboxView";
import { MemberProfileTab } from "@/components/dashboard/member/MemberProfileTab";
import type { AuthenticatedContext } from "@/server/auth/guards";

export type AdminTab =
  | "metrics"
  | "orders"
  | "quotas"
  | "refunds"
  | "reviews"
  | "staff"
  | "media"
  | "inbox"
  | "profile";

export interface AdminDashboardClientProps {
  locale: AppLocale;
  authCtx: AuthenticatedContext;
  initialTab?: AdminTab;
}

export function AdminDashboardClient({
  locale,
  authCtx,
  initialTab = "metrics",
}: AdminDashboardClientProps) {
  const t = useTranslations("AdminDashboard");
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [layoutMode, setLayoutMode] = useState<"scroll" | "wrap">("scroll");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "metrics", label: t("tabMetrics"), icon: "bi-graph-up-arrow" },
    { key: "orders", label: t("tabOrders"), icon: "bi-receipt" },
    { key: "quotas", label: t("tabQuotas"), icon: "bi-calendar-week" },
    { key: "refunds", label: t("tabRefunds"), icon: "bi-arrow-counterclockwise" },
    { key: "reviews", label: t("tabReviews"), icon: "bi-star-fill" },
    { key: "staff", label: t("tabStaff"), icon: "bi-people-fill" },
    { key: "media", label: t("tabMedia"), icon: "bi-images" },
    { key: "inbox", label: t("tabInbox"), icon: "bi-inbox-fill" },
    { key: "profile", label: "Profil Admin", icon: "bi-person-gear" },
  ];

  const currentIndex = tabs.findIndex((t) => t.key === activeTab);

  function handleNextTab() {
    if (currentIndex < tabs.length - 1) {
      const nextTab = tabs[currentIndex + 1]!.key;
      setActiveTab(nextTab);
      const el = document.getElementById(`admin-tab-${nextTab}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else {
      scrollContainerRef.current?.scrollBy({ left: 180, behavior: "smooth" });
    }
  }

  function handlePrevTab() {
    if (currentIndex > 0) {
      const prevTab = tabs[currentIndex - 1]!.key;
      setActiveTab(prevTab);
      const el = document.getElementById(`admin-tab-${prevTab}`);
      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else {
      scrollContainerRef.current?.scrollBy({ left: -180, behavior: "smooth" });
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="admin-dashboard-client">
      {/* TAB NAVIGATION BAR */}
      <div className="surface-solid-dark p-2 sm:p-2.5 rounded-2xl border border-telaga-700/60 shadow-lg">
        {/* Kontrol Mobile: Judul Menu & Sakelar Tampilan Susun ke Bawah */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1 sm:hidden">
          <span className="text-[11px] font-bold text-kabut/70 uppercase tracking-wider flex items-center gap-1.5">
            <i className="bi bi-compass text-fajar" aria-hidden="true" />
            <span>Menu Dashboard</span>
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
                  id={`admin-tab-${tab.key}`}
                  type="button"
                  data-testid={`admin-tab-${tab.key}`}
                  onClick={() => {
                    setActiveTab(tab.key);
                    const el = document.getElementById(`admin-tab-${tab.key}`);
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
        {activeTab === "metrics" ? <AdminMetricsView /> : null}
        {activeTab === "orders" ? <AdminOrdersView /> : null}
        {activeTab === "quotas" ? <AdminQuotasTariffsView /> : null}
        {activeTab === "refunds" ? <AdminRefundsView /> : null}
        {activeTab === "reviews" ? <AdminReviewsView /> : null}
        {activeTab === "staff" ? <AdminStaffView /> : null}
        {activeTab === "media" ? <AdminMediaClient locale={locale} /> : null}
        {activeTab === "inbox" ? <AdminInboxView /> : null}
        {activeTab === "profile" ? <MemberProfileTab authCtx={authCtx} /> : null}
      </div>
    </div>
  );
}

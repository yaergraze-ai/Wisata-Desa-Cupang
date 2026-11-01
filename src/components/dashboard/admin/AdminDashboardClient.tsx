"use client";

import { useState } from "react";
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

export type AdminTab =
  | "metrics"
  | "orders"
  | "quotas"
  | "refunds"
  | "reviews"
  | "staff"
  | "media"
  | "inbox";

export interface AdminDashboardClientProps {
  locale: AppLocale;
  initialTab?: AdminTab;
}

export function AdminDashboardClient({
  locale,
  initialTab = "metrics",
}: AdminDashboardClientProps) {
  const t = useTranslations("AdminDashboard");
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const tabs: { key: AdminTab; label: string; icon: string }[] = [
    { key: "metrics", label: t("tabMetrics"), icon: "bi-graph-up-arrow" },
    { key: "orders", label: t("tabOrders"), icon: "bi-receipt" },
    { key: "quotas", label: t("tabQuotas"), icon: "bi-calendar-week" },
    { key: "refunds", label: t("tabRefunds"), icon: "bi-arrow-counterclockwise" },
    { key: "reviews", label: t("tabReviews"), icon: "bi-star-fill" },
    { key: "staff", label: t("tabStaff"), icon: "bi-people-fill" },
    { key: "media", label: t("tabMedia"), icon: "bi-images" },
    { key: "inbox", label: t("tabInbox"), icon: "bi-inbox-fill" },
  ];

  return (
    <div className="space-y-8" data-testid="admin-dashboard-client">
      {/* TAB NAVIGATION BAR */}
      <div className="surface-solid-dark p-2 rounded-2xl border border-telaga-700/60 flex flex-wrap items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              data-testid={`admin-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "bg-fajar text-obsidian shadow-md"
                  : "bg-obsidian/40 text-kabut hover:bg-obsidian hover:text-white"
              }`}
            >
              <i className={`bi ${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ACTIVE VIEW */}
      <div>
        {activeTab === "metrics" ? <AdminMetricsView /> : null}
        {activeTab === "orders" ? <AdminOrdersView /> : null}
        {activeTab === "quotas" ? <AdminQuotasTariffsView /> : null}
        {activeTab === "refunds" ? <AdminRefundsView /> : null}
        {activeTab === "reviews" ? <AdminReviewsView /> : null}
        {activeTab === "staff" ? <AdminStaffView /> : null}
        {activeTab === "media" ? (
          <div className="surface-solid-dark p-6 sm:p-8 rounded-2xl border border-telaga-700/60">
            <AdminMediaClient locale={locale} />
          </div>
        ) : null}
        {activeTab === "inbox" ? <AdminInboxView /> : null}
      </div>
    </div>
  );
}

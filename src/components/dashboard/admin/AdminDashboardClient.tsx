"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import {
  DashboardSidebar,
  type DashboardSidebarTabItem,
} from "@/components/dashboard/DashboardSidebar";
import { AdminMetricsView } from "@/components/dashboard/admin/AdminMetricsView";
import { AdminOrdersView } from "@/components/dashboard/admin/AdminOrdersView";
import { AdminQuotasTariffsView } from "@/components/dashboard/admin/AdminQuotasTariffsView";
import { AdminRefundsView } from "@/components/dashboard/admin/AdminRefundsView";
import { AdminReviewsView } from "@/components/dashboard/admin/AdminReviewsView";
import { AdminStaffView } from "@/components/dashboard/admin/AdminStaffView";
import { AdminMediaClient } from "@/components/dashboard/admin/AdminMediaClient";
import { AdminInboxView } from "@/components/dashboard/admin/AdminInboxView";
import { SocialLinksManager } from "@/components/dashboard/shared/SocialLinksManager";
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
  | "social"
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

  const tabs: { key: AdminTab; label: string; icon: string }[] = useMemo(
    () => [
      { key: "metrics", label: t("tabMetrics"), icon: "bi-graph-up-arrow" },
      { key: "orders", label: t("tabOrders"), icon: "bi-receipt" },
      { key: "quotas", label: t("tabQuotas"), icon: "bi-calendar-week" },
      { key: "refunds", label: t("tabRefunds"), icon: "bi-arrow-counterclockwise" },
      { key: "reviews", label: t("tabReviews"), icon: "bi-star" },
      { key: "staff", label: t("tabStaff"), icon: "bi-people" },
      { key: "media", label: t("tabMedia"), icon: "bi-images" },
      { key: "inbox", label: t("tabInbox"), icon: "bi-inbox" },
      { key: "social", label: "Media Sosial & Link", icon: "bi-share" },
      { key: "profile", label: "Profil Admin", icon: "bi-person-gear" },
    ],
    [t]
  );

  const sidebarTabs: DashboardSidebarTabItem[] = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.key,
        label: tab.label,
        icon: tab.icon,
      })),
    [tabs]
  );

  return (
    <div
      className="flex flex-col lg:flex-row min-h-screen"
      data-testid="admin-dashboard-client"
    >
      {/* SIDEBAR NAV DARI KIRI (DESKTOP PERSISTENT + MOBILE DRAWER) */}
      <DashboardSidebar
        role={Role.ADMIN}
        userName={authCtx.user.name}
        userEmail={authCtx.user.email}
        userAvatarImage={authCtx.user.image}
        twoFactorEnabled={authCtx.user.twoFactorEnabled}
        locale={locale}
        tabs={sidebarTabs}
        activeTab={activeTab}
        onSelectTab={(tabId) => setActiveTab(tabId as AdminTab)}
        title="Pusat Kontrol Wisata"
      />

      {/* KONTEN UTAMA DASHBOARD ADMIN */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* HEADER HALAMAN AKTIF */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-telaga-800/60">
          <div>
            <h1 className="font-heading text-xl font-bold text-kabut sm:text-2xl flex items-center gap-2.5">
              <i className={`bi ${tabs.find((t) => t.key === activeTab)?.icon} text-fajar text-lg`} aria-hidden="true" />
              <span>{tabs.find((t) => t.key === activeTab)?.label}</span>
            </h1>
            <p className="mt-0.5 text-xs text-kabut/65">
              Portal Administrasi Operasional Wisata Desa Cupang
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-obsidian border border-telaga-700/60 px-3 py-1.5 text-xs font-mono text-kabut/70">
              Admin: {authCtx.user.name}
            </span>
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
          {activeTab === "social" ? <SocialLinksManager userRole={Role.ADMIN} /> : null}
          {activeTab === "profile" ? <MemberProfileTab authCtx={authCtx} /> : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import {
  DashboardSidebar,
  type DashboardSidebarTabItem,
} from "@/components/dashboard/DashboardSidebar";
import { SuperAdminUsersView } from "@/components/dashboard/super-admin/SuperAdminUsersView";
import { SuperAdminHealthView } from "@/components/dashboard/super-admin/SuperAdminHealthView";
import { SuperAdminAuditView } from "@/components/dashboard/super-admin/SuperAdminAuditView";
import { SuperAdminSettingsView } from "@/components/dashboard/super-admin/SuperAdminSettingsView";
import { SuperAdminSecurityView } from "@/components/dashboard/super-admin/SuperAdminSecurityView";
import type { AuthenticatedContext } from "@/server/auth/guards";

export type SuperAdminTab = "users" | "health" | "audit" | "settings" | "security";

export interface SuperAdminDashboardClientProps {
  locale: AppLocale;
  authCtx?: AuthenticatedContext;
  initialTab?: SuperAdminTab;
}

export function SuperAdminDashboardClient({
  locale,
  authCtx,
  initialTab = "users",
}: SuperAdminDashboardClientProps) {
  const t = useTranslations("SuperAdminDashboard");
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(initialTab);

  const tabs: { key: SuperAdminTab; label: string; icon: string }[] = useMemo(
    () => [
      { key: "users", label: t("tabUsers"), icon: "bi-people" },
      { key: "health", label: t("tabHealth"), icon: "bi-activity" },
      { key: "audit", label: t("tabAudit"), icon: "bi-journal-text" },
      { key: "settings", label: t("tabSettings"), icon: "bi-sliders" },
      { key: "security", label: t("tabSecurity"), icon: "bi-shield-check" },
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
      data-testid="super-admin-dashboard-client"
    >
      {/* SIDEBAR NAV DARI KIRI (DESKTOP PERSISTENT + MOBILE DRAWER) */}
      <DashboardSidebar
        role={authCtx?.user.role ?? Role.SUPER_ADMIN}
        userName={authCtx?.user.name ?? "Super Administrator"}
        userEmail={authCtx?.user.email ?? "root@desacupang.id"}
        userAvatarImage={authCtx?.user.image}
        twoFactorEnabled={authCtx?.user.twoFactorEnabled}
        needsPasswordSetup={authCtx?.user.needsPasswordSetup}
        locale={locale}
        tabs={sidebarTabs}
        activeTab={activeTab}
        onSelectTab={(tabId) => setActiveTab(tabId as SuperAdminTab)}
        title="Otoritas Tertinggi"
      />

      {/* KONTEN UTAMA DASHBOARD SUPER ADMIN */}
      <div className="flex-1 min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* HEADER HALAMAN AKTIF */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-telaga-800/60">
          <div>
            <h1 className="font-heading text-xl font-bold text-kabut sm:text-2xl flex items-center gap-2.5">
              <i className={`bi ${tabs.find((t) => t.key === activeTab)?.icon} text-purple-400 text-lg`} aria-hidden="true" />
              <span>{tabs.find((t) => t.key === activeTab)?.label}</span>
            </h1>
            <p className="mt-0.5 text-xs text-kabut/65">
              Panel Tata Kelola & Kontrol Keamanan Tertinggi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-obsidian border border-telaga-700/60 px-3 py-1.5 text-xs font-mono text-purple-300">
              Super Admin: {authCtx?.user.name ?? "Root"}
            </span>
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
    </div>
  );
}

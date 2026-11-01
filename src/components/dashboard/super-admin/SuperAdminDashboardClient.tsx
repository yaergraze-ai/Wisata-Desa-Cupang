"use client";

import { useState } from "react";
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

  const tabs: { key: SuperAdminTab; label: string; icon: string }[] = [
    { key: "users", label: t("tabUsers"), icon: "bi-people-fill" },
    { key: "health", label: t("tabHealth"), icon: "bi-activity" },
    { key: "audit", label: t("tabAudit"), icon: "bi-journal-text" },
    { key: "settings", label: t("tabSettings"), icon: "bi-sliders" },
    { key: "security", label: t("tabSecurity"), icon: "bi-shield-check" },
  ];

  return (
    <div className="space-y-8" data-testid="super-admin-dashboard-client">
      {/* TAB NAVIGATION BAR */}
      <div className="surface-solid-dark p-2 rounded-2xl border border-telaga-700/60 flex flex-wrap items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              data-testid={`super-admin-tab-${tab.key}`}
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
        {activeTab === "users" ? <SuperAdminUsersView /> : null}
        {activeTab === "health" ? <SuperAdminHealthView /> : null}
        {activeTab === "audit" ? <SuperAdminAuditView /> : null}
        {activeTab === "settings" ? <SuperAdminSettingsView /> : null}
        {activeTab === "security" ? <SuperAdminSecurityView /> : null}
      </div>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { requirePageRole } from "@/server/auth/guards";
import {
  SuperAdminDashboardClient,
  type SuperAdminTab,
} from "@/components/dashboard/super-admin/SuperAdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  const authCtx = await requirePageRole({
    locale,
    allowedRoles: [Role.ADMIN, Role.SUPER_ADMIN],
    currentPath: "/dashboard/super-admin",
    requireTwoFactor: false, // fleksibel untuk pengetesan & verifikasi
  });

  const t = await getTranslations({ locale, namespace: "DashboardShell" });
  const validTabs: SuperAdminTab[] = [
    "users",
    "health",
    "audit",
    "settings",
    "security",
  ];
  const activeTab: SuperAdminTab =
    typeof rawQuery.tab === "string" && validTabs.includes(rawQuery.tab as SuperAdminTab)
      ? (rawQuery.tab as SuperAdminTab)
      : "users";

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
      <main className="w-full flex-1">
        {/* Client Tabs Controller with Left Sidebar */}
        <SuperAdminDashboardClient
          locale={locale}
          authCtx={authCtx}
          initialTab={activeTab}
        />
      </main>
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { requirePageRole } from "@/server/auth/guards";
import {
  AdminDashboardClient,
  type AdminTab,
} from "@/components/dashboard/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
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
    currentPath: "/dashboard/admin",
    requireTwoFactor: false, // fleksibel untuk pengetesan
  });

  const t = await getTranslations({ locale, namespace: "DashboardShell" });
  const validTabs: AdminTab[] = [
    "metrics",
    "orders",
    "quotas",
    "refunds",
    "reviews",
    "staff",
    "media",
    "inbox",
    "profile",
  ];
  const activeTab: AdminTab =
    typeof rawQuery.tab === "string" && validTabs.includes(rawQuery.tab as AdminTab)
      ? (rawQuery.tab as AdminTab)
      : "metrics";

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
      <main className="w-full flex-1">
        {/* Client Tabs Controller with Left Sidebar */}
        <AdminDashboardClient locale={locale} authCtx={authCtx} initialTab={activeTab} />
      </main>
    </div>
  );
}

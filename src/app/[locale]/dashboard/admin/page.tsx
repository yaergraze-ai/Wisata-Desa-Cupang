import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { requirePageRole } from "@/server/auth/guards";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
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
  ];
  const activeTab: AdminTab =
    typeof rawQuery.tab === "string" && validTabs.includes(rawQuery.tab as AdminTab)
      ? (rawQuery.tab as AdminTab)
      : "metrics";

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
      <DashboardTopBar locale={locale} authCtx={authCtx} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <section className="surface-solid-dark p-6 sm:p-8 rounded-2xl border border-telaga-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-kabut">
              {t("welcome", { name: authCtx.user.name })}
            </h1>
            <p className="mt-1 text-sm text-kabut/85">{t("adminReadyDesc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-hutan border border-fajar/30 px-3 py-1 text-xs font-bold text-fajar">
              {t("roleLabel", { role: authCtx.user.role })}
            </span>
          </div>
        </section>

        {/* Client Tabs Controller */}
        <AdminDashboardClient locale={locale} initialTab={activeTab} />
      </main>
    </div>
  );
}

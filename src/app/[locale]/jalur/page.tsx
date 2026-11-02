import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getPublicCatalogData } from "@/server/catalog/public-catalog";
import { getRoleHomePath, getServerAuthContext } from "@/server/auth/guards";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { MobileNotificationPrompt } from "@/components/public/MobileNotificationPrompt";
import { TrailNavigatorClient } from "@/components/trail/TrailNavigatorClient";
import { ContactAndFooterSection } from "@/components/public/ContactAndFooterSection";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("trailMapTitle"),
    description: t("homeDescription"),
    alternates: {
      canonical: locale === "id" ? "/jalur" : "/en/jalur",
      languages: {
        id: "/jalur",
        en: "/en/jalur",
        "x-default": "/jalur",
      },
    },
  };
}

export default async function TrailNavigatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  const [catalog, authCtx] = await Promise.all([
    getPublicCatalogData(locale),
    getServerAuthContext(),
  ]);

  const offTrailThresholdM =
    Number.parseInt(catalog.settings["offTrailThresholdM"] ?? "", 10) || 35;

  const managerWhatsappDisplay =
    catalog.settings["managerWhatsappDisplay"] ?? "0857-2490-8800";
  const managerWhatsappDigits =
    catalog.settings["managerWhatsappDigits"] ?? "6285724908800";
  const managerEmail =
    catalog.settings["officialEmail"] ??
    catalog.settings["managerEmail"] ??
    "kontak@wisatacirebon.id";

  return (
    <div className="flex min-h-dvh flex-col bg-obsidian text-kabut">
      <MobileNotificationPrompt />
      <PublicNavbar
        user={
          authCtx
            ? {
                name: authCtx.user.name,
                dashboardPath: getRoleHomePath(authCtx.user.role),
              }
            : null
        }
      />

      <main className="flex-1 bg-obsidian bg-topo-contour px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <TrailNavigatorClient
            offTrailThresholdM={offTrailThresholdM}
          />
        </div>
      </main>

      <ContactAndFooterSection
        locale={locale}
        managerWhatsappDisplay={managerWhatsappDisplay}
        managerWhatsappDigits={managerWhatsappDigits}
        managerEmail={managerEmail}
        footerMedia={catalog.mediaSlots["footer"]}
        tiktokUrl={catalog.settings["socialTiktokUrl"]}
        instagramUrl={catalog.settings["socialInstagramUrl"]}
      />
    </div>
  );
}

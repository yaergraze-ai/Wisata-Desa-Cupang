import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import {
  getServerAuthContext,
  sanitizeNextPath,
} from "@/server/auth/guards";
import { AuthShell } from "@/components/auth/AuthShell";
import { TwoFactorClient } from "@/components/auth/TwoFactorClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale === "en" ? "en" : "id",
    namespace: "Meta",
  });
  return { title: t("twoFactorTitle") };
}

export default async function TwoFactorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ setup?: string; next?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const sp = await searchParams;
  const nextPath = sanitizeNextPath(sp.next);

  const session = await getServerAuthContext();
  const isSetup =
    sp.setup === "1" || Boolean(session && !session.user.twoFactorEnabled);
  const isMandatoryAdmin = Boolean(
    session &&
      (session.user.role === Role.ADMIN ||
        session.user.role === Role.SUPER_ADMIN)
  );

  const t = await getTranslations({ locale, namespace: "Auth" });

  return (
    <AuthShell
      locale={locale}
      heading={
        isSetup ? t("twoFactorSetupHeading") : t("twoFactorVerifyHeading")
      }
      subheading={
        isSetup ? t("twoFactorSetupStep1") : t("twoFactorVerifySubheading")
      }
    >
      <TwoFactorClient
        mode={isSetup ? "setup" : "verify"}
        isMandatoryAdmin={isMandatoryAdmin}
        nextPath={nextPath}
      />
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getIntegrationFlags } from "@/server/env";
import {
  getRoleHomePath,
  getServerAuthContext,
  sanitizeNextPath,
} from "@/server/auth/guards";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

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
  return { title: t("loginTitle") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const sp = await searchParams;
  const nextPath = sanitizeNextPath(sp.next);

  const session = await getServerAuthContext();
  if (session) {
    redirect({
      href: nextPath || getRoleHomePath(session.user.role),
      locale,
    });
  }

  const t = await getTranslations({ locale, namespace: "Auth" });
  const flags = getIntegrationFlags();

  return (
    <AuthShell
      locale={locale}
      heading={t("loginHeading")}
      subheading={t("loginSubheading")}
    >
      <LoginForm
        nextPath={nextPath}
        googleEnabled={flags.googleOAuth}
        facebookEnabled={flags.facebookOAuth}
        whatsappEnabled={flags.whatsapp}
      />
    </AuthShell>
  );
}

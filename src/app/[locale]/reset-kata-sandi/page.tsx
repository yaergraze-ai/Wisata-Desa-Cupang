import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

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
  return { title: t("forgotTitle") };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return (
    <AuthShell
      locale={locale}
      heading={t("resetHeading")}
      subheading={t("resetSubheading")}
    >
      <ResetPasswordForm token={sp.token ?? null} />
    </AuthShell>
  );
}

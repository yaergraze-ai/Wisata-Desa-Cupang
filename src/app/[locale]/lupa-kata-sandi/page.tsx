import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { getIntegrationFlags } from "@/server/env";
import { db } from "@/server/db";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

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

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  const [t, managerWa] = await Promise.all([
    getTranslations({ locale, namespace: "Auth" }),
    db.siteSetting.findUnique({ where: { key: "managerWhatsapp" } }),
  ]);

  const flags = getIntegrationFlags();
  const waDigits = (managerWa?.value || "+6281224001001").replace(/[^\d]/g, "");

  return (
    <AuthShell
      locale={locale}
      heading={t("forgotHeading")}
      subheading={t("forgotSubheading")}
    >
      <ForgotPasswordForm
        smtpEnabled={flags.smtpEmail}
        managerWaDigits={waDigits}
      />
    </AuthShell>
  );
}

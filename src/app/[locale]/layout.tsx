import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/public/AmbientBackground";
import { DeferredToaster } from "@/components/shared/DeferredToaster";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
  const t = await getTranslations({ locale: validLocale, namespace: "Meta" });
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: t("homeTitle"),
      template: `%s | ${t("siteName")}`,
    },
    description: t("homeDescription"),
    alternates: {
      canonical: validLocale === "id" ? "/" : "/en",
      languages: {
        id: "/",
        en: "/en",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      locale: validLocale === "en" ? "en_US" : "id_ID",
      siteName: t("siteName"),
      title: t("homeTitle"),
      description: t("homeDescription"),
      images: ["/media/defaults/hero.webp"],
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Wisata Cirebon",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className="bg-obsidian text-kabut antialiased selection:bg-fajar selection:text-hutan-950 min-h-dvh relative">
        <AmbientBackground />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <ServiceWorkerRegister />
          <DeferredToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

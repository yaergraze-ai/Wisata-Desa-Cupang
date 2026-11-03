import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/public/AmbientBackground";
import { DeferredToaster } from "@/components/shared/DeferredToaster";
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
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
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');document.documentElement.setAttribute('data-theme','dark');if(localStorage.getItem('wdc_cinematic_intro_seen')==='true'||document.cookie.indexOf('wdc_intro_seen=true')!==-1){document.documentElement.classList.add('wdc-intro-dismissed');if(document.cookie.indexOf('wdc_intro_seen=true')===-1){document.cookie='wdc_intro_seen=true; path=/; max-age=31536000; SameSite=Lax';}}}catch(e){}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html.wdc-intro-dismissed #wdc-cinematic-intro { display: none !important; }
              html:not(.wdc-intro-dismissed) { overflow: hidden; }
              #wdc-cinematic-intro {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: radial-gradient(circle at 50% 38%, #14281e 0%, #08120c 60%, #030604 100%);
                width: 100vw;
                height: 100vh;
                overflow: hidden;
              }
            `,
          }}
        />
        <link
          rel="preload"
          href="/fonts/bootstrap-icons.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-obsidian text-kabut antialiased selection:bg-fajar selection:text-hutan-950 min-h-dvh relative transition-colors duration-200">
        <AmbientBackground />
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
            <ServiceWorkerRegister />
            <DeferredToaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";

export async function AuthShell({
  locale,
  heading,
  subheading,
  children,
}: {
  locale: AppLocale;
  heading: string;
  subheading: string;
  children: React.ReactNode;
}) {
  const [tNav, tAuth] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Auth" }),
  ]);

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
      <header className="sticky top-0 z-40 border-b border-kabut/15 bg-obsidian/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-fajar backdrop-blur-md shadow-sm">
              <i className="bi bi-compass text-lg" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-fajar shadow-[0_0_10px_#f2a65a] animate-pulse" />
            </span>
            <div className="shrink-0 leading-tight">
              <p className="font-heading text-sm sm:text-base font-bold text-kabut whitespace-nowrap">
                {tNav("brandTitle")}
              </p>
              <p className="hidden sm:block text-xs text-kabut/80 whitespace-nowrap">{tNav("brandSubtitle")}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Suspense fallback={null}>
              <LocaleSwitcher />
            </Suspense>
            <Link href="/" className="btn-ui btn-glass whitespace-nowrap shrink-0 px-3 py-2 text-xs sm:text-sm">

              <span>{tAuth("backToHome")}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-lg surface-solid-dark p-6 sm:p-8">
          <div className="mb-6 border-b border-kabut/15 pb-5">
            <h1 className="font-heading text-2xl font-bold text-kabut">
              {heading}
            </h1>
            <p className="mt-1.5 text-sm text-kabut/85">{subheading}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

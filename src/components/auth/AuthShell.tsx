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
      <header className="border-b border-kabut/15 bg-obsidian/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-hutan border border-telaga-700 text-fajar">
              <i className="bi bi-compass text-lg" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-base font-bold leading-tight text-kabut">
                {tNav("brandTitle")}
              </p>
              <p className="text-xs text-kabut/80">{tNav("brandSubtitle")}</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <LocaleSwitcher />
            </Suspense>
            <Link href="/" className="btn-ui btn-glass">
              <i className="bi bi-arrow-left" aria-hidden="true" />
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

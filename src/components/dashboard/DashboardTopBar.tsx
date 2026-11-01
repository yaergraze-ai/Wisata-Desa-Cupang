import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Role } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { AuthenticatedContext } from "@/server/auth/guards";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { GoogleFirstTimeSetupModal } from "@/components/auth/GoogleFirstTimeSetupModal";

export async function DashboardTopBar({
  locale,
  authCtx,
}: {
  locale: AppLocale;
  authCtx: AuthenticatedContext;
}) {
  const [tNav, tDash] = await Promise.all([
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "DashboardShell" }),
  ]);

  const roleLabel =
    authCtx.user.role === Role.SUPER_ADMIN
      ? tDash("roleSuperAdmin")
      : authCtx.user.role === Role.ADMIN
      ? tDash("roleAdmin")
      : authCtx.user.role === Role.STAFF
      ? tDash("roleStaff")
      : tDash("roleMember");

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-kabut/15 bg-obsidian/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-fajar backdrop-blur-md shadow-sm">
                <i className="bi bi-compass text-lg" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-fajar shadow-[0_0_10px_#f2a65a] animate-pulse" />
              </span>
              <div className="shrink-0">
                <p className="font-heading text-base font-bold leading-tight text-kabut whitespace-nowrap">
                  {tNav("brandTitle")}
                </p>
                <p className="text-xs text-kabut/75 whitespace-nowrap">{roleLabel}</p>
              </div>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-telaga bg-hutan px-3 py-1 text-xs font-bold text-fajar">
              <i className="bi bi-person-badge-fill" aria-hidden="true" />
              <span>{roleLabel}</span>
            </span>

            {authCtx.user.twoFactorEnabled ? (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-telaga-400/40 bg-telaga-950 px-2.5 py-1 text-xs font-semibold text-telaga-200">
                <i className="bi bi-shield-fill-check" aria-hidden="true" />
                <span>{tDash("twoFactorActive")}</span>
              </span>
            ) : (
              <Link
                href="/verifikasi-2fa?setup=1"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-kabut/25 bg-hutan/70 px-2.5 py-1 text-xs font-semibold text-kabut hover:border-fajar"
              >
                <i className="bi bi-shield-plus" aria-hidden="true" />
                <span>{tDash("twoFactorOptionalSetup")}</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Suspense fallback={null}>
              <LocaleSwitcher />
            </Suspense>
            <Link
              href="/"
              className="btn-ui group relative inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-gradient-to-r from-sky-500/10 via-sky-400/5 to-transparent px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm font-bold text-sky-200 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-400/70 hover:bg-sky-500/20 hover:text-white hover:shadow-[0_0_24px_rgba(56,189,248,0.35)] active:translate-y-0"
              title={tDash("publicHomeLink")}
            >
              <i className="bi bi-house-door-fill text-sky-400 group-hover:scale-110 transition-transform duration-200" aria-hidden="true" />
              <span className="hidden sm:inline">{tDash("publicHomeLink")}</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <GoogleFirstTimeSetupModal />
    </>
  );
}

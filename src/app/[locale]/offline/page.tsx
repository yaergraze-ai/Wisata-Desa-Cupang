import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function OfflineFallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const [tOffline, tLegal] = await Promise.all([
    getTranslations({ locale, namespace: "Offline" }),
    getTranslations({ locale, namespace: "Legal" }),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-obsidian bg-topo-contour px-4 py-12 text-center text-kabut sm:px-6">
      <div className="w-full max-w-lg rounded-3xl border-2 border-telaga-500/50 bg-hutan/90 p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fajar bg-obsidian text-3xl text-fajar">
          <i className="bi bi-wifi-off" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-black text-kabut sm:text-3xl">
            {tOffline("title")}
          </h1>
          <p className="text-sm text-kabut/85 leading-relaxed">
            {tOffline("subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/dashboard"
            className="btn-ui btn-fajar py-3.5 text-sm font-black"
          >
            <i className="bi bi-wallet2" aria-hidden="true" />
            <span>{tOffline("walletBtn")}</span>
          </Link>

          <Link
            href="/jalur"
            className="btn-ui btn-telaga py-3.5 text-sm font-black"
          >
            <i className="bi bi-compass-fill" aria-hidden="true" />
            <span>{tOffline("mapBtn")}</span>
          </Link>

          <Link
            href="/"
            className="btn-ui btn-glass py-3 text-xs font-bold"
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>{tLegal("backHome")}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

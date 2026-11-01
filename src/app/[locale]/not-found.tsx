import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-obsidian bg-topo-contour px-4 py-16 text-center text-kabut sm:px-6">
      <div className="w-full max-w-md surface-solid-dark p-8 sm:p-10 rounded-3xl border border-telaga-700/60 shadow-2xl space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-fajar/40 bg-fajar/10 text-3xl font-black text-fajar font-heading">
          404
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-kabut">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-kabut/80 leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link href="/" className="btn-ui btn-fajar justify-center py-3 text-xs font-bold">
            <i className="bi bi-house-door-fill" aria-hidden="true" />
            <span>{t("backHome")}</span>
          </Link>
          <Link href="/jalur" className="btn-ui btn-glass justify-center py-2.5 text-xs font-semibold">
            <i className="bi bi-compass-fill" aria-hidden="true" />
            <span>{t("exploreTrail")}</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

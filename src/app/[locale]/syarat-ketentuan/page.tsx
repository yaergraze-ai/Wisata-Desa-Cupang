import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("termsTitle"),
    description: t("termsDescription"),
    alternates: {
      canonical: locale === "id" ? "/syarat-ketentuan" : "/en/syarat-ketentuan",
      languages: {
        id: "/syarat-ketentuan",
        en: "/en/syarat-ketentuan",
        "x-default": "/syarat-ketentuan",
      },
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";
  const [tMeta, tLegal] = await Promise.all([
    getTranslations({ locale, namespace: "Meta" }),
    getTranslations({ locale, namespace: "Legal" }),
  ]);

  return (
    <main className="min-h-dvh bg-obsidian bg-topo-contour px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl surface-solid-dark p-6 sm:p-10 space-y-8">
        {/* Banner Rujukan Hukum Bahasa Indonesia */}
        <div className="rounded-xl border border-fajar/50 bg-fajar/15 px-4 py-3 text-xs font-semibold text-fajar flex items-start gap-2.5">
          <i className="bi bi-file-earmark-text-fill text-base shrink-0 mt-0.5" aria-hidden="true" />
          <span>{tLegal("governingNotice")}</span>
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-kabut sm:text-3xl">
            {tMeta("termsTitle")}
          </h1>
          <p className="mt-2 text-xs text-kabut/70">
            {tLegal("termsIntro")}
          </p>
        </div>

        <div className="divide-y divide-telaga-700/40 space-y-6 text-sm text-kabut/90 leading-relaxed">
          {/* Bagian 1: Tata Tertib Kawasan */}
          <section className="pt-6 space-y-2">
            <h2 className="font-heading text-base font-bold text-fajar">
              {tLegal("termsRulesTitle")}
            </h2>
            <p>{tLegal("termsRules")}</p>
          </section>

          {/* Bagian 2: Kebijakan Akses Tiket */}
          <section className="pt-6 space-y-2">
            <h2 className="font-heading text-base font-bold text-fajar">
              {tLegal("termsAdmissionTitle")}
            </h2>
            <p>{tLegal("termsAdmission")}</p>
          </section>

          {/* Bagian 3: Kebijakan Refund & Pembatalan */}
          <section className="pt-6 space-y-2">
            <h2 className="font-heading text-base font-bold text-fajar">
              {tLegal("termsRefundDetailTitle")}
            </h2>
            <p>{tLegal("termsRefundDetail")}</p>
            <p className="text-xs text-kabut/75 mt-1">{tLegal("termsRefund")}</p>
          </section>

          {/* Bagian 4: Keselamatan & Keadaan Kahar */}
          <section className="pt-6 space-y-2">
            <h2 className="font-heading text-base font-bold text-fajar">
              {tLegal("termsSafetyTitle")}
            </h2>
            <p>{tLegal("termsSafety")}</p>
          </section>
        </div>

        <div className="pt-4 border-t border-telaga-700/60 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="btn-ui btn-fajar">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>{tLegal("backHome")}</span>
          </Link>
          <Link href="/kebijakan-privasi" className="text-xs font-semibold text-telaga-200 hover:text-white underline underline-offset-4">
            {tMeta("privacyTitle")}
          </Link>
        </div>
      </div>
    </main>
  );
}

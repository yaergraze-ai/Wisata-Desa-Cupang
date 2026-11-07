import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { ContactFormCard } from "@/components/public/ContactFormCard";
import type { PublicSlotMedia } from "@/server/catalog/public-catalog";

export interface ContactAndFooterSectionProps {
  locale: AppLocale;
  managerWhatsappDisplay: string;
  managerWhatsappDigits: string;
  managerEmail: string;
  footerMedia: PublicSlotMedia | undefined;
  tiktokUrl?: string;
  instagramUrl?: string;
}

export async function ContactAndFooterSection({
  locale,
  managerWhatsappDisplay,
  managerWhatsappDigits,
  managerEmail,
  footerMedia,
  tiktokUrl,
  instagramUrl,
}: ContactAndFooterSectionProps) {
  const [tContact, tNav, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: "Contact" }),
    getTranslations({ locale, namespace: "Nav" }),
    getTranslations({ locale, namespace: "Footer" }),
  ]);

  return (
    <>
      {/* Seksi Kontak Resmi & Formulir Kotak Masuk Admin (§6.H) */}
      <section
        id="kontak"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 scroll-mt-24"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-wider text-fajar uppercase">
            {tContact("eyebrow")}
          </p>
          <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
            {tContact("heading")}
          </h2>
          <p className="mt-2 text-sm text-kabut/85">{tContact("lead")}</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Kartu Kontak Langsung dari SiteSetting DB */}
          <div className="surface-solid-dark p-6 flex flex-col justify-between gap-6 lg:col-span-5">
            <div>
              <h3 className="font-heading text-xl font-bold text-kabut">
                {tContact("directCardTitle")}
              </h3>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-kabut/75">
                    {tContact("locationLabel")}
                  </dt>
                  <dd className="mt-1 font-medium text-kabut">
                    {tContact("locationValue")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-kabut/75">
                    {tContact("whatsappLabel")}
                  </dt>
                  <dd className="mt-1 font-mono font-bold text-fajar">
                    {managerWhatsappDisplay}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-kabut/75">
                    {tContact("emailLabel")}
                  </dt>
                  <dd className="mt-1 font-medium text-kabut">{managerEmail}</dd>
                </div>
              </dl>
            </div>

            <a
              href={`https://wa.me/${managerWhatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full btn-ui btn-telaga"
            >
              <i className="bi bi-whatsapp text-base" aria-hidden="true" />
              <span>{tContact("openWaBtn")}</span>
            </a>
          </div>

          {/* Formulir Kontak Rate-Limited + Honeypot */}
          <ContactFormCard />
        </div>
      </section>

      {/* Footer Lanskap dengan Slot Media "footer" & Pengalih Bahasa (§6.A & §6.J) */}
      <footer className="relative overflow-hidden border-t border-kabut/15 bg-hutan-950 pt-14 pb-28 lg:pb-14">
        {footerMedia ? (
          <Image
            src={footerMedia.url}
            alt={footerMedia.alt}
            fill
            sizes="100vw"
            className="object-cover opacity-25"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-obsidian via-hutan-950/90 to-hutan-950/80" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-hutan border border-telaga-700 text-fajar">
                  <i className="bi bi-compass text-lg" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-heading text-lg font-bold text-kabut">
                    {tNav("brandTitle")}
                  </p>
                  <p className="text-xs text-kabut/80">{tNav("brandSubtitle")}</p>
                </div>
              </div>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-kabut/80">
                {tFooter("tagline")}
              </p>

              {/* Tautan Resmi Media Sosial Desa Wisata */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <a
                  href={instagramUrl || "https://www.instagram.com/wisatadesacupang"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-kabut hover:text-pink-400 hover:border-pink-500/40 hover:bg-pink-500/10 transition-all"
                  title="Kunjungi Instagram Resmi Wisata Desa Cupang"
                >
                  <i className="bi bi-instagram text-sm text-pink-400" aria-hidden="true" />
                  <span>Instagram</span>
                </a>
                <a
                  href={tiktokUrl || "https://www.tiktok.com/@desacupang_official"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-kabut hover:text-sky-400 hover:border-sky-500/40 hover:bg-sky-500/10 transition-all"
                  title="Kunjungi TikTok Resmi Wisata Desa Cupang"
                >
                  <i className="bi bi-tiktok text-sm text-sky-400" aria-hidden="true" />
                  <span>TikTok</span>
                </a>
              </div>
            </div>

            <div className="md:col-span-3">
              <p className="font-heading text-sm font-bold text-kabut">
                {tFooter("quickLinksHeading")}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-kabut/85">
                <li>
                  <a href="#jalur-aturan" className="hover:text-fajar">
                    {tNav("trail")}
                  </a>
                </li>
                <li>
                  <a href="#kalkulator-tiket" className="hover:text-fajar">
                    {tNav("buyTicket")}
                  </a>
                </li>
                <li>
                  <Link href="/jalur" className="hover:text-fajar">
                    {tNav("map")}
                  </Link>
                </li>
                <li>
                  <a href="#petugas-siaga" className="hover:text-fajar">
                    {tNav("staff")}
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <p className="font-heading text-sm font-bold text-kabut">
                {tFooter("legalHeading")}
              </p>
              <ul className="mt-3 space-y-2 text-xs text-kabut/85">
                <li>
                  <Link href="/kebijakan-privasi" className="hover:text-fajar">
                    {tFooter("privacy")}
                  </Link>
                </li>
                <li>
                  <Link href="/syarat-ketentuan" className="hover:text-fajar">
                    {tFooter("terms")}
                  </Link>
                </li>
              </ul>
              <div className="mt-4">
                <LocaleSwitcher />
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-4 border-t border-kabut/15 pt-6 text-xs text-kabut/75 sm:flex-row sm:items-center">
            <p>{tFooter("copyright", { year: new Date().getFullYear() })}</p>
            <a
              href={`https://wa.me/${managerWhatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ui btn-telaga w-fit"
            >
              <i className="bi bi-whatsapp" aria-hidden="true" />
              <span>{tFooter("whatsappManager")}</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

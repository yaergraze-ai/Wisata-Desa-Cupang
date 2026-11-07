import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { GateType } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { formatRupiah } from "@/lib/currency";
import { addDaysToYmd, formatVisitDateDisplay } from "@/lib/datetime-wib";
import { getPublicCatalogData } from "@/server/catalog/public-catalog";
import { getRoleHomePath, getServerAuthContext } from "@/server/auth/guards";
import { calculateServerOrderQuote } from "@/server/pricing/quote-service";
import { getPublicStaffStatusData } from "@/server/staff/staff-availability";
import { getPublicReviewsData } from "@/server/reviews/public-reviews";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { CinematicIntro } from "@/components/public/CinematicIntro";
import { MobileNotificationPrompt } from "@/components/public/MobileNotificationPrompt";
import { HeroGallery } from "@/components/public/HeroGallery";
import { TrailTimelineAndMapSection } from "@/components/public/TrailTimelineAndMapSection";
import { PriceQuotaCalculator } from "@/components/public/PriceQuotaCalculator";
import { ProductSelectButton } from "@/components/public/ProductSelectButton";
import { StaffOnDutySection } from "@/components/public/StaffOnDutySection";
import { VerifiedReviewsSection } from "@/components/public/VerifiedReviewsSection";
import { TouristSpotGallerySection } from "@/components/public/TouristSpotGallerySection";
import { ContactAndFooterSection } from "@/components/public/ContactAndFooterSection";
import { getGalleryItems } from "@/server/gallery/gallery-service";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  const [
    tHero,
    tHome,
    tFac,
    catalog,
    authCtx,
    staffStatus,
    reviewsData,
    galleryItems,
    cookieStore,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "Hero" }),
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Facilities" }),
    getPublicCatalogData(locale),
    getServerAuthContext(),
    getPublicStaffStatusData(locale),
    getPublicReviewsData({ filter: "all", locale, limit: 12 }),
    getGalleryItems(),
    cookies(),
  ]);

  const hasSeenIntro = cookieStore.get("wdc_intro_seen")?.value === "true";

  const todayQuote = await calculateServerOrderQuote({
    visitDate: catalog.todayYmd,
    regulerQty: 0,
    putihQty: 2,
    locale,
  });

  const initialQuote =
    todayQuote.blockingCode === "SAME_DAY_CUTOFF"
      ? await calculateServerOrderQuote({
            visitDate: addDaysToYmd(catalog.todayYmd, 1),
            regulerQty: 0,
            putihQty: 2,
            locale,
          })
      : todayQuote;

  const offTrailThresholdM =
    Number.parseInt(catalog.settings["offTrailThresholdM"] ?? "", 10) ||
    initialQuote.sameDayCloseBufferMinutes;
  const managerWhatsappDisplay =
    catalog.settings["managerWhatsapp"] || "+6281224001001";
  const managerWhatsappDigits = managerWhatsappDisplay.replace(/[^\d]/g, "");
  const managerEmail =
    catalog.settings["managerEmail"] || "pengelola@wisatacirebon.id";

  const destinationNameBySlug = new Map(
    catalog.destinations.map((d) => [d.slug, d.name])
  );

  const navbarUser = authCtx
    ? {
        name: authCtx.user.name,
        image: authCtx.user.image,
        dashboardPath: getRoleHomePath(authCtx.user.role),
      }
    : null;

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour pb-20 lg:pb-0">
      {!hasSeenIntro ? <CinematicIntro /> : null}
      <MobileNotificationPrompt />
      <PublicNavbar user={navbarUser} />

      <main id="konten-utama" className="flex-1">
        {/* 1. Satu Galeri Hero Terpadu Berbasis GSAP + Panel Tiket Kaca (§7.1) */}
        <div id="beranda" className="scroll-mt-24">
          <HeroGallery
            locale={locale}
            todayYmd={catalog.todayYmd}
            offTrailThresholdM={
              Number.parseInt(catalog.settings["offTrailThresholdM"] ?? "", 10) ||
              offTrailThresholdM
            }
            destinations={catalog.destinations}
            products={catalog.products}
            trailPoints={catalog.trailPoints}
            mediaSlots={catalog.mediaSlots}
          />
        </div>

        {/* 2. Pilihan Tiket Resmi (Tiket Putih vs Tiket Reguler) & Kalkulator Kuota Server — Tepat Setelah Hero/Card (§6.A & §7.3) */}
        <section
          id="pilihan-tiket"
          className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 scroll-mt-24 space-y-10 sm:space-y-14"
        >
          <div>
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl font-bold text-kabut sm:text-3xl">
                {tHome("productsHeading")}
              </h2>
              <p className="mt-2 text-sm text-kabut/85">
                {tHome("productsLead")}
              </p>
            </div>

            <div className="mt-6 sm:mt-8 grid gap-5 sm:gap-6 md:grid-cols-2">
              {catalog.products.map((prod) => {
                const isPutih = prod.code === "TIKET_PUTIH";
                return (
                  <article
                    key={prod.id}
                    className={
                      isPutih
                        ? "group ticket-card-putih p-5 sm:p-7 flex flex-col justify-between gap-5 sm:gap-6 transition-transform duration-300 hover:-translate-y-1"
                        : "group ticket-card-reguler p-5 sm:p-7 flex flex-col justify-between gap-5 sm:gap-6 transition-transform duration-300 hover:-translate-y-1"
                    }
                  >
                    <div>
                      <span
                        className={
                          isPutih
                            ? "inline-flex items-center gap-1.5 rounded-full bg-hutan px-3.5 py-1 text-xs font-bold text-fajar shadow-sm"
                            : "inline-flex items-center gap-1.5 rounded-full bg-obsidian/80 border border-telaga px-3.5 py-1 text-xs font-semibold text-kabut shadow-sm"
                        }
                      >
                        <i
                          className="bi bi-patch-check-fill"
                          aria-hidden="true"
                        />
                        <span>
                          {isPutih
                            ? tHome("whiteTicketTag")
                            : tHome("regularTicketTag")}
                        </span>
                      </span>

                      <h3 className="mt-3 font-heading text-xl font-bold sm:text-2xl">
                        {prod.name}
                      </h3>
                      <p
                        className={
                          isPutih
                            ? "mt-2 text-sm text-batu-800"
                            : "mt-2 text-sm text-kabut/85"
                        }
                      >
                        {prod.description}
                      </p>
                    </div>

                    <div>
                      <div className="ticket-perforation-divider my-4" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="font-heading text-2xl sm:text-3xl font-extrabold">
                            {formatRupiah(prod.totalPrice, locale)}
                          </p>
                          <p
                            className={
                              isPutih
                                ? "text-xs font-semibold text-batu-700"
                                : "text-xs text-kabut/80"
                            }
                          >
                            {tHero("basePlusParking", {
                              base: formatRupiah(prod.basePrice, locale),
                              parking: formatRupiah(prod.parkingFee, locale),
                            })}{" "}
                            • {tHome("perPerson")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <p
                            className={
                              isPutih
                                ? "text-xs font-bold text-telaga-800"
                                : "text-xs font-bold text-fajar"
                            }
                          >
                            {tHome("allowedGatesLabel")}:
                          </p>
                          <ul className="mt-1.5 flex flex-wrap gap-2 text-xs font-semibold">
                            {prod.allowedGates.map((g) => (
                              <li
                                key={g}
                                className={
                                  isPutih
                                    ? "rounded-md bg-hutan/10 border border-hutan/25 px-2.5 py-1 text-hutan"
                                    : "rounded-md bg-obsidian/70 border border-kabut/20 px-2.5 py-1 text-kabut"
                                }
                              >
                                {g === GateType.GERBANG_BATU_LAWANG
                                  ? tHome("gateBatuLawang")
                                  : tHome("gateGunungBendera")}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p
                            className={
                              isPutih
                                ? "text-xs font-bold text-telaga-800"
                                : "text-xs font-bold text-fajar"
                            }
                          >
                            {tHome("consumedQuotasLabel")}:
                          </p>
                          <ul className="mt-1.5 flex flex-wrap gap-2 text-xs font-semibold">
                            {prod.consumesDestinations.map((slug) => (
                              <li
                                key={slug}
                                className={
                                  isPutih
                                    ? "rounded-md bg-telaga-800 text-kabut px-2.5 py-1"
                                    : "rounded-md bg-hutan-950 border border-telaga-700 text-kabut px-2.5 py-1"
                                }
                              >
                                {destinationNameBySlug.get(slug) ?? slug}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-6">
                        <ProductSelectButton
                          packageCode={isPutih ? "TIKET_PUTIH" : "REGULER_BL"}
                          label={
                            isPutih
                              ? tHome("selectWhiteCta")
                              : tHome("selectRegularCta")
                          }
                          className={
                            isPutih
                              ? "w-full btn-ui btn-hutan"
                              : "w-full btn-ui btn-fajar"
                          }
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Kalkulator Harga & Cek Kuota Server */}
          <PriceQuotaCalculator locale={locale} initialQuote={initialQuote} />
        </section>

        {/* 3. Spot & Galeri Foto Pengunjung */}
        <div className="section-cv-auto">
          <TouristSpotGallerySection
            initialItems={galleryItems}
            userRole={authCtx?.user.role}
            userName={authCtx?.user.name}
          />
        </div>

        {/* 4. Tentang Destinasi, Aturan Resmi Gerbang, Linimasa SVG & Fasilitas Kawasan (§6.A & §7.2) */}
        <section
          id="jalur-aturan"
          className="section-cv-auto mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 scroll-mt-24 space-y-10 sm:space-y-14"
        >
          {/* Kartu Destinasi & Kuota Harian Langsung */}
          <div>
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl font-bold text-kabut sm:text-3xl">
                {tHome("destinationsHeading")}
              </h2>
              <p className="mt-2 text-sm text-kabut/85">
                {tHome("destinationsLead")}
              </p>
            </div>

            <div className="mt-6 sm:mt-8 grid gap-5 sm:gap-6 md:grid-cols-2">
              {catalog.destinations.map((dest) => {
                const isBendera = dest.slug === "gunung-bendera";
                return (
                  <article
                    key={dest.id}
                    className="group surface-solid-dark p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:-translate-y-1 hover:border-fajar/45 hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fajar/40 bg-gradient-to-br from-fajar/25 via-hutan to-obsidian text-fajar shadow-[0_8px_20px_rgba(242,166,90,0.2)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                            <i
                              className={
                                isBendera
                                  ? "bi bi-brightness-high-fill text-lg"
                                  : "bi bi-compass-fill text-lg"
                              }
                              aria-hidden="true"
                            />
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_8px_#f2a65a]" />
                          </span>
                          <h3 className="font-heading text-xl font-bold text-kabut">
                            {dest.name}
                          </h3>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-obsidian/90 border border-telaga-700 px-3 py-1.5 text-xs font-semibold text-fajar shadow-sm">
                          <i
                            className="bi bi-arrow-up-right-circle"
                            aria-hidden="true"
                          />
                          <span>
                            {tHero("elevationUnit", { value: dest.elevationM })}
                          </span>
                        </span>
                      </div>
                      <p className="mt-3.5 text-sm text-kabut/85 leading-relaxed">
                        {dest.description}
                      </p>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 border-t border-kabut/15 pt-4 text-xs">
                      <div>
                        <dt className="text-kabut/75">{tHero("hoursLabel")}</dt>
                        <dd className="mt-1 font-semibold text-kabut">
                          {dest.openTime}–{dest.closeTime} WIB
                        </dd>
                      </div>
                      <div>
                        <dt className="text-kabut/75">
                          {tHero("quotaTodayLabel", {
                            date: formatVisitDateDisplay(
                              catalog.todayYmd,
                              locale
                            ),
                          })}
                        </dt>
                        <dd className="mt-1 font-bold text-fajar">
                          {tHero("quotaRemaining", {
                            remaining: dest.remainingToday,
                            capacity: dest.capacityToday,
                          })}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </div>

          {/* 3 Aturan Resmi Gerbang & Kuota (Seluruh Angka dari SiteSetting DB!) */}
          <div>
            <h2 className="font-heading text-xl font-bold text-kabut sm:text-2xl">
              {tHome("rulesHeading")}
            </h2>
            <div className="mt-5 grid gap-4 sm:gap-5 md:grid-cols-3">
              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-fajar/45 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/25 via-obsidian to-telaga-950 border border-fajar/45 text-fajar shadow-[0_8px_22px_rgba(242,166,90,0.22)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <i className="bi bi-qr-code-scan text-xl" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_8px_#f2a65a]" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tHome("rule1Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tHome("rule1Desc")}
                </p>
              </article>

              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-telaga-400/50 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-telaga/35 via-obsidian to-hutan border border-telaga-400/50 text-telaga-200 shadow-[0_8px_22px_rgba(47,143,131,0.28)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <i className="bi bi-people-fill text-xl" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-telaga-300 shadow-[0_0_8px_#2f8f83]" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tHome("rule2Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tHome("rule2Desc", {
                    maxTickets: initialQuote.maxTicketsPerOrder,
                    windowDays: initialQuote.bookingWindowDays,
                  })}
                </p>
              </article>

              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-fajar/45 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/25 via-obsidian to-telaga-950 border border-fajar/45 text-fajar shadow-[0_8px_22px_rgba(242,166,90,0.22)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <i
                    className="bi bi-hourglass-split text-xl"
                    aria-hidden="true"
                  />
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_8px_#f2a65a]" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tHome("rule3Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tHome("rule3Desc", {
                    cutoffMins: initialQuote.sameDayCloseBufferMinutes,
                    paymentMins: initialQuote.paymentWindowMinutes,
                  })}
                </p>
              </article>
            </div>
          </div>

          {/* Linimasa SVG Scrub 4 Tahap + Pratinjau Peta Koridor Jalur */}
          <TrailTimelineAndMapSection
            offTrailThresholdM={
              Number.parseInt(catalog.settings["offTrailThresholdM"] ?? "", 10) ||
              offTrailThresholdM
            }
            destinations={catalog.destinations}
            trailPoints={catalog.trailPoints}
            mediaSlots={catalog.mediaSlots}
          />

          {/* Fasilitas Kawasan Desa Cupang dengan Ikon Berkilau & Animasi Hover */}
          <div>
            <p className="text-xs font-bold tracking-wider text-fajar uppercase">
              {tFac("eyebrow")}
            </p>
            <h2 className="mt-1.5 font-heading text-2xl font-bold text-kabut sm:text-3xl">
              {tFac("heading")}
            </h2>

            <div className="mt-6 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-fajar/45 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/25 via-obsidian to-telaga-950 border border-fajar/45 text-fajar shadow-[0_8px_22px_rgba(242,166,90,0.22)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <i className="bi bi-p-circle-fill text-xl" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-fajar" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tFac("f1Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tFac("f1Desc")}
                </p>
              </article>

              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-telaga-400/50 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-telaga/35 via-obsidian to-hutan border border-telaga-400/50 text-telaga-200 shadow-[0_8px_22px_rgba(47,143,131,0.28)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <i
                    className="bi bi-signpost-2-fill text-xl"
                    aria-hidden="true"
                  />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-telaga-300" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tFac("f2Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tFac("f2Desc")}
                </p>
              </article>

              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-fajar/45 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/25 via-obsidian to-telaga-950 border border-fajar/45 text-fajar shadow-[0_8px_22px_rgba(242,166,90,0.22)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <i
                    className="bi bi-house-heart-fill text-xl"
                    aria-hidden="true"
                  />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-fajar" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tFac("f3Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tFac("f3Desc")}
                </p>
              </article>

              <article className="group surface-solid-dark p-5 transition-all duration-300 hover:-translate-y-1 hover:border-telaga-400/50 hover:shadow-[0_20px_44px_rgba(0,0,0,0.6)]">
                <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-telaga/35 via-obsidian to-hutan border border-telaga-400/50 text-telaga-200 shadow-[0_8px_22px_rgba(47,143,131,0.28)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  <i
                    className="bi bi-shield-fill-check text-xl"
                    aria-hidden="true"
                  />
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-telaga-300" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-kabut">
                  {tFac("f4Title")}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-kabut/85">
                  {tFac("f4Desc")}
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 4. Petugas Siaga WIB (§5.7) */}
        <div className="section-cv-auto">
          <StaffOnDutySection locale={locale} initialData={staffStatus} />
        </div>

        {/* 5. Ulasan Pengunjung Terverifikasi (§5.6) */}
        <div className="section-cv-auto">
          <VerifiedReviewsSection locale={locale} initialData={reviewsData} />
        </div>

        {/* 6. Formulir Kontak Rate-Limited + Honeypot & Footer Lanskap (§6.H) */}
        <div className="section-cv-auto">
          <ContactAndFooterSection
            locale={locale}
            managerWhatsappDisplay={managerWhatsappDisplay}
            managerWhatsappDigits={managerWhatsappDigits}
            managerEmail={managerEmail}
            footerMedia={catalog.mediaSlots["footer"]}
            tiktokUrl={catalog.settings["socialTiktokUrl"]}
            instagramUrl={catalog.settings["socialInstagramUrl"]}
          />
        </div>
      </main>

      {/* Structured Data JSON-LD (TouristAttraction Batu Lawang & Gunung Bendera — §4, §10.2) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "TouristAttraction",
                "@id": `https://wisatacirebon.id/#batu-lawang`,
                name: "Batu Lawang",
                description:
                  locale === "id"
                    ? "Kawasan tebing batuan andesit purba menjulang di Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon."
                    : "Ancient towering andesite rock cliffs in Cupang Village, Gempol District, Cirebon Regency.",
                url: `https://wisatacirebon.id${locale === "id" ? "" : "/en"}`,
                telephone: managerWhatsappDigits,
                isAccessibleForFree: false,
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: -6.727607,
                  longitude: 108.380723,
                },
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Desa Cupang",
                  addressRegion: "Kecamatan Gempol, Kabupaten Cirebon",
                  addressCountry: "ID",
                },
                openingHoursSpecification: [
                  {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ],
                    opens: "06:00",
                    closes: "17:00",
                  },
                ],
              },
              {
                "@type": "TouristAttraction",
                "@id": `https://wisatacirebon.id/#gunung-bendera`,
                name: "Gunung Bendera",
                description:
                  locale === "id"
                    ? "Puncak bukit panorama 360 derajat di Desa Cupang, Kecamatan Gempol, Kabupaten Cirebon (520 mdpl)."
                    : "Panoramic 360-degree viewpoint summit in Cupang Village, Gempol District, Cirebon Regency (520 masl).",
                url: `https://wisatacirebon.id${locale === "id" ? "/jalur" : "/en/jalur"}`,
                telephone: managerWhatsappDigits,
                isAccessibleForFree: false,
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: -6.735291,
                  longitude: 108.381178,
                },
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Desa Cupang",
                  addressRegion: "Kecamatan Gempol, Kabupaten Cirebon",
                  addressCountry: "ID",
                },
                openingHoursSpecification: [
                  {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ],
                    opens: "06:00",
                    closes: "17:00",
                  },
                ],
              },
            ],
          }),
        }}
      />
    </div>
  );
}

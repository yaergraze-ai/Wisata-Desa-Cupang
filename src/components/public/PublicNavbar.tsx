"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";

export interface PublicNavbarUser {
  name: string;
  dashboardPath: string;
}

type NavTab = "home" | "trail" | "tickets" | "map" | "account";

export function PublicNavbar({ user }: { user: PublicNavbarUser | null }) {
  const tNav = useTranslations("Nav");
  const [activeTab, setActiveTab] = useState<NavTab>("home");

  useEffect(() => {
    function syncFromHash() {
      const h = window.location.hash;
      if (h === "#jalur-aturan") {
        setActiveTab("trail");
      } else if (h === "#kalkulator-tiket" || h === "#pilihan-tiket") {
        setActiveTab("tickets");
      } else if (h === "#peta-jalur") {
        setActiveTab("map");
      } else if (h === "#konten-utama" || !h) {
        setActiveTab("home");
      }
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    // Scroll spy untuk memindahkan highlight oranye otomatis saat halaman digulir
    const sectionTargets: { id: string; tab: NavTab }[] = [
      { id: "konten-utama", tab: "home" },
      { id: "jalur-aturan", tab: "trail" },
      { id: "kalkulator-tiket", tab: "tickets" },
      { id: "pilihan-tiket", tab: "tickets" },
      { id: "peta-jalur", tab: "map" },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        const first = visible[0];
        if (first) {
          const match = sectionTargets.find((s) => s.id === first.target.id);
          if (match) {
            setActiveTab(match.tab);
          }
        }
      },
      {
        rootMargin: "-15% 0px -40% 0px",
        threshold: [0.1, 0.25],
      }
    );

    sectionTargets.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn-ui btn-fajar"
      >
        {tNav("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-kabut/15 bg-obsidian/96 sm:bg-obsidian/92 sm:backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-h-[44px] min-w-0">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hutan border border-telaga-700 text-fajar">
              <i className="bi bi-compass text-lg" aria-hidden="true" />
            </span>
            <div className="leading-tight min-w-0">
              <p className="font-heading text-sm sm:text-base font-bold text-kabut truncate">
                {tNav("brandTitle")}
              </p>
              <p className="hidden sm:block text-xs text-kabut/80 truncate">
                {tNav("brandSubtitle")}
              </p>
            </div>
          </Link>

          <nav
            aria-label={tNav("primaryNavAria")}
            className="hidden lg:flex items-center gap-1"
          >
            <a
              href="#jalur-aturan"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("trail")}
            </a>
            <a
              href="#pilihan-tiket"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("tickets")}
            </a>
            <a
              href="#peta-jalur"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("map")}
            </a>
            <a
              href="#petugas-siaga"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("staff")}
            </a>
            <a
              href="#ulasan-pengunjung"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("reviews")}
            </a>
            <a
              href="#kontak"
              className="min-h-[44px] inline-flex items-center rounded-lg px-3 text-sm font-medium text-kabut/85 hover:bg-hutan hover:text-kabut transition-colors"
            >
              {tNav("contact")}
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <LocaleSwitcher />

            {user ? (
              <Link
                href={user.dashboardPath}
                className="hidden md:inline-flex btn-ui btn-hutan"
              >
                <i className="bi bi-person-badge" aria-hidden="true" />
                <span>{tNav("dashboard")}</span>
              </Link>
            ) : (
              <Link
                href="/masuk"
                className="hidden md:inline-flex btn-ui btn-hutan"
              >
                <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                <span>{tNav("loginRegister")}</span>
              </Link>
            )}

            <a
              href="#kalkulator-tiket"
              aria-label={tNav("buyTicket")}
              className="btn-ui btn-fajar min-w-[44px] px-3 sm:px-4"
            >
              <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
              <span className="hidden sm:inline">{tNav("buyTicket")}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Tab Bar Bawah Khusus Ponsel (§6.A) */}
      <nav
        aria-label={tNav("mobileNavAria")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-kabut/20 bg-obsidian/98 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1">
          <li>
            <a
              href="#konten-utama"
              onClick={() => setActiveTab("home")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-all duration-200 ${
                activeTab === "home"
                  ? "bg-fajar/15 border border-fajar/40 font-bold text-fajar shadow-sm shadow-fajar/10"
                  : "border border-transparent font-medium text-kabut/80 hover:text-fajar"
              }`}
            >
              <i
                className={`${
                  activeTab === "home" ? "bi bi-house-door-fill" : "bi bi-house-door"
                } text-base`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">{tNav("home")}</span>
            </a>
          </li>
          <li>
            <a
              href="#jalur-aturan"
              onClick={() => setActiveTab("trail")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-all duration-200 ${
                activeTab === "trail"
                  ? "bg-fajar/15 border border-fajar/40 font-bold text-fajar shadow-sm shadow-fajar/10"
                  : "border border-transparent font-medium text-kabut/80 hover:text-fajar"
              }`}
            >
              <i
                className={`${
                  activeTab === "trail" ? "bi bi-signpost-split-fill" : "bi bi-signpost-split"
                } text-base`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">{tNav("trail")}</span>
            </a>
          </li>
          <li>
            <a
              href="#kalkulator-tiket"
              onClick={() => setActiveTab("tickets")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-all duration-200 ${
                activeTab === "tickets"
                  ? "bg-fajar/15 border border-fajar/40 font-bold text-fajar shadow-sm shadow-fajar/10"
                  : "border border-transparent font-medium text-kabut/80 hover:text-fajar"
              }`}
            >
              <i
                className={`${
                  activeTab === "tickets"
                    ? "bi bi-ticket-perforated-fill"
                    : "bi bi-ticket-perforated"
                } text-base`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">{tNav("tickets")}</span>
            </a>
          </li>
          <li>
            <a
              href="#peta-jalur"
              onClick={() => setActiveTab("map")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-all duration-200 ${
                activeTab === "map"
                  ? "bg-fajar/15 border border-fajar/40 font-bold text-fajar shadow-sm shadow-fajar/10"
                  : "border border-transparent font-medium text-kabut/80 hover:text-fajar"
              }`}
            >
              <i
                className={`${
                  activeTab === "map" ? "bi bi-geo-alt-fill" : "bi bi-geo-alt"
                } text-base`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">{tNav("map")}</span>
            </a>
          </li>
          <li>
            <Link
              href={user ? user.dashboardPath : "/masuk"}
              onClick={() => setActiveTab("account")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-all duration-200 ${
                activeTab === "account"
                  ? "bg-fajar/15 border border-fajar/40 font-bold text-fajar shadow-sm shadow-fajar/10"
                  : "border border-transparent font-medium text-kabut/80 hover:text-fajar"
              }`}
            >
              <i
                className={`${
                  user
                    ? activeTab === "account"
                      ? "bi bi-person-check-fill"
                      : "bi bi-person-check"
                    : activeTab === "account"
                    ? "bi bi-person-circle"
                    : "bi bi-person"
                } text-base`}
                aria-hidden="true"
              />
              <span className="truncate max-w-full">
                {user ? tNav("dashboard") : tNav("account")}
              </span>
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}

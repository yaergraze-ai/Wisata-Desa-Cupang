"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";

export interface PublicNavbarUser {
  name: string;
  image?: string | null;
  dashboardPath: string;
}

type NavTab = "home" | "trail" | "tickets" | "map" | "account";

export function PublicNavbar({ user }: { user: PublicNavbarUser | null }) {
  const tNav = useTranslations("Nav");
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const isScrollingProgrammatically = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isHomePage =
      pathname === "/" || pathname === "/id" || pathname === "/en";

    function syncFromHashOrPath() {
      if (pathname.includes("/jalur")) {
        setActiveTab("map");
        return;
      }
      if (pathname.includes("/masuk") || pathname.includes("/dashboard")) {
        setActiveTab("account");
        return;
      }

      const h = window.location.hash;
      if (h === "#jalur-aturan") {
        setActiveTab("trail");
      } else if (h === "#kalkulator-tiket" || h === "#pilihan-tiket") {
        setActiveTab("tickets");
      } else if (h === "#peta-jalur") {
        setActiveTab("map");
      } else if (window.scrollY < 160) {
        setActiveTab("home");
      }
    }

    syncFromHashOrPath();
    window.addEventListener("hashchange", syncFromHashOrPath);

    let ticking = false;
    function onScroll() {
      if (isScrollingProgrammatically.current) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          ticking = false;
          if (isScrollingProgrammatically.current) return;
          if (!isHomePage) return;

          if (window.scrollY < 160) {
            setActiveTab("home");
            return;
          }

          const sections: { id: string; tab: NavTab }[] = [
            { id: "peta-jalur", tab: "map" },
            { id: "jalur-aturan", tab: "trail" },
            { id: "kalkulator-tiket", tab: "tickets" },
            { id: "pilihan-tiket", tab: "tickets" },
          ];

          const anchorY = window.innerHeight * 0.42;
          for (const s of sections) {
            const el = document.getElementById(s.id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= anchorY) {
                setActiveTab(s.tab);
                return;
              }
            }
          }

          setActiveTab("home");
        });
        ticking = true;
      }
    }

    // Jika pengguna menyentuh layar untuk scroll manual, lepaskan kunci programmatic scroll
    function onUserTouchOrWheel() {
      if (isScrollingProgrammatically.current) {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 180);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchmove", onUserTouchOrWheel, { passive: true });
    window.addEventListener("wheel", onUserTouchOrWheel, { passive: true });

    return () => {
      window.removeEventListener("hashchange", syncFromHashOrPath);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchmove", onUserTouchOrWheel);
      window.removeEventListener("wheel", onUserTouchOrWheel);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [pathname]);

  const handleMobileNavClick =
    (tab: NavTab, targetId?: string, fallbackUrl?: string) =>
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.blur();
      setActiveTab(tab);

      const isHomePage =
        pathname === "/" || pathname === "/id" || pathname === "/en";

      if (tab === "home") {
        if (isHomePage) {
          e.preventDefault();
          isScrollingProgrammatically.current = true;
          window.scrollTo({ top: 0, behavior: "smooth" });
          window.history.replaceState(null, "", window.location.pathname);
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 1500);
          return;
        } else {
          router.push("/");
          return;
        }
      }

      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          e.preventDefault();
          isScrollingProgrammatically.current = true;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          window.history.replaceState(null, "", `#${targetId}`);

          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 1500);
          return;
        } else if (fallbackUrl) {
          router.push(fallbackUrl);
          return;
        }
      }

      if (fallbackUrl) {
        router.push(fallbackUrl);
      }
    };

  return (
    <>
      <a
        href="#konten-utama"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn-ui btn-fajar"
      >
        {tNav("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 px-3.5 py-2.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 min-h-[44px] shrink-0"
          >
            <span className="relative inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-fajar backdrop-blur-md shadow-sm">
              <i
                className="bi bi-compass text-base sm:text-lg"
                aria-hidden="true"
              />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-fajar shadow-[0_0_10px_#f2a65a] animate-pulse" />
            </span>
            <div className="leading-tight shrink-0">
              <p className="font-unbounded text-xs sm:text-sm font-bold text-kabut tracking-tight whitespace-nowrap">
                {tNav("brandTitle")}
              </p>
              <p className="hidden sm:block text-[11px] font-mono text-kabut/70 whitespace-nowrap">
                {tNav("brandSubtitle")}
              </p>
            </div>
          </Link>

          <nav
            aria-label={tNav("primaryNavAria")}
            className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 shrink-0"
          >
            <a
              href="#pilihan-tiket"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              {tNav("tickets")}
            </a>
            <a
              href="#jalur-aturan"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              <span>{tNav("trail")}</span>
            </a>
            <a
              href="#peta-jalur"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              <span>{tNav("map")}</span>
            </a>
            <a
              href="#petugas-siaga"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              <span>{tNav("staff")}</span>
            </a>
            <a
              href="#ulasan-pengunjung"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              {tNav("reviews")}
            </a>
            <a
              href="#kontak"
              className="min-h-[40px] shrink-0 inline-flex items-center rounded-xl px-2.5 xl:px-3 text-xs xl:text-sm font-semibold text-kabut/85 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
            >
              {tNav("contact")}
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LocaleSwitcher />

            {user ? (
              <Link
                href={user.dashboardPath}
                className="hidden md:inline-flex btn-ui btn-glass whitespace-nowrap items-center gap-2"
              >
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name}
                    width={20}
                    height={20}
                    unoptimized
                    className="h-5 w-5 rounded-full object-cover border border-fajar/50"
                  />
                ) : (
                  <i className="bi bi-person-badge" aria-hidden="true" />
                )}
                <span>{tNav("dashboard")}</span>
              </Link>
            ) : (
              <Link
                href="/masuk"
                className="hidden md:inline-flex btn-ui btn-glass whitespace-nowrap"
              >
                <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                <span>{tNav("loginRegister")}</span>
              </Link>
            )}

            <a
              href="#kalkulator-tiket"
              aria-label={tNav("buyTicket")}
              className="btn-ui btn-glass-fajar min-w-[42px] px-2.5 sm:px-4 whitespace-nowrap"
            >
              <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
              <span className="hidden sm:inline">{tNav("buyTicket")}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Tab Bar Bawah Khusus Ponsel (§6.A) — Selalu Terkunci di Bawah Layar Viewport & Bebas Fokus Ganda */}
      <nav
        aria-label={tNav("mobileNavAria")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-obsidian/95 backdrop-blur-2xl lg:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.75)]"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 px-1.5 py-1.5 gap-1">
          <li>
            <a
              href="#beranda"
              onClick={handleMobileNavClick("home", "beranda", "/")}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:outline-none ${
                activeTab === "home"
                  ? "bg-fajar/15 border border-fajar/45 font-bold text-fajar shadow-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
              }`}
            >
              <i
                className={`${
                  activeTab === "home"
                    ? "bi bi-house-door-fill"
                    : "bi bi-house-door"
                } text-lg leading-none`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {tNav("home")}
              </span>
            </a>
          </li>
          <li>
            <a
              href="#pilihan-tiket"
              onClick={handleMobileNavClick(
                "tickets",
                "pilihan-tiket",
                "/#pilihan-tiket"
              )}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:outline-none ${
                activeTab === "tickets"
                  ? "bg-fajar/15 border border-fajar/45 font-bold text-fajar shadow-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
              }`}
            >
              <i
                className={`${
                  activeTab === "tickets"
                    ? "bi bi-ticket-perforated-fill"
                    : "bi bi-ticket-perforated"
                } text-lg leading-none`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {tNav("tickets")}
              </span>
            </a>
          </li>
          <li>
            <a
              href="#jalur-aturan"
              onClick={handleMobileNavClick(
                "trail",
                "jalur-aturan",
                "/#jalur-aturan"
              )}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:outline-none ${
                activeTab === "trail"
                  ? "bg-fajar/15 border border-fajar/45 font-bold text-fajar shadow-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
              }`}
            >
              <i
                className={`${
                  activeTab === "trail"
                    ? "bi bi-signpost-split-fill"
                    : "bi bi-signpost-split"
                } text-lg leading-none`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {tNav("trail")}
              </span>
            </a>
          </li>
          <li>
            <a
              href="#peta-jalur"
              onClick={handleMobileNavClick(
                "map",
                "peta-jalur",
                "/#peta-jalur"
              )}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:outline-none ${
                activeTab === "map"
                  ? "bg-fajar/15 border border-fajar/45 font-bold text-fajar shadow-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
              }`}
            >
              <i
                className={`${
                  activeTab === "map" ? "bi bi-geo-alt-fill" : "bi bi-geo-alt"
                } text-lg leading-none`}
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {tNav("map")}
              </span>
            </a>
          </li>
          <li>
            <Link
              href={user ? user.dashboardPath : "/masuk"}
              onClick={(e) => {
                e.currentTarget.blur();
                setActiveTab("account");
              }}
              className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:outline-none ${
                activeTab === "account"
                  ? "bg-fajar/15 border border-fajar/45 font-bold text-fajar shadow-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
              }`}
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={20}
                  height={20}
                  unoptimized
                  className="h-5 w-5 rounded-full object-cover border border-fajar/50 mb-0.5"
                />
              ) : (
                <i
                  className={`${
                    user
                      ? activeTab === "account"
                        ? "bi bi-person-check-fill"
                        : "bi bi-person-check"
                      : activeTab === "account"
                      ? "bi bi-person-circle"
                      : "bi bi-person"
                  } text-lg leading-none`}
                  aria-hidden="true"
                />
              )}
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {user ? tNav("dashboard") : tNav("account")}
              </span>
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}

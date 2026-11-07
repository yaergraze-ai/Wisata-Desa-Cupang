"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { cn } from "@/lib/cn";

export interface PublicNavbarUser {
  name: string;
  image?: string | null;
  dashboardPath: string;
}

type NavTab = "home" | "trail" | "tickets" | "map" | "account";

const subscribeNoop = () => () => {};
const getClientBody = () =>
  typeof document !== "undefined" ? document.body : null;
const getServerBody = () => null;

export function PublicNavbar({ user }: { user: PublicNavbarUser | null }) {
  const tNav = useTranslations("Nav");
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const portalTarget = useSyncExternalStore(
    subscribeNoop,
    getClientBody,
    getServerBody
  );
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

          const anchorY = window.innerHeight * 0.45;
          const minBottomY = 140;

          // 1. Cek rentang seksi Peta Jalur
          const mapEl = document.getElementById("peta-jalur");
          if (mapEl) {
            const r = mapEl.getBoundingClientRect();
            if (r.top <= anchorY && r.bottom >= minBottomY) {
              setActiveTab("map");
              return;
            }
          }

          // 2. Cek rentang seksi Jalur & Aturan
          const trailEl = document.getElementById("jalur-aturan");
          if (trailEl) {
            const r = trailEl.getBoundingClientRect();
            if (r.top <= anchorY && r.bottom >= minBottomY) {
              setActiveTab("trail");
              return;
            }
          }

          // 3. Cek rentang gabungan Pilihan Tiket & Kalkulator Tiket
          const ticketStartEl = document.getElementById("pilihan-tiket");
          const ticketEndEl =
            document.getElementById("kalkulator-tiket") ?? ticketStartEl;
          if (ticketStartEl && ticketEndEl) {
            const top = ticketStartEl.getBoundingClientRect().top;
            const bottom = ticketEndEl.getBoundingClientRect().bottom;
            if (top <= anchorY && bottom >= minBottomY) {
              setActiveTab("tickets");
              return;
            }
          }

          setActiveTab("home");
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("hashchange", syncFromHashOrPath);
      window.removeEventListener("scroll", onScroll);
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
          }, 950);
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
          }, 950);
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

  const mobileDockElement = (
    <nav
      aria-label={tNav("mobileNavAria")}
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "max(10px, env(safe-area-inset-bottom))",
        zIndex: 90,
      }}
      className="mx-auto max-w-[380px] rounded-2xl border border-white/15 bg-obsidian/92 px-1.5 py-1.5 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] lg:hidden"
    >
      <ul className="grid grid-cols-5 items-center gap-0.5">
        <li>
          <a
            href="#beranda"
            onClick={handleMobileNavClick("home", "beranda", "/")}
            style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors cursor-pointer"
          >
            <span
              className={cn(
                "inline-flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200",
                activeTab === "home"
                  ? "bg-fajar text-obsidian shadow-[0_4px_14px_rgba(242,166,90,0.4)]"
                  : "text-kabut/70 group-hover:text-kabut"
              )}
            >
              <i
                className={cn(
                  activeTab === "home"
                    ? "bi bi-house-door-fill"
                    : "bi bi-house-door",
                  "text-base leading-none"
                )}
                aria-hidden="true"
              />
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-none whitespace-nowrap transition-colors",
                activeTab === "home"
                  ? "font-bold text-fajar"
                  : "font-medium text-kabut/70"
              )}
            >
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
            style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors cursor-pointer"
          >
            <span
              className={cn(
                "inline-flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200",
                activeTab === "tickets"
                  ? "bg-fajar text-obsidian shadow-[0_4px_14px_rgba(242,166,90,0.4)]"
                  : "text-kabut/70 group-hover:text-kabut"
              )}
            >
              <i
                className={cn(
                  activeTab === "tickets"
                    ? "bi bi-ticket-perforated-fill"
                    : "bi bi-ticket-perforated",
                  "text-base leading-none"
                )}
                aria-hidden="true"
              />
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-none whitespace-nowrap transition-colors",
                activeTab === "tickets"
                  ? "font-bold text-fajar"
                  : "font-medium text-kabut/70"
              )}
            >
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
            style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors cursor-pointer"
          >
            <span
              className={cn(
                "inline-flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200",
                activeTab === "trail"
                  ? "bg-fajar text-obsidian shadow-[0_4px_14px_rgba(242,166,90,0.4)]"
                  : "text-kabut/70 group-hover:text-kabut"
              )}
            >
              <i
                className={cn(
                  activeTab === "trail"
                    ? "bi bi-signpost-split-fill"
                    : "bi bi-signpost-split",
                  "text-base leading-none"
                )}
                aria-hidden="true"
              />
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-none whitespace-nowrap transition-colors",
                activeTab === "trail"
                  ? "font-bold text-fajar"
                  : "font-medium text-kabut/70"
              )}
            >
              {tNav("mobileTrail")}
            </span>
          </a>
        </li>

        <li>
          <a
            href="#peta-jalur"
            onClick={handleMobileNavClick("map", "peta-jalur", "/#peta-jalur")}
            style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors cursor-pointer"
          >
            <span
              className={cn(
                "inline-flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200",
                activeTab === "map"
                  ? "bg-fajar text-obsidian shadow-[0_4px_14px_rgba(242,166,90,0.4)]"
                  : "text-kabut/70 group-hover:text-kabut"
              )}
            >
              <i
                className={cn(
                  activeTab === "map" ? "bi bi-geo-alt-fill" : "bi bi-geo-alt",
                  "text-base leading-none"
                )}
                aria-hidden="true"
              />
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-none whitespace-nowrap transition-colors",
                activeTab === "map"
                  ? "font-bold text-fajar"
                  : "font-medium text-kabut/70"
              )}
            >
              {tNav("mobileMap")}
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
            style={{ outline: "none", WebkitTapHighlightColor: "transparent" }}
            className="group flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-colors cursor-pointer"
          >
            <span
              className={cn(
                "inline-flex h-7 w-11 items-center justify-center rounded-full transition-all duration-200",
                activeTab === "account"
                  ? "bg-fajar text-obsidian shadow-[0_4px_14px_rgba(242,166,90,0.4)]"
                  : "text-kabut/70 group-hover:text-kabut"
              )}
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={18}
                  height={18}
                  unoptimized
                  className="h-4.5 w-4.5 rounded-full object-cover border border-fajar/50"
                />
              ) : (
                <i
                  className={cn(
                    user
                      ? activeTab === "account"
                        ? "bi bi-person-check-fill"
                        : "bi bi-person-check"
                      : activeTab === "account"
                      ? "bi bi-person-circle"
                      : "bi bi-person",
                    "text-base leading-none"
                  )}
                  aria-hidden="true"
                />
              )}
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-none whitespace-nowrap transition-colors",
                activeTab === "account"
                  ? "font-bold text-fajar"
                  : "font-medium text-kabut/70"
              )}
            >
              {user ? tNav("dashboard") : tNav("account")}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );

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
              className="hidden sm:inline-flex btn-ui btn-glass-fajar min-w-[42px] px-2.5 sm:px-4 whitespace-nowrap"
            >
              <i className="bi bi-ticket-perforated-fill" aria-hidden="true" />
              <span className="hidden sm:inline">{tNav("buyTicket")}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Dock Bawah Khusus Ponsel — Dirender langsung ke document.body via Portal agar 100% kebal dari kontainer halaman */}
      {portalTarget ? createPortal(mobileDockElement, portalTarget) : mobileDockElement}
    </>
  );
}

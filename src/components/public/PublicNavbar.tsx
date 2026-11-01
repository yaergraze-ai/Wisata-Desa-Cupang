"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";

export interface PublicNavbarUser {
  name: string;
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
    // 1. Sinkronisasi tab awal berdasarkan path dan hash
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
      } else {
        if (window.scrollY < 180) {
          setActiveTab("home");
        }
      }
    }

    syncFromHashOrPath();
    window.addEventListener("hashchange", syncFromHashOrPath);

    // 2. Scroll Spy deterministik berbasis getBoundingClientRect
    let ticking = false;
    function onScroll() {
      if (isScrollingProgrammatically.current) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          ticking = false;
          if (isScrollingProgrammatically.current) return;

          // Jika halaman bukan beranda utama (misal di /jalur), jangan timpa tab
          if (pathname !== "/" && pathname !== "/en") return;

          // Jika berada di dekat bagian atas layar
          if (window.scrollY < 180) {
            setActiveTab("home");
            return;
          }

          // Cek posisi tiap section dari bawah ke atas
          const sections: { id: string; tab: NavTab }[] = [
            { id: "peta-jalur", tab: "map" },
            { id: "kalkulator-tiket", tab: "tickets" },
            { id: "pilihan-tiket", tab: "tickets" },
            { id: "jalur-aturan", tab: "trail" },
          ];

          const anchorY = window.innerHeight * 0.35; // 35% dari batas atas viewport
          for (const s of sections) {
            const el = document.getElementById(s.id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= anchorY && rect.bottom > 60) {
                setActiveTab(s.tab);
                return;
              }
            }
          }

          // Fallback jika di atas semua section
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
    (e: React.MouseEvent) => {
      // 1. Langsung ubah warna tombol seketika saat disentuh/diklik
      setActiveTab(tab);

      if (tab === "home") {
        const isHomePage = pathname === "/" || pathname === "/en";
        if (isHomePage) {
          e.preventDefault();
          isScrollingProgrammatically.current = true;
          window.scrollTo({ top: 0, behavior: "smooth" });
          window.history.replaceState(null, "", " ");
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 900);
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
          }, 900);
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-h-[44px] min-w-0">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-fajar backdrop-blur-md shadow-sm">
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
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("trail")}
            </a>
            <a
              href="#pilihan-tiket"
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("tickets")}
            </a>
            <a
              href="#peta-jalur"
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("map")}
            </a>
            <a
              href="#petugas-siaga"
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("staff")}
            </a>
            <a
              href="#ulasan-pengunjung"
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("reviews")}
            </a>
            <a
              href="#kontak"
              className="min-h-[44px] inline-flex items-center rounded-xl px-3 text-sm font-medium text-kabut/80 hover:bg-white/10 hover:text-kabut transition-all"
            >
              {tNav("contact")}
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <LocaleSwitcher />

            {user ? (
              <Link
                href={user.dashboardPath}
                className="hidden md:inline-flex btn-ui btn-glass"
              >
                <i className="bi bi-person-badge" aria-hidden="true" />
                <span>{tNav("dashboard")}</span>
              </Link>
            ) : (
              <Link
                href="/masuk"
                className="hidden md:inline-flex btn-ui btn-glass"
              >
                <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                <span>{tNav("loginRegister")}</span>
              </Link>
            )}

            <a
              href="#kalkulator-tiket"
              aria-label={tNav("buyTicket")}
              className="btn-ui btn-glass-fajar min-w-[44px] px-3 sm:px-4"
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-obsidian/95 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1">
          <li>
            <a
              href="#beranda"
              onClick={handleMobileNavClick("home", "beranda", "/")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer ${
                activeTab === "home"
                  ? "bg-white/15 border border-white/25 font-bold text-fajar shadow-md shadow-black/25 backdrop-blur-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
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
              onClick={handleMobileNavClick("trail", "jalur-aturan", "/#jalur-aturan")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer ${
                activeTab === "trail"
                  ? "bg-white/15 border border-white/25 font-bold text-fajar shadow-md shadow-black/25 backdrop-blur-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
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
              onClick={handleMobileNavClick("tickets", "kalkulator-tiket", "/#kalkulator-tiket")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer ${
                activeTab === "tickets"
                  ? "bg-white/15 border border-white/25 font-bold text-fajar shadow-md shadow-black/25 backdrop-blur-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
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
              onClick={handleMobileNavClick("map", "peta-jalur", "/#peta-jalur")}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer ${
                activeTab === "map"
                  ? "bg-white/15 border border-white/25 font-bold text-fajar shadow-md shadow-black/25 backdrop-blur-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
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
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs transition-all duration-200 cursor-pointer ${
                activeTab === "account"
                  ? "bg-white/15 border border-white/25 font-bold text-fajar shadow-md shadow-black/25 backdrop-blur-md"
                  : "border border-transparent font-medium text-kabut/75 hover:text-kabut hover:bg-white/5"
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

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Role } from "@prisma/client";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { GoogleFirstTimeSetupModal } from "@/components/auth/GoogleFirstTimeSetupModal";

const subscribeNoop = () => () => {};
const getClientBody = (): HTMLElement | null =>
  typeof document !== "undefined" ? document.body : null;
const getServerBody = (): HTMLElement | null => null;

export interface DashboardSidebarTabItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  badgeColor?: string;
}

interface DashboardSidebarProps {
  role: Role;
  userName: string;
  userEmail: string;
  userAvatarInitials?: string;
  userAvatarImage?: string | null;
  twoFactorEnabled?: boolean;
  needsPasswordSetup?: boolean;
  locale?: string;
  tabs: DashboardSidebarTabItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  title?: string;
}

export function DashboardSidebar({
  role,
  userName,
  userEmail,
  userAvatarInitials,
  userAvatarImage,
  twoFactorEnabled = false,
  needsPasswordSetup,
  locale = "id",
  tabs,
  activeTab,
  onSelectTab,
  title = "Wisata Desa Cupang",
}: DashboardSidebarProps) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const portalTarget = useSyncExternalStore(
    subscribeNoop,
    getClientBody,
    getServerBody
  );

  // Waktu Server WIB Ticker
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WIB"
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  function handleTabClick(tabId: string) {
    onSelectTab(tabId);
    setMobileOpen(false);
  }

  const isEn = locale === "en";

  const tLabels = {
    navMenu: isEn ? "Navigation" : "Menu Navigasi",
    roleConsoles: isEn ? "Role Consoles" : "Konsol Peran",
    tourShortcuts: isEn ? "Explore Park" : "Pintasan Wisata",
    publicHome: isEn ? "Public Home" : "Beranda Publik",
    trailMap: isEn ? "Trail & Elevation Map" : "Peta Jalur & Elevasi",
    setup2fa: isEn ? "Setup 2FA" : "Pasang 2FA",
    active2fa: isEn ? "2FA Active" : "2FA Aktif",
    alert2faTitle: isEn
      ? "Warning: Account not protected by 2FA. Click to setup now"
      : "Peringatan: Akun belum terproteksi 2FA. Klik untuk mengaktifkan sekarang",
    closeMenuAria: isEn ? "Close sidebar menu" : "Tutup menu samping",
    openMenuAria: isEn ? "Open navigation menu" : "Buka navigasi menu samping",
    backHomeTitle: isEn
      ? "Back to Wisata Cirebon Home"
      : "Kembali ke Beranda Wisata Cirebon",
    homeHint: isEn ? "• Home ↗" : "• Beranda ↗",
    staff: isEn ? "Staff" : "Petugas",
    user: isEn ? "User" : "Pengguna",
    moreMenu: isEn ? "More" : "Lainnya",
  };

  const roleConfig = {
    [Role.SUPER_ADMIN]: {
      label: "Super Admin",
      badgeClass:
        "border-purple-500/50 bg-purple-500/15 text-purple-300 font-bold",
    },
    [Role.ADMIN]: {
      label: "Admin",
      badgeClass: "border-fajar/50 bg-fajar/15 text-fajar font-bold",
    },
    [Role.STAFF]: {
      label: tLabels.staff,
      badgeClass: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 font-bold",
    },
    [Role.MEMBER]: {
      label: "Member",
      badgeClass:
        "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-bold",
    },
  }[role] ?? {
    label: tLabels.user,
    badgeClass: "border-white/10 bg-white/5 text-kabut/75 font-medium",
  };

  const roleConsoles: Array<{
    href: string;
    label: string;
    icon: string;
    isActive: boolean;
    badge?: string;
  }> = [];

  if (
    role === Role.STAFF ||
    role === Role.ADMIN ||
    role === Role.SUPER_ADMIN
  ) {
    const isMemberConsole =
      pathname.endsWith("/dashboard") || pathname.includes("/dashboard?");
    const isStaffConsole = pathname.includes("/dashboard/staff");
    const isAdminConsole =
      pathname.includes("/dashboard/admin") &&
      !pathname.includes("/dashboard/super-admin");
    const isSuperConsole = pathname.includes("/dashboard/super-admin");

    if (role === Role.SUPER_ADMIN) {
      roleConsoles.push({
        href: `/${locale}/dashboard/super-admin`,
        label: "Konsol Super Admin",
        icon: "bi-shield-shaded",
        isActive: isSuperConsole,
        badge: "Root",
      });
    }

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      roleConsoles.push({
        href: `/${locale}/dashboard/admin`,
        label: "Konsol Admin Wisata",
        icon: "bi-sliders2-vertical",
        isActive: isAdminConsole,
        badge: "Ops",
      });
    }

    roleConsoles.push({
      href: `/${locale}/dashboard/staff`,
      label: "Scanner Pos Gerbang",
      icon: "bi-qr-code-scan",
      isActive: isStaffConsole,
      badge: "Gate",
    });

    roleConsoles.push({
      href: `/${locale}/dashboard?view=member`,
      label: "Mode Wisatawan",
      icon: "bi-compass",
      isActive: isMemberConsole,
      badge: "Tiket",
    });
  }

  const initials =
    userAvatarInitials ||
    (userName ? userName.trim().slice(0, 2).toUpperCase() : "WC");

  const activeTabItem = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  // Untuk dock bawah mobile: maksimal 5 item sesuai AGENTS.md §4
  const hasOverflowTabs = tabs.length > 5;
  const mobileBottomTabs = hasOverflowTabs ? tabs.slice(0, 4) : tabs.slice(0, 5);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 pb-24 lg:pb-4 bg-obsidian text-kabut select-none overflow-y-auto">
      <div className="space-y-5">
        {/* BRAND HEADER — KLIK UNTUK KEMBALI KE BERANDA UTAMA */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <Link
            href={`/${locale}`}
            title={tLabels.backHomeTitle}
            className="group flex items-center gap-2.5 min-w-0 transition-opacity hover:opacity-95 cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fajar/25 to-amber-600/15 border border-fajar/40 text-fajar shadow-sm group-hover:scale-105 group-hover:bg-fajar group-hover:text-obsidian transition-all duration-200">
              <i className="bi bi-compass-fill text-base" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-xs font-extrabold tracking-tight text-kabut truncate group-hover:text-fajar transition-colors">
                {title}
              </h2>
              <p className="text-[10px] font-mono text-kabut/55 flex items-center gap-1">
                <span>Portal Resmi</span>
                <span className="text-fajar/85 font-semibold">
                  {tLabels.homeHint}
                </span>
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={tLabels.closeMenuAria}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-kabut/70 hover:text-white cursor-pointer"
          >
            <i className="bi bi-x-lg text-xs" aria-hidden="true" />
          </button>
        </div>

        {/* KARTU PROFIL SINGKAT PENGGUNA */}
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-hutan/90 to-obsidian p-3 space-y-2.5 shadow-inner">
          <div className="flex items-center gap-2.5">
            {userAvatarImage && !avatarImgError ? (
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-fajar/45 bg-obsidian shadow-sm">
                <Image
                  src={userAvatarImage}
                  alt={userName}
                  fill
                  sizes="36px"
                  referrerPolicy="no-referrer"
                  unoptimized={userAvatarImage.startsWith("http")}
                  onError={() => setAvatarImgError(true)}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fajar/15 border border-fajar/35 font-unbounded text-xs font-bold text-fajar">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-xs font-bold text-kabut">
                {userName}
              </p>
              <p className="truncate text-[10px] text-kabut/55 font-mono">
                {userEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/8 gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] ${roleConfig.badgeClass}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {roleConfig.label}
            </span>

            {!twoFactorEnabled ? (
              <Link
                href={`/${locale}/verifikasi-2fa?setup=1`}
                title={tLabels.alert2faTitle}
                className="animate-pulse-warning inline-flex items-center gap-1 rounded-lg border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-obsidian transition-all cursor-pointer"
              >
                <i
                  className="bi bi-exclamation-triangle-fill text-[9px]"
                  aria-hidden="true"
                />
                <span>{tLabels.setup2fa}</span>
              </Link>
            ) : (
              <span
                title="Autentikasi Dua Faktor (2FA) Aktif"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
              >
                <i
                  className="bi bi-shield-check text-[9px]"
                  aria-hidden="true"
                />
                <span>{tLabels.active2fa}</span>
              </span>
            )}
          </div>
        </div>

        {/* KONSOL PERAN (KHUSUS ROLE STAF / ADMIN / SUPER ADMIN) */}
        {roleConsoles.length > 0 ? (
          <div className="space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/50">
                {tLabels.roleConsoles}
              </p>
              <span className="text-[9px] font-mono text-kabut/45 font-medium">
                {roleConsoles.length} Konsol
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {roleConsoles.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-200 ${
                    c.isActive
                      ? "bg-fajar/20 text-fajar border border-fajar/45 shadow-xs"
                      : "text-kabut/75 hover:bg-white/[0.06] hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <i
                      className={`bi ${c.icon} text-xs transition-transform duration-200 group-hover:scale-110 ${
                        c.isActive ? "text-fajar" : "text-kabut/55"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{c.label}</span>
                  </div>
                  {c.isActive ? (
                    <span className="flex h-2 w-2 rounded-full bg-fajar shadow-[0_0_8px_rgba(242,166,90,0.85)]" />
                  ) : c.badge ? (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/5 text-kabut/65 border border-white/10">
                      {c.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* DAFTAR MENU UTAMA DASHBOARD */}
        <div className="space-y-1.5">
          <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/45">
            {tLabels.navMenu}
          </p>
          <nav className="space-y-1" aria-label="Navigasi dashboard">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`sidebar-tab-${tab.id}`}
                  onClick={() => handleTabClick(tab.id)}
                  className={`btn-ui group relative flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold min-h-[42px] cursor-pointer ${
                    isSelected
                      ? "btn-fajar text-obsidian"
                      : "bg-transparent text-kabut/80 hover:bg-white/[0.07] hover:text-white border border-transparent hover:border-white/12"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <i
                      className={`bi ${tab.icon} text-sm ${
                        isSelected
                          ? "text-obsidian scale-110"
                          : "text-kabut/55 group-hover:text-fajar"
                      } transition-all duration-200`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>

                  {tab.badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isSelected
                          ? "bg-obsidian text-fajar shadow-xs"
                          : tab.badgeColor || "bg-fajar/20 text-fajar border border-fajar/30"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* PINTASAN WISATA EKSTERNAL */}
        <div className="space-y-1 pt-3 border-t border-white/10">
          <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/45 pb-0.5">
            {tLabels.tourShortcuts}
          </p>
          <nav className="space-y-1">
            <Link
              href={`/${locale}`}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-kabut/75 hover:bg-white/[0.06] hover:text-white transition-all duration-200 border border-transparent hover:border-white/10"
            >
              <i
                className="bi bi-house-door-fill text-sm text-kabut/60 group-hover:text-fajar group-hover:scale-110 transition-all duration-200"
                aria-hidden="true"
              />
              <span>{tLabels.publicHome}</span>
            </Link>
            <Link
              href={`/${locale}/jalur`}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-kabut/75 hover:bg-white/[0.06] hover:text-white transition-all duration-200 border border-transparent hover:border-white/10"
            >
              <i
                className="bi bi-map-fill text-sm text-kabut/60 group-hover:text-fajar group-hover:scale-110 transition-all duration-200"
                aria-hidden="true"
              />
              <span>{tLabels.trailMap}</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER SIDEBAR (BAHASA, WAKTU WIB & TOMBOL KELUAR) */}
      <div className="space-y-2.5 pt-3 border-t border-white/10 mt-4">
        <div className="flex items-center justify-between px-1 gap-1">
          <span className="text-[10px] font-mono text-kabut/55 flex items-center gap-1.5 shrink-0">
            <i className="bi bi-clock text-xs text-fajar" aria-hidden="true" />
            <span>{currentTime || "WIB"}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher compact />
          </div>
        </div>

        <div>
          <SignOutButton variant="sidebar" />
        </div>
      </div>
    </div>
  );

  // DOCK NAVIGASI BAWAH MOBILE (MAKS 5 ITEM + SHEET SESUAI AGENTS.md §4)
  const mobileBottomDock = (
    <nav
      aria-label="Navigasi Bawah Dashboard"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
    >
      <div
        className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-white/15 bg-obsidian/95 p-1.5 shadow-[0_-10px_36px_rgba(0,0,0,0.82)] backdrop-blur-2xl grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${
            hasOverflowTabs ? 5 : Math.max(1, mobileBottomTabs.length)
          }, minmax(0, 1fr))`,
        }}
      >
        {mobileBottomTabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          const shortDockLabel =
            tab.id === "wallet"
              ? isEn
                ? "Wallet"
                : "Dompet"
              : tab.id === "orders"
              ? isEn
                ? "Orders"
                : "Pesanan"
              : tab.id === "profile"
              ? isEn
                ? "Profile"
                : "Profil"
              : tab.label;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`mobile-dock-tab-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 min-h-[54px] transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-b from-fajar/25 to-fajar/10 text-fajar border border-fajar/45 shadow-[0_0_16px_rgba(242,166,90,0.2)]"
                  : "text-kabut/65 hover:text-kabut active:scale-95 border border-transparent"
              }`}
            >
              {isSelected ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 h-1 w-6 rounded-full bg-fajar shadow-[0_0_8px_#f2a65a]"
                />
              ) : null}

              <div className="relative flex items-center justify-center">
                <i
                  className={`bi ${tab.icon} text-base transition-transform duration-200 ${
                    isSelected
                      ? "-translate-y-0.5 scale-110 text-fajar"
                      : "text-kabut/65 group-hover:text-kabut"
                  }`}
                  aria-hidden="true"
                />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-3 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-fajar px-1 text-[9px] font-black text-obsidian shadow-xs">
                    {tab.badge}
                  </span>
                ) : null}
              </div>

              <span
                className={`w-full text-center text-[10px] leading-tight truncate px-0.5 ${
                  isSelected ? "font-extrabold text-fajar" : "font-semibold"
                }`}
              >
                {shortDockLabel}
              </span>
            </button>
          );
        })}

        {hasOverflowTabs ? (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`group relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 min-h-[54px] transition-all duration-200 cursor-pointer ${
              mobileOpen
                ? "bg-fajar/20 text-fajar border border-fajar/45"
                : "text-kabut/65 hover:text-kabut active:scale-95 border border-transparent"
            }`}
          >
            <i
              className="bi bi-grid-3x3-gap-fill text-base"
              aria-hidden="true"
            />
            <span className="w-full text-center text-[10px] font-semibold leading-tight truncate px-0.5">
              {tLabels.moreMenu}
            </span>
          </button>
        ) : null}
      </div>
    </nav>
  );

  return (
    <>
      <GoogleFirstTimeSetupModal
        initialNeedsSetup={needsPasswordSetup}
        initialUsername={userName}
      />

      {/* 1. SIDEBAR PERSISTEN DESKTOP (Layar Besar lg/xl) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-white/10 bg-obsidian z-30">
        {sidebarContent}
      </aside>

      {/* 2. TOP BAR HEADER MOBILE (Layar < lg) */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-white/12 bg-obsidian/95 backdrop-blur-xl px-3.5 py-2.5 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={tLabels.openMenuAria}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-hutan border border-white/15 text-fajar hover:border-fajar/50 active:scale-95 transition cursor-pointer shrink-0 shadow-sm"
          >
            <i className="bi bi-list text-base" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-heading text-xs font-extrabold text-kabut truncate">
                {activeTabItem?.label || title}
              </p>
              <span
                className={`inline-flex items-center rounded-md border px-1.5 py-0.2 text-[9px] ${roleConfig.badgeClass}`}
              >
                {roleConfig.label}
              </span>
            </div>
            <p className="text-[10px] text-kabut/60 truncate">{userName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LocaleSwitcher compact />
          <Link
            href={`/${locale}`}
            title={tLabels.backHomeTitle}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-kabut/85 hover:text-fajar hover:border-fajar/40 transition"
          >
            <i className="bi bi-house-door-fill text-xs" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* 3. MOBILE SLIDE-OUT SHEET / DRAWER OVERLAY */}
      {mobileOpen ? (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-obsidian/80 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] border-r border-white/15 bg-obsidian shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      ) : null}

      {/* 4. MOBILE FLOATING BOTTOM DOCK PORTAL */}
      {portalTarget ? createPortal(mobileBottomDock, portalTarget) : null}
    </>
  );
}

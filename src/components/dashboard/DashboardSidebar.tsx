"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Role } from "@prisma/client";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { GoogleFirstTimeSetupModal } from "@/components/auth/GoogleFirstTimeSetupModal";

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
  locale = "id",
  tabs,
  activeTab,
  onSelectTab,
  title = "Wisata Desa Cupang",
}: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

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
    backHomeTitle: isEn ? "Back to Wisata Cirebon Home" : "Kembali ke Beranda Wisata Cirebon",
    homeHint: isEn ? "• Home ↗" : "• Beranda ↗",
    staff: isEn ? "Staff" : "Petugas",
    user: isEn ? "User" : "Pengguna",
  };

  const roleConfig = {
    [Role.SUPER_ADMIN]: {
      label: "Super Admin",
    },
    [Role.ADMIN]: {
      label: "Admin",
    },
    [Role.STAFF]: {
      label: tLabels.staff,
    },
    [Role.MEMBER]: {
      label: "Member",
    },
  }[role] ?? {
    label: tLabels.user,
  };

  const initials =
    userAvatarInitials ||
    (userName ? userName.trim().slice(0, 2).toUpperCase() : "DC");

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-3.5 select-none scrollbar-thin">
      <div className="space-y-4">
        {/* BRAND & LOGO BAR (Kembali ke Beranda Wisata Cirebon) */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <Link
            href={`/${locale}`}
            title="Kembali ke Beranda Wisata Cirebon"
            className="flex items-center gap-2.5 group transition-all p-1.5 -ml-1 rounded-xl hover:bg-white/[0.06] cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fajar/25 to-amber-500/10 border border-fajar/40 text-fajar shadow-sm shadow-fajar/10 group-hover:scale-105 transition-transform">
              <i className="bi bi-compass-fill text-lg" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-unbounded text-xs font-bold tracking-tight text-kabut leading-tight truncate">
                  Desa Cupang
                </p>
                <i className="bi bi-arrow-up-right text-[10px] text-fajar opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[10px] font-mono text-kabut/50 leading-tight truncate mt-0.5 group-hover:text-fajar transition-colors">
                Wisata Alam Cirebon
              </p>
            </div>
          </Link>

          {/* Tombol Close untuk Mobile Drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-kabut hover:text-white cursor-pointer"
            aria-label={tLabels.closeMenuAria}
          >
            <i className="bi bi-x-lg text-xs" aria-hidden="true" />
          </button>
        </div>

        {/* KARTU PROFIL PENGGUNA TERHUBUNG */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            {userAvatarImage ? (
              <img
                src={userAvatarImage}
                alt={userName}
                className="h-8 w-8 shrink-0 rounded-lg object-cover border border-fajar/40 shadow-sm"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 font-mono text-xs font-bold text-kabut">
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-kabut truncate" title={userName}>
                {userName || tLabels.user}
              </p>
              <p className="text-[10px] font-mono text-kabut/45 truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border border-white/10 bg-white/5 text-kabut/75">
              {roleConfig.label}
            </span>

            {twoFactorEnabled ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <i className="bi bi-shield-check text-xs" aria-hidden="true" />
                <span>{tLabels.active2fa}</span>
              </span>
            ) : (
              <Link
                href="/verifikasi-2fa?setup=1"
                className="animate-pulse-warning inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                title={tLabels.alert2faTitle}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-obsidian text-[9px] font-black leading-none">
                  !
                </span>
                <span>{tLabels.setup2fa}</span>
              </Link>
            )}
          </div>
        </div>

        {/* DAFTAR MENU UTAMA DASHBOARD */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/40 pb-1">
            {tLabels.navMenu}
          </p>
          <nav className="space-y-0.5" aria-label="Navigasi dashboard">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`sidebar-tab-${tab.id}`}
                  onClick={() => handleTabClick(tab.id)}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-fajar to-amber-500 text-obsidian font-bold shadow-md shadow-fajar/25 border border-fajar/50 scale-[1.01]"
                      : "text-kabut/75 hover:bg-white/[0.06] hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <i
                      className={`bi ${tab.icon} text-sm ${
                        isSelected
                          ? "text-obsidian scale-110"
                          : "text-kabut/50 group-hover:text-fajar group-hover:scale-105"
                      } transition-all duration-200`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>

                  {tab.badge ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSelected
                          ? "bg-obsidian text-fajar shadow-xs"
                          : tab.badgeColor || "bg-white/10 text-kabut/80"
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
          <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/40 pb-1">
            {tLabels.tourShortcuts}
          </p>
          <nav className="space-y-0.5">
            <Link
              href={`/${locale}`}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-kabut/75 hover:bg-white/[0.06] hover:text-white transition-all duration-200 border border-transparent"
            >
              <i
                className="bi bi-house-door-fill text-sm text-kabut/60 group-hover:text-fajar group-hover:scale-105 transition-all duration-200"
                aria-hidden="true"
              />
              <span>{tLabels.publicHome}</span>
            </Link>
            <Link
              href={`/${locale}/jalur`}
              className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-kabut/75 hover:bg-white/[0.06] hover:text-white transition-all duration-200 border border-transparent"
            >
              <i
                className="bi bi-map-fill text-sm text-kabut/60 group-hover:text-fajar group-hover:scale-105 transition-all duration-200"
                aria-hidden="true"
              />
              <span>{tLabels.trailMap}</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER SIDEBAR (TEMA, BAHASA, WAKTU WIB & TOMBOL KELUAR) */}
      <div className="space-y-2.5 pt-3 border-t border-white/10 mt-4">
        <div className="flex items-center justify-between px-1 gap-1">
          <span className="text-[10px] font-mono text-kabut/45 flex items-center gap-1.5 shrink-0">
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

  return (
    <>
      <GoogleFirstTimeSetupModal />

      {/* 1. SIDEBAR PERSISTEN DESKTOP (Layar Besar lg/xl) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-white/10 bg-obsidian z-30">
        {sidebarContent}
      </aside>

      {/* 2. TOP BAR TUNGGAL MOBILE (Layar < lg) */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-obsidian px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={tLabels.openMenuAria}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-kabut hover:text-white transition cursor-pointer shrink-0"
          >
            <i className="bi bi-list text-base" aria-hidden="true" />
          </button>
          <Link
            href={`/${locale}`}
            title={tLabels.backHomeTitle}
            className="min-w-0 flex items-center gap-2 group transition-opacity cursor-pointer"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fajar/15 border border-fajar/30 text-fajar">
              <i className="bi bi-compass-fill text-xs" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-xs font-bold text-kabut truncate group-hover:text-fajar transition-colors">
                {title}
              </p>
              <p className="text-[10px] font-mono text-kabut/50 truncate flex items-center gap-1">
                <span>{roleConfig.label}</span>
                <span className="text-fajar/80 font-semibold">{tLabels.homeHint}</span>
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <LocaleSwitcher compact />
          <SignOutButton variant="sidebar" />
        </div>
      </div>

      {/* 3. MOBILE SLIDE-OUT DRAWER OVERLAY */}
      {mobileOpen ? (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-obsidian/80 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] border-r border-white/10 bg-obsidian shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      ) : null}
    </>
  );
}

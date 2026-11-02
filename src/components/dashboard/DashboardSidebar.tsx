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

  const roleConfig = {
    [Role.SUPER_ADMIN]: {
      label: "Super Admin",
    },
    [Role.ADMIN]: {
      label: "Admin",
    },
    [Role.STAFF]: {
      label: "Petugas",
    },
    [Role.MEMBER]: {
      label: "Member",
    },
  }[role] ?? {
    label: "Pengguna",
  };

  const initials =
    userAvatarInitials ||
    (userName ? userName.trim().slice(0, 2).toUpperCase() : "DC");

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-3.5 select-none scrollbar-thin">
      <div className="space-y-4">
        {/* BRAND & LOGO BAR */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-85"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fajar/10 border border-fajar/20 text-fajar">
              <i className="bi bi-compass text-base" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold tracking-wide text-kabut leading-tight truncate">
                Desa Cupang
              </p>
              <p className="text-[10px] font-mono text-kabut/45 leading-tight truncate mt-0.5">
                Wisata Alam Cirebon
              </p>
            </div>
          </Link>

          {/* Tombol Close untuk Mobile Drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-kabut hover:text-white cursor-pointer"
            aria-label="Tutup menu samping"
          >
            <i className="bi bi-x-lg text-xs" aria-hidden="true" />
          </button>
        </div>

        {/* KARTU PROFIL PENGGUNA TERHUBUNG */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 font-mono text-xs font-bold text-kabut">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-kabut truncate" title={userName}>
                {userName || "Pengguna"}
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
                <span>2FA Aktif</span>
              </span>
            ) : (
              <Link
                href="/verifikasi-2fa?setup=1"
                className="text-[10px] font-mono text-kabut/45 hover:text-fajar flex items-center gap-1 transition-colors"
                title="Aktifkan autentikasi dua faktor"
              >
                <i className="bi bi-shield text-xs" aria-hidden="true" />
                <span>Pasang 2FA</span>
              </Link>
            )}
          </div>
        </div>

        {/* DAFTAR MENU UTAMA DASHBOARD */}
        <div className="space-y-1">
          <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/40 pb-1">
            Menu Navigasi
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
                  className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-fajar text-obsidian font-bold shadow-xs"
                      : "text-kabut/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <i
                      className={`bi ${tab.icon} text-sm ${
                        isSelected
                          ? "text-obsidian"
                          : "text-kabut/50 group-hover:text-kabut"
                      } transition-colors`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>

                  {tab.badge ? (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isSelected
                          ? "bg-obsidian text-fajar"
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
            Pintasan Wisata
          </p>
          <nav className="space-y-0.5">
            <Link
              href={`/${locale}`}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-kabut/65 hover:bg-white/5 hover:text-white transition-colors"
            >
              <i
                className="bi bi-house text-sm text-kabut/50 group-hover:text-kabut transition-colors"
                aria-hidden="true"
              />
              <span>Beranda Publik</span>
            </Link>
            <Link
              href={`/${locale}/jalur`}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-kabut/65 hover:bg-white/5 hover:text-white transition-colors"
            >
              <i
                className="bi bi-map text-sm text-kabut/50 group-hover:text-kabut transition-colors"
                aria-hidden="true"
              />
              <span>Peta Jalur & Elevasi</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER SIDEBAR (BAHASA, WAKTU WIB & TOMBOL KELUAR) */}
      <div className="space-y-2.5 pt-3 border-t border-white/10 mt-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono text-kabut/45 flex items-center gap-1.5">
            <i className="bi bi-clock text-xs text-kabut/40" aria-hidden="true" />
            <span>{currentTime || "WIB"}</span>
          </span>
          <LocaleSwitcher compact />
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
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka navigasi menu samping"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-kabut hover:text-white transition cursor-pointer"
          >
            <i className="bi bi-list text-base" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="font-heading text-xs font-bold text-kabut truncate">
              {title}
            </p>
            <p className="text-[10px] font-mono text-kabut/50 truncate">
              {roleConfig.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

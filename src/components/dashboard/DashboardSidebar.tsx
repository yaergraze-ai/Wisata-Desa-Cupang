"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Role } from "@prisma/client";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

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
  locale = "id",
  tabs,
  activeTab,
  onSelectTab,
  title = "Wisata Desa Cupang",
}: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const pathname = usePathname();

  // WIB Live Clock Ticker
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

  // Tutup mobile drawer saat berpindah tab atau layar membesar
  function handleTabClick(tabId: string) {
    onSelectTab(tabId);
    setMobileOpen(false);
  }

  const roleConfig = {
    [Role.SUPER_ADMIN]: {
      label: "Super Admin",
      badgeClass: "bg-purple-950/80 border-purple-500/50 text-purple-300",
      accentBorder: "border-purple-500/30",
      glowColor: "from-purple-500/15",
    },
    [Role.ADMIN]: {
      label: "Admin Operasional",
      badgeClass: "bg-amber-950/80 border-fajar/50 text-fajar",
      accentBorder: "border-fajar/30",
      glowColor: "from-fajar/15",
    },
    [Role.STAFF]: {
      label: "Petugas Lapangan",
      badgeClass: "bg-telaga-950/80 border-telaga-400/50 text-telaga-300",
      accentBorder: "border-telaga-400/30",
      glowColor: "from-telaga-400/15",
    },
    [Role.MEMBER]: {
      label: "Member Resmi",
      badgeClass: "bg-emerald-950/80 border-emerald-500/50 text-emerald-300",
      accentBorder: "border-emerald-500/30",
      glowColor: "from-emerald-500/15",
    },
  }[role] ?? {
    label: "Pengguna",
    badgeClass: "bg-obsidian border-kabut/20 text-kabut",
    accentBorder: "border-kabut/20",
    glowColor: "from-fajar/10",
  };

  const initials =
    userAvatarInitials ||
    (userName ? userName.trim().slice(0, 2).toUpperCase() : "DC");

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-4 sm:p-5 select-none scrollbar-thin">
      <div className="space-y-6">
        {/* BRAND & LOGO BAR */}
        <div className="flex items-center justify-between pb-3 border-b border-telaga-800/80">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-3 group transition-transform hover:scale-[1.02]"
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fajar/25 to-obsidian border border-fajar/40 text-fajar shadow-inner">
              <i className="bi bi-compass text-xl group-hover:rotate-45 transition-transform duration-500" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-fajar shadow-[0_0_8px_#f2a65a] animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-extrabold tracking-wide text-kabut group-hover:text-fajar transition-colors truncate">
                Desa Cupang
              </p>
              <p className="text-[11px] font-mono text-kabut/65 truncate">
                Wisata Alam Cirebon
              </p>
            </div>
          </Link>

          {/* Tombol Close untuk Mobile Drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-obsidian border border-kabut/20 text-kabut hover:text-white cursor-pointer"
            aria-label="Tutup menu samping"
          >
            <i className="bi bi-x-lg text-sm" />
          </button>
        </div>

        {/* KARTU PROFIL PENGGUNA TERHUBUNG */}
        <div className={`relative overflow-hidden rounded-2xl border ${roleConfig.accentBorder} bg-gradient-to-br ${roleConfig.glowColor} via-obsidian/90 to-obsidian p-3.5 shadow-lg`}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-obsidian border border-kabut/20 font-heading text-xs font-black text-fajar shadow">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-kabut truncate" title={userName}>
                {userName || "Pengguna"}
              </p>
              <p className="text-[10px] font-mono text-kabut/60 truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-telaga-800/60">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleConfig.badgeClass}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              <span>{roleConfig.label}</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          </div>
        </div>

        {/* DAFTAR MENU UTAMA DASHBOARD */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/50 pb-1">
            Navigasi Dashboard
          </p>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`sidebar-tab-${tab.id}`}
                  onClick={() => handleTabClick(tab.id)}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "text-obsidian shadow-lg shadow-fajar/20 font-extrabold"
                      : "text-kabut/80 hover:bg-obsidian/80 hover:text-white"
                  }`}
                >
                  {isSelected ? (
                    <motion.span
                      layoutId="sidebar-active-tab-indicator"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-fajar to-amber-500"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}

                  <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                    <i
                      className={`bi ${tab.icon} text-base transition-transform group-hover:scale-110 ${
                        isSelected ? "text-obsidian" : "text-fajar"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>

                  {tab.badge ? (
                    <span
                      className={`relative z-10 rounded-full px-2 py-0.5 text-[10px] font-extrabold shadow-sm ${
                        isSelected
                          ? "bg-obsidian text-fajar"
                          : tab.badgeColor || "bg-telaga-700 text-kabut"
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

        {/* PINTASAN EKSTERNAL */}
        <div className="space-y-1 pt-3 border-t border-telaga-800/60">
          <p className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-kabut/50 pb-1">
            Pintasan Wisata
          </p>
          <nav className="space-y-1">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-kabut/75 hover:bg-obsidian/70 hover:text-sky-300 transition-colors"
            >
              <i className="bi bi-house-door-fill text-sky-400 text-sm" />
              <span>Beranda Publik</span>
            </Link>
            <Link
              href={`/${locale}/jalur`}
              className="flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-kabut/75 hover:bg-obsidian/70 hover:text-emerald-300 transition-colors"
            >
              <i className="bi bi-map-fill text-emerald-400 text-sm" />
              <span>Peta Jalur & Elevasi</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* FOOTER SIDEBAR (WAKTU WIB & TOMBOL KELUAR) */}
      <div className="space-y-3 pt-4 border-t border-telaga-800/80 mt-6">
        <div className="flex items-center justify-between px-2 text-[11px] font-mono text-kabut/60">
          <span className="flex items-center gap-1.5">
            <i className="bi bi-clock-fill text-fajar text-xs" />
            <span>Waktu Server</span>
          </span>
          <span className="text-kabut/80 font-bold">{currentTime}</span>
        </div>

        <div className="pt-1">
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. SIDEBAR PERSISTEN DESKTOP (Layar Besar lg/xl) */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col h-screen sticky top-0 border-r border-telaga-800/70 bg-obsidian/95 backdrop-blur-2xl z-30 shadow-2xl">
        {sidebarContent}
      </aside>

      {/* 2. TOP BAR KHUSUS MOBILE (Layar < lg) */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-telaga-800/80 bg-obsidian/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu navigasi samping"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-obsidian border border-telaga-700/80 text-fajar shadow hover:bg-hutan transition cursor-pointer"
          >
            <i className="bi bi-list text-xl" />
          </button>
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold text-kabut truncate">
              {title}
            </p>
            <p className="text-[10px] font-mono text-fajar truncate">
              {roleConfig.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian border border-fajar/40 text-fajar font-heading text-[10px] font-bold">
            {initials}
          </span>
        </div>
      </div>

      {/* 3. MOBILE SLIDE-OUT DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-obsidian/80 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-telaga-800/80 bg-obsidian shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

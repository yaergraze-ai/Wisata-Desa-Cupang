"use client";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type SkeletonVariant =
  | "auto"
  | "home"
  | "auth"
  | "jalur"
  | "legal"
  | "offline"
  | "dashboard-member"
  | "dashboard-staff"
  | "dashboard-admin"
  | "dashboard-super-admin";

export function resolveSkeletonVariantFromPath(
  pathname: string | null | undefined
): Exclude<SkeletonVariant, "auto"> {
  if (!pathname) return "home";
  const clean = pathname.replace(/^\/(id|en)(\/|$)/, "/");

  if (
    clean.startsWith("/masuk") ||
    clean.startsWith("/daftar") ||
    clean.startsWith("/lupa-kata-sandi") ||
    clean.startsWith("/reset-kata-sandi") ||
    clean.startsWith("/verifikasi-2fa")
  ) {
    return "auth";
  }

  if (clean.startsWith("/jalur")) {
    return "jalur";
  }

  if (
    clean.startsWith("/kebijakan-privasi") ||
    clean.startsWith("/syarat-ketentuan")
  ) {
    return "legal";
  }

  if (clean.startsWith("/offline")) {
    return "offline";
  }

  if (clean.startsWith("/dashboard/super-admin")) {
    return "dashboard-super-admin";
  }

  if (clean.startsWith("/dashboard/admin")) {
    return "dashboard-admin";
  }

  if (clean.startsWith("/dashboard/staff")) {
    return "dashboard-staff";
  }

  if (clean.startsWith("/dashboard")) {
    return "dashboard-member";
  }

  return "home";
}

function DashboardShellSkeleton({
  accentClass = "from-fajar/25 to-amber-500/10 border-fajar/40",
  children,
}: {
  accentClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat halaman dashboard..."
      className="min-h-dvh flex flex-col lg:flex-row bg-obsidian bg-topo-contour"
    >
      {/* Sidebar Desktop Skeleton */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-obsidian/95 p-4 shadow-[12px_0_36px_rgba(0,0,0,0.65)]">
        <div className="space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div
              className={cn(
                "h-9 w-9 rounded-xl bg-gradient-to-br border skeleton-shimmer shadow-md",
                accentClass
              )}
            />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-28 rounded-md bg-white/15 skeleton-shimmer" />
              <div className="h-2.5 w-20 rounded-md bg-white/10 skeleton-shimmer" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-2.5 w-20 rounded bg-white/10 mb-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-10 w-full rounded-xl border skeleton-shimmer",
                  i === 0
                    ? "bg-fajar/20 border-fajar/35 shadow-[0_8px_20px_rgba(242,166,90,0.18)]"
                    : "bg-white/[0.04] border-white/10"
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <div className="h-11 w-full rounded-xl bg-white/[0.05] border border-white/10 skeleton-shimmer" />
          <div className="h-9 w-full rounded-xl bg-red-950/35 border border-red-500/25 skeleton-shimmer" />
        </div>
      </aside>

      {/* Topbar Mobile Skeleton */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-obsidian/95 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 skeleton-shimmer" />
          <div className="h-4 w-32 rounded-md bg-white/15 skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-14 rounded-lg bg-white/10 skeleton-shimmer" />
          <div className="h-7 w-16 rounded-lg bg-white/10 skeleton-shimmer" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-hidden">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function PageShadowSkeleton({
  variant = "auto",
  className,
}: {
  variant?: SkeletonVariant;
  className?: string;
}) {
  const pathname = usePathname();
  const resolved =
    variant === "auto" ? resolveSkeletonVariantFromPath(pathname) : variant;

  // 1. SKELETON HALAMAN AUTENTIKASI (Masuk, Daftar, Lupa Sandi, Reset, 2FA)
  if (resolved === "auth") {
    return (
      <div
        aria-busy="true"
        aria-label="Memuat halaman autentikasi..."
        className={cn(
          "min-h-dvh flex flex-col bg-obsidian bg-topo-contour",
          className
        )}
      >
        <header className="sticky top-0 z-40 border-b border-kabut/15 bg-obsidian/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-fajar/35 skeleton-shimmer shadow-[0_6px_18px_rgba(242,166,90,0.2)]" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 rounded-md bg-white/15 skeleton-shimmer" />
                <div className="hidden sm:block h-2.5 w-32 rounded-md bg-white/10 skeleton-shimmer" />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-20 rounded-xl bg-white/10 border border-white/15 skeleton-shimmer" />
              <div className="h-9 w-32 rounded-xl bg-white/10 border border-white/20 skeleton-shimmer shadow-md" />
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
          <div className="w-full max-w-lg rounded-[22px] skeleton-shadow-panel p-6 sm:p-8 space-y-6">
            <div className="border-b border-kabut/15 pb-5 space-y-2.5">
              <div className="h-7 w-3/4 rounded-xl bg-white/15 skeleton-shimmer shadow-sm" />
              <div className="h-4 w-full rounded-lg bg-white/10 skeleton-shimmer" />
              <div className="h-4 w-2/3 rounded-lg bg-white/10 skeleton-shimmer" />
            </div>

            {/* Tab Toggle Skeleton (Email & Password / WhatsApp OTP) */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-obsidian/80 p-1.5 border border-white/10">
              <div className="h-10 rounded-lg bg-fajar/30 border border-fajar/45 skeleton-shimmer shadow-[0_6px_18px_rgba(242,166,90,0.22)]" />
              <div className="h-10 rounded-lg bg-white/[0.04] skeleton-shimmer" />
            </div>

            {/* Form Fields Skeleton */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-3.5 w-28 rounded-md bg-white/15 skeleton-shimmer" />
                <div className="h-11 w-full rounded-xl bg-obsidian/90 border border-white/15 skeleton-shimmer shadow-inner" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 rounded-md bg-white/15 skeleton-shimmer" />
                  <div className="h-3 w-28 rounded-md bg-fajar/25 skeleton-shimmer" />
                </div>
                <div className="h-11 w-full rounded-xl bg-obsidian/90 border border-white/15 skeleton-shimmer shadow-inner" />
              </div>
            </div>

            {/* Submit & OAuth Buttons Skeleton */}
            <div className="space-y-3 pt-1">
              <div className="h-12 w-full rounded-xl bg-gradient-to-r from-fajar/35 via-amber-500/30 to-fajar/35 border border-fajar/50 skeleton-shimmer shadow-[0_12px_30px_rgba(242,166,90,0.28)]" />
              <div className="h-11 w-full rounded-xl bg-white/[0.06] border border-white/15 skeleton-shimmer shadow-md" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. SKELETON HALAMAN PETA GPS NAVIGATOR JALUR (/jalur)
  if (resolved === "jalur") {
    return (
      <div
        aria-busy="true"
        aria-label="Memuat navigator peta jalur GPS..."
        className={cn(
          "min-h-dvh bg-obsidian bg-topo-contour px-4 py-6 sm:px-6 lg:px-8",
          className
        )}
      >
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Top Control Bar */}
          <div className="rounded-2xl skeleton-shadow-panel p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-48 rounded-full bg-telaga/25 border border-telaga-400/35 skeleton-shimmer" />
                <div className="h-8 w-80 max-w-full rounded-xl bg-white/15 skeleton-shimmer" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-44 rounded-xl bg-telaga/30 border border-telaga-400/45 skeleton-shimmer shadow-[0_8px_24px_rgba(47,143,131,0.25)]" />
                <div className="h-10 w-36 rounded-xl bg-white/10 border border-white/20 skeleton-shimmer" />
              </div>
            </div>
            <div className="h-10 w-full rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
          </div>

          {/* Map Canvas + 6 Waypoints Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-2xl skeleton-shadow-panel p-4 min-h-[460px] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3">
                <div className="h-8 w-44 rounded-xl bg-obsidian/85 border border-white/15 skeleton-shimmer" />
                <div className="h-8 w-32 rounded-xl bg-fajar/20 border border-fajar/35 skeleton-shimmer" />
              </div>
              <div className="my-4 flex-1 rounded-2xl bg-gradient-to-br from-hutan-900 via-obsidian to-telaga-950 border border-telaga-700/40 skeleton-shimmer shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-14 rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
                <div className="h-14 rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
                <div className="h-14 rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl skeleton-shadow-panel p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-fajar/20 border border-fajar/35 skeleton-shimmer" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded-md bg-white/15 skeleton-shimmer" />
                      <div className="h-3 w-24 rounded-md bg-white/10 skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="h-6 w-16 rounded-full bg-telaga/20 border border-telaga-400/30 skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. SKELETON HALAMAN DOKUMEN HUKUM (/kebijakan-privasi & /syarat-ketentuan)
  if (resolved === "legal") {
    return (
      <main
        aria-busy="true"
        aria-label="Memuat dokumen resmi..."
        className={cn(
          "min-h-dvh bg-obsidian bg-topo-contour px-4 py-12 sm:px-6",
          className
        )}
      >
        <div className="mx-auto max-w-3xl rounded-2xl skeleton-shadow-panel p-6 sm:p-10 space-y-6">
          <div className="border-b border-telaga-700/60 pb-5 space-y-3">
            <div className="h-6 w-48 rounded-full bg-fajar/20 border border-fajar/35 skeleton-shimmer" />
            <div className="h-9 w-3/4 rounded-xl bg-white/15 skeleton-shimmer" />
            <div className="h-4 w-full rounded-lg bg-white/10 skeleton-shimmer" />
          </div>

          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2.5 pt-2">
                <div className="h-5 w-56 rounded-lg bg-fajar/25 skeleton-shimmer" />
                <div className="h-3.5 w-full rounded-md bg-white/10 skeleton-shimmer" />
                <div className="h-3.5 w-11/12 rounded-md bg-white/10 skeleton-shimmer" />
                <div className="h-3.5 w-3/4 rounded-md bg-white/10 skeleton-shimmer" />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-telaga-700/60 flex items-center justify-between gap-4">
            <div className="h-11 w-44 rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer shadow-lg" />
            <div className="h-4 w-36 rounded-md bg-white/15 skeleton-shimmer" />
          </div>
        </div>
      </main>
    );
  }

  // 4. SKELETON HALAMAN OFFLINE (/offline)
  if (resolved === "offline") {
    return (
      <main
        aria-busy="true"
        aria-label="Memuat mode luar jaringan..."
        className={cn(
          "min-h-dvh flex items-center justify-center bg-obsidian bg-topo-contour p-4",
          className
        )}
      >
        <div className="w-full max-w-md rounded-2xl skeleton-shadow-panel p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-fajar/20 border border-fajar/40 skeleton-shimmer shadow-[0_10px_28px_rgba(242,166,90,0.22)]" />
          <div className="space-y-2">
            <div className="mx-auto h-7 w-3/4 rounded-xl bg-white/15 skeleton-shimmer" />
            <div className="mx-auto h-4 w-full rounded-lg bg-white/10 skeleton-shimmer" />
            <div className="mx-auto h-4 w-5/6 rounded-lg bg-white/10 skeleton-shimmer" />
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-12 w-full rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer" />
            <div className="h-12 w-full rounded-xl bg-telaga/30 border border-telaga-400/45 skeleton-shimmer" />
            <div className="h-11 w-full rounded-xl bg-white/10 border border-white/20 skeleton-shimmer" />
          </div>
        </div>
      </main>
    );
  }

  // 5. SKELETON DASHBOARD PETUGAS SCANNER (/dashboard/staff)
  if (resolved === "dashboard-staff") {
    return (
      <DashboardShellSkeleton accentClass="from-cyan-500/25 to-telaga/15 border-cyan-400/40">
        <div className="rounded-2xl skeleton-shadow-panel p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded-full bg-cyan-500/20 border border-cyan-400/35 skeleton-shimmer" />
            <div className="h-8 w-72 max-w-full rounded-xl bg-white/15 skeleton-shimmer" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-40 rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer" />
            <div className="h-10 w-40 rounded-xl bg-white/10 border border-white/15 skeleton-shimmer" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Camera QR Viewport Skeleton */}
          <div className="lg:col-span-6 rounded-2xl skeleton-shadow-panel p-5 space-y-4">
            <div className="h-5 w-48 rounded-lg bg-white/15 skeleton-shimmer" />
            <div className="aspect-square max-h-[340px] w-full rounded-2xl bg-obsidian border-2 border-dashed border-fajar/40 skeleton-shimmer shadow-[inset_0_0_60px_rgba(0,0,0,0.9)]" />
            <div className="h-11 w-full rounded-xl bg-obsidian/90 border border-white/15 skeleton-shimmer" />
          </div>

          {/* Live Gate Quota & Scan History Skeleton */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl skeleton-shadow-panel p-5 space-y-3">
              <div className="h-5 w-40 rounded-lg bg-fajar/25 skeleton-shimmer" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
                <div className="h-20 rounded-xl bg-obsidian/80 border border-white/10 skeleton-shimmer" />
              </div>
            </div>
            <div className="rounded-2xl skeleton-shadow-panel p-5 space-y-3">
              <div className="h-5 w-44 rounded-lg bg-white/15 skeleton-shimmer" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 w-full rounded-xl bg-obsidian/75 border border-white/10 skeleton-shimmer"
                />
              ))}
            </div>
          </div>
        </div>
      </DashboardShellSkeleton>
    );
  }

  // 6. SKELETON DASHBOARD ADMIN & SUPER ADMIN (/dashboard/admin & /dashboard/super-admin)
  if (resolved === "dashboard-admin" || resolved === "dashboard-super-admin") {
    const isSuper = resolved === "dashboard-super-admin";
    return (
      <DashboardShellSkeleton
        accentClass={
          isSuper
            ? "from-purple-500/25 to-fajar/15 border-purple-400/40"
            : "from-fajar/25 to-amber-500/15 border-fajar/40"
        }
      >
        <div className="rounded-2xl skeleton-shadow-panel p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-full bg-fajar/25 border border-fajar/40 skeleton-shimmer" />
            <div className="h-8 w-80 max-w-full rounded-xl bg-white/15 skeleton-shimmer" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer shadow-lg" />
        </div>

        {/* 4 KPI / Integration Status Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl skeleton-shadow-panel p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 rounded-md bg-white/15 skeleton-shimmer" />
                <div className="h-9 w-9 rounded-xl bg-fajar/20 border border-fajar/35 skeleton-shimmer" />
              </div>
              <div className="h-8 w-28 rounded-lg bg-white/20 skeleton-shimmer" />
              <div className="h-3 w-36 rounded-md bg-white/10 skeleton-shimmer" />
            </div>
          ))}
        </div>

        {/* Tab Bar + Data Grid Skeleton */}
        <div className="rounded-2xl skeleton-shadow-panel p-6 space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-9 w-28 rounded-xl border skeleton-shimmer",
                  i === 0
                    ? "bg-fajar/30 border-fajar/50"
                    : "bg-obsidian/80 border-white/10"
                )}
              />
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-obsidian/80 p-4 space-y-3 shadow-[0_14px_34px_rgba(0,0,0,0.65)]"
              >
                <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 skeleton-shimmer" />
                <div className="h-4 w-3/4 rounded-md bg-white/15 skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded-md bg-white/10 skeleton-shimmer" />
                <div className="h-9 w-full rounded-xl bg-fajar/25 skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </DashboardShellSkeleton>
    );
  }

  // 7. SKELETON DASHBOARD MEMBER (/dashboard)
  if (resolved === "dashboard-member") {
    return (
      <DashboardShellSkeleton accentClass="from-emerald-500/25 to-telaga/15 border-emerald-400/40">
        <div className="rounded-2xl skeleton-shadow-panel p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-36 rounded-full bg-telaga/25 border border-telaga-400/35 skeleton-shimmer" />
            <div className="h-8 w-64 rounded-xl bg-white/15 skeleton-shimmer" />
            <div className="h-4 w-80 max-w-full rounded-lg bg-white/10 skeleton-shimmer" />
          </div>
          <div className="h-11 w-40 rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer shadow-lg" />
        </div>

        {/* Member Navigation Tabs */}
        <div className="flex flex-wrap gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-10 w-36 rounded-xl border skeleton-shimmer",
                i === 0
                  ? "bg-fajar/30 border-fajar/50 shadow-[0_8px_22px_rgba(242,166,90,0.2)]"
                  : "bg-obsidian/85 border-white/15"
              )}
            />
          ))}
        </div>

        {/* E-Ticket Wallet Cards */}
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl skeleton-shadow-panel p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-6 w-32 rounded-full bg-fajar/25 border border-fajar/40 skeleton-shimmer" />
                <div className="h-5 w-24 rounded-md bg-white/15 skeleton-shimmer" />
              </div>
              <div className="h-7 w-3/4 rounded-lg bg-white/15 skeleton-shimmer" />
              <div className="ticket-perforation-divider my-2" />
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-36 rounded-md bg-white/10 skeleton-shimmer" />
                  <div className="h-6 w-28 rounded-lg bg-fajar/25 skeleton-shimmer" />
                </div>
                <div className="h-20 w-20 rounded-xl bg-white/15 skeleton-shimmer shadow-md" />
              </div>
            </div>
          ))}
        </div>
      </DashboardShellSkeleton>
    );
  }

  // 8. DEFAULT: SKELETON BERANDA UTAMA (/[locale])
  return (
    <div
      aria-busy="true"
      aria-label="Memuat beranda Wisata Cirebon..."
      className={cn(
        "min-h-dvh flex flex-col bg-obsidian bg-topo-contour overflow-hidden",
        className
      )}
    >
      {/* Navbar Shadow Skeleton */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/90 backdrop-blur-md px-4 py-3.5 sm:px-6 lg:px-8 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-hutan-800 to-telaga-900 border border-fajar/35 skeleton-shimmer shadow-[0_8px_24px_rgba(0,0,0,0.65)]" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-md bg-white/15 skeleton-shimmer" />
              <div className="h-2.5 w-24 rounded-md bg-white/10 skeleton-shimmer" />
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 rounded-xl bg-white/[0.06] border border-white/10 skeleton-shimmer"
              />
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-20 rounded-xl bg-white/10 border border-white/15 skeleton-shimmer" />
            <div className="h-9 w-28 rounded-xl bg-fajar/25 border border-fajar/40 skeleton-shimmer shadow-[0_8px_24px_rgba(242,166,90,0.2)]" />
          </div>
        </div>
      </div>

      {/* Hero Section & 3D Card Stack Shadow Skeleton (Menyesuaikan Urutan Mobile & Desktop) */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14 space-y-12">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-5">
          {/* Blok 1: Nama Wisata Header Skeleton */}
          <div className="order-1 lg:order-1 lg:col-span-7 space-y-3 flex flex-col items-center lg:items-start">
            <div className="flex flex-wrap justify-center lg:justify-start gap-2">
              <div className="h-7 w-56 rounded-full bg-hutan/90 border border-fajar/35 skeleton-shimmer shadow-[0_10px_28px_rgba(0,0,0,0.6)]" />
              <div className="h-7 w-28 rounded-full bg-white/10 border border-white/15 skeleton-shimmer" />
            </div>

            <div className="space-y-2.5 w-full flex flex-col items-center lg:items-start">
              <div className="h-3.5 w-24 rounded-md bg-telaga/30 skeleton-shimmer" />
              <div className="h-9 sm:h-12 w-11/12 max-w-xl rounded-2xl bg-gradient-to-r from-white/15 via-white/10 to-white/5 skeleton-shimmer shadow-[0_14px_34px_rgba(0,0,0,0.65)]" />
              <div className="h-9 sm:h-12 w-3/4 max-w-md rounded-2xl bg-gradient-to-r from-white/15 via-white/10 to-white/5 skeleton-shimmer shadow-[0_14px_34px_rgba(0,0,0,0.65)]" />
            </div>
          </div>

          {/* Blok 2: 3D Card Stack Shadow Skeleton (Tepat di Bawah Nama Wisata di Mobile) */}
          <div className="order-2 lg:order-2 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-3 flex flex-col items-center gap-4 self-center">
            <div className="relative h-[308px] sm:h-[395px] w-[246px] sm:w-[310px] rounded-[24px] border border-fajar/45 bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 p-5 flex flex-col justify-between skeleton-shimmer shadow-[0_28px_70px_rgba(0,0,0,0.88)]">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-fajar/25 border border-fajar/40" />
                <div className="h-6 w-28 rounded-full bg-obsidian/80 border border-white/20" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-md bg-fajar/25" />
                <div className="h-5 sm:h-6 w-full rounded-lg bg-white/15" />
                <div className="h-4 w-2/3 rounded-md bg-white/10" />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-md">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-9 w-24 sm:w-28 rounded-full border skeleton-shimmer shadow-[0_8px_20px_rgba(0,0,0,0.6)]",
                    i === 0
                      ? "bg-fajar/35 border-fajar/50"
                      : "bg-obsidian/90 border-white/15"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Blok 3: Panel Tiket Resmi Shadow Skeleton (Setelah Card di Mobile) */}
          <div className="order-3 lg:order-4 lg:col-span-7">
            <div className="rounded-3xl skeleton-shadow-panel p-4 sm:p-5 space-y-4 max-w-2xl mx-auto lg:mx-0">
              <div className="h-4 w-48 rounded-md bg-fajar/25 skeleton-shimmer" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 rounded-2xl border border-white/15 bg-obsidian/80 p-4 skeleton-shimmer shadow-[0_12px_28px_rgba(0,0,0,0.6)]" />
                <div className="h-28 rounded-2xl border border-fajar/40 bg-white/10 p-4 skeleton-shimmer shadow-[0_12px_28px_rgba(0,0,0,0.6)]" />
              </div>
            </div>
          </div>

          {/* Blok 4: Deskripsi & Tombol Aksi Skeleton */}
          <div className="order-4 lg:order-3 lg:col-span-7 space-y-4">
            <div className="space-y-2 max-w-lg mx-auto lg:mx-0">
              <div className="h-4 w-full rounded-lg bg-white/10 skeleton-shimmer" />
              <div className="h-4 w-3/4 mx-auto lg:mx-0 rounded-lg bg-white/10 skeleton-shimmer" />
            </div>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
              <div className="h-12 w-full sm:w-44 rounded-xl bg-fajar/30 border border-fajar/45 skeleton-shimmer shadow-[0_12px_30px_rgba(242,166,90,0.22)]" />
              <div className="h-12 w-full sm:w-44 rounded-xl bg-white/10 border border-white/15 skeleton-shimmer shadow-[0_12px_30px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


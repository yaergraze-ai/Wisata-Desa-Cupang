export default function PublicLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat halaman..."
      className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour overflow-hidden"
    >
      {/* Navbar Shadow Skeleton */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-obsidian/90 backdrop-blur-md px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-hutan-800 to-telaga-900 border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.65)]" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-md bg-white/15 shadow-sm" />
              <div className="h-2.5 w-24 rounded-md bg-white/10" />
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 rounded-xl bg-white/[0.06] border border-white/10 shadow-sm"
              />
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-20 rounded-xl bg-white/10 border border-white/15 shadow-md" />
            <div className="h-9 w-28 rounded-xl bg-fajar/25 border border-fajar/35 shadow-[0_8px_24px_rgba(242,166,90,0.2)]" />
          </div>
        </div>
      </div>

      {/* Hero Section & 3D Card Stack Shadow Skeleton */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 animate-pulse">
          {/* Left Column Skeleton */}
          <div className="lg:col-span-7 space-y-6">
            <div className="h-8 w-64 rounded-full bg-hutan/90 border border-fajar/30 shadow-[0_10px_28px_rgba(0,0,0,0.6)]" />
            <div className="space-y-3">
              <div className="h-4 w-28 rounded-md bg-telaga/30" />
              <div className="h-12 sm:h-14 w-full max-w-xl rounded-2xl bg-gradient-to-r from-white/15 via-white/10 to-white/5 shadow-[0_14px_34px_rgba(0,0,0,0.65)]" />
              <div className="h-12 sm:h-14 w-4/5 rounded-2xl bg-gradient-to-r from-white/15 via-white/10 to-white/5 shadow-[0_14px_34px_rgba(0,0,0,0.65)]" />
              <div className="h-4 w-full max-w-lg rounded-lg bg-white/10 pt-2" />
              <div className="h-4 w-3/4 rounded-lg bg-white/10" />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <div className="h-12 w-44 rounded-xl bg-fajar/30 border border-fajar/40 shadow-[0_12px_30px_rgba(242,166,90,0.22)]" />
              <div className="h-12 w-44 rounded-xl bg-white/10 border border-white/15 shadow-[0_12px_30px_rgba(0,0,0,0.6)]" />
            </div>

            {/* Live Tariff Glass Panel Shadow Skeleton */}
            <div className="rounded-3xl border border-white/15 bg-hutan/65 p-5 space-y-4 max-w-2xl shadow-[0_24px_60px_rgba(0,0,0,0.78)]">
              <div className="h-4 w-48 rounded-md bg-fajar/25" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 rounded-2xl border border-white/15 bg-obsidian/80 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.6)]" />
                <div className="h-28 rounded-2xl border border-fajar/35 bg-white/10 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.6)]" />
              </div>
            </div>
          </div>

          {/* Right Column 3D Card Stack Shadow Skeleton */}
          <div className="lg:col-span-5 flex flex-col items-center gap-5">
            <div className="relative h-[360px] sm:h-[400px] w-[275px] sm:w-[310px] rounded-[24px] border border-fajar/40 bg-gradient-to-br from-hutan-800 via-obsidian to-telaga-950 p-5 flex flex-col justify-between shadow-[0_28px_70px_rgba(0,0,0,0.88)]">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-fajar/25 border border-fajar/40 shadow-md" />
                <div className="h-6 w-24 rounded-full bg-white/15" />
              </div>
              <div className="space-y-2.5">
                <div className="h-4 w-32 rounded-md bg-fajar/25" />
                <div className="h-6 w-full rounded-lg bg-white/15" />
                <div className="h-4 w-2/3 rounded-md bg-white/10" />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-24 rounded-full bg-obsidian/90 border border-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.6)]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

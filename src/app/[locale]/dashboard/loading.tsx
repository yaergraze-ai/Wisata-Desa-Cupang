export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat dashboard..."
      className="min-h-dvh bg-obsidian bg-topo-contour p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        {/* Header Shadow Skeleton */}
        <div className="rounded-2xl border border-white/15 bg-hutan/70 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.75)] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5">
            <div className="h-5 w-36 rounded-full bg-fajar/25 border border-fajar/35" />
            <div className="h-8 w-64 rounded-xl bg-white/15 shadow-sm" />
            <div className="h-4 w-80 max-w-full rounded-lg bg-white/10" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-fajar/25 border border-fajar/40 shadow-lg" />
        </div>

        {/* Stat Cards Shadow Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-hutan/60 p-5 space-y-3 shadow-[0_18px_42px_rgba(0,0,0,0.68)]"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded-md bg-white/10" />
                <div className="h-9 w-9 rounded-xl bg-fajar/20 border border-fajar/30" />
              </div>
              <div className="h-8 w-32 rounded-lg bg-white/15" />
              <div className="h-3 w-40 rounded-md bg-white/5" />
            </div>
          ))}
        </div>

        {/* Main Content Panel Shadow Skeleton */}
        <div className="rounded-2xl border border-white/10 bg-hutan/55 p-6 space-y-4 shadow-[0_24px_60px_rgba(0,0,0,0.78)]">
          <div className="h-6 w-48 rounded-lg bg-white/15" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-48 rounded-2xl border border-white/10 bg-obsidian/80 p-4 flex flex-col justify-between shadow-[0_14px_34px_rgba(0,0,0,0.6)]"
              >
                <div className="h-24 w-full rounded-xl bg-gradient-to-br from-hutan-800 to-obsidian" />
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded-md bg-white/15" />
                  <div className="h-3 w-1/2 rounded-md bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

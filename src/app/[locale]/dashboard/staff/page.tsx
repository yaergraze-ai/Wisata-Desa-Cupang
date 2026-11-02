import { GateType, Role, ScanResult } from "@prisma/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { AppLocale } from "@/i18n/routing";
import { getWibClockParts } from "@/lib/datetime-wib";
import { requirePageRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getTodayScanHistory } from "@/server/scan/scan-service";
import { getStaffSelfState } from "@/server/staff/staff-schedule-service";
import { StaffDashboardClient } from "@/components/dashboard/staff/StaffDashboardClient";

export const dynamic = "force-dynamic";

export default async function StaffDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = rawLocale === "en" ? "en" : "id";

  const authCtx = await requirePageRole({
    locale,
    allowedRoles: [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
    currentPath: "/dashboard/staff",
  });

  try {
    const now = new Date();
    const staffState = await getStaffSelfState({
      userId: authCtx.user.id,
      locale,
      now,
    });

    const initialGate: GateType =
      (staffState.assignedGates?.[0] as GateType) || GateType.GERBANG_BATU_LAWANG;

    const todayYmd = getWibClockParts(now).dateStr;
    const startUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    const [history, admittedRows] = await Promise.all([
      getTodayScanHistory({
        gate: initialGate,
        staffUserId: authCtx.user.id,
        now,
        limit: 50,
      }).catch((e) => {
        console.error("Gagal mengambil riwayat scan hari ini:", e);
        return [];
      }),
      db.gateScan
        .findMany({
          where: {
            gate: initialGate,
            result: ScanResult.ACCEPTED,
            scannedAt: { gte: startUtc, lt: endUtc },
          },
          select: {
            ticket: { select: { admitCount: true } },
          },
        })
        .catch((e) => {
          console.error("Gagal mengambil data pengunjung admitted:", e);
          return [];
        }),
    ]);

    const initialAdmittedCount = admittedRows.reduce(
      (sum, r) => sum + (r.ticket?.admitCount ?? 0),
      0
    );

    return (
      <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
        <main className="w-full flex-1">
          <StaffDashboardClient
            locale={locale}
            initialStaff={staffState}
            initialGate={initialGate}
            initialHistory={history}
            initialAdmittedCount={initialAdmittedCount}
            authCtx={authCtx}
          />
        </main>
      </div>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Unhandled error in StaffDashboardPage:", error);

    return (
      <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 flex items-center justify-center">
          <div className="w-full surface-solid-dark p-8 rounded-3xl border border-telaga-600/50 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-3xl text-fajar">
              <i className="bi bi-shield-exclamation" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-kabut">
                Sinkronisasi Portal Petugas
              </h1>
              <p className="mt-1 text-xs text-kabut/80 leading-relaxed">
                Profil petugas sedang disinkronkan ke basis data. Silakan muat ulang halaman.
              </p>
            </div>
            <a
              href="/dashboard/staff"
              className="btn-ui btn-fajar w-full justify-center py-3 text-xs font-bold"
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              <span>Muat Ulang Halaman</span>
            </a>
          </div>
        </main>
      </div>
    );
  }
}

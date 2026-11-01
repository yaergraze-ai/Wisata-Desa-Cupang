import { GateType, Role, ScanResult } from "@prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { getWibClockParts } from "@/lib/datetime-wib";
import { requirePageRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getTodayScanHistory } from "@/server/scan/scan-service";
import { getStaffSelfState } from "@/server/staff/staff-schedule-service";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
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
    allowedRoles: [Role.STAFF],
    currentPath: "/dashboard/staff",
  });

  const now = new Date();
  const staffState = await getStaffSelfState({
    userId: authCtx.user.id,
    locale,
    now,
  });

  const initialGate: GateType =
    (staffState.assignedGates[0] as GateType) || GateType.GERBANG_BATU_LAWANG;

  const todayYmd = getWibClockParts(now).dateStr;
  const startUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const [history, admittedRows] = await Promise.all([
    getTodayScanHistory({
      gate: initialGate,
      staffUserId: authCtx.user.id,
      now,
      limit: 50,
    }),
    db.gateScan.findMany({
      where: {
        gate: initialGate,
        result: ScanResult.ACCEPTED,
        scannedAt: { gte: startUtc, lt: endUtc },
      },
      select: {
        ticket: { select: { admitCount: true } },
      },
    }),
  ]);

  const initialAdmittedCount = admittedRows.reduce(
    (sum, r) => sum + r.ticket.admitCount,
    0
  );

  return (
    <div className="min-h-dvh flex flex-col bg-obsidian bg-topo-contour">
      <DashboardTopBar locale={locale} authCtx={authCtx} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
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
}

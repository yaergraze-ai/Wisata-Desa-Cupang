import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { getAdminDashboardMetrics } from "@/server/admin/admin-metrics-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const metrics = await getAdminDashboardMetrics();
    return NextResponse.json({ metrics });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat metrik admin.";
    return NextResponse.json({ error: message }, { status });
  }
}

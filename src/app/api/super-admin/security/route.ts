import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { getSecurityOverview } from "@/server/super-admin/security-monitor-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const security = await getSecurityOverview();
    return NextResponse.json({ security });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat monitor keamanan.";
    return NextResponse.json({ error: message }, { status });
  }
}

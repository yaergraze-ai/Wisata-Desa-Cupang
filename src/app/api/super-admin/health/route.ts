import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { testAllIntegrationsHealth } from "@/server/super-admin/integration-health-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const items = await testAllIntegrationsHealth();
    return NextResponse.json({ integrations: items });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal menguji kesehatan integrasi.";
    return NextResponse.json({ error: message }, { status });
  }
}

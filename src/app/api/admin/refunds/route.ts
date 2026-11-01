import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { listRefundRequestsForAdmin } from "@/server/refund/refund-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      { headers: req.headers, requireTwoFactor: false }
    );

    const requests = await listRefundRequestsForAdmin();
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error ? err.message : "Gagal memuat antrean refund.";
    return NextResponse.json({ error: message }, { status });
  }
}

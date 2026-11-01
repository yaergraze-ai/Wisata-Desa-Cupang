import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { cancelPendingOrder } from "@/server/admin/admin-orders-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const { orderId } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };

    await cancelPendingOrder(
      orderId,
      authCtx.user.id,
      body.reason || "Dibatalkan manual oleh pengelola sistem"
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal membatalkan pesanan.";
    return NextResponse.json({ error: message }, { status });
  }
}

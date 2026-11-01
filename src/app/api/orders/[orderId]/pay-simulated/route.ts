import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import {
  simulateSettleOrder,
  OrderDomainError,
} from "@/server/orders/order-service";
import type { SupportedLocale } from "@/lib/currency";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const authCtx = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const { orderId } = await context.params;
    const rawLocale = request.nextUrl.searchParams.get("locale");
    const locale: SupportedLocale =
      rawLocale === "en" || (rawLocale === null && authCtx.user.locale === "en")
        ? "en"
        : "id";

    const order = await simulateSettleOrder({
      orderId,
      actorUserId: authCtx.user.id,
      locale,
    });

    return NextResponse.json({ success: true, order }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof OrderDomainError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Gagal memproses pembayaran simulasi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

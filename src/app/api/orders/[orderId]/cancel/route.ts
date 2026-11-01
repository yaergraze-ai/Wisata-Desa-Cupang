import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import {
  cancelPendingOrder,
  OrderDomainError,
} from "@/server/orders/order-service";
import type { SupportedLocale } from "@/lib/currency";

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

    const cancelled = await cancelPendingOrder({
      orderId,
      actorId: authCtx.user.id,
      actorRole: authCtx.user.role,
      locale,
      headers: request.headers,
    });

    return NextResponse.json({ order: cancelled }, { status: 200 });
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
    return NextResponse.json(
      { error: "Gagal membatalkan pesanan." },
      { status: 500 }
    );
  }
}

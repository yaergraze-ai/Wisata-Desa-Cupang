import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import {
  getSerializedOrderForViewer,
  OrderDomainError,
} from "@/server/orders/order-service";
import type { SupportedLocale } from "@/lib/currency";

export async function GET(
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

    const order = await getSerializedOrderForViewer({
      orderId,
      viewerId: authCtx.user.id,
      viewerRole: authCtx.user.role,
      locale,
    });

    return NextResponse.json(
      { order },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
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
      { error: "Gagal mengambil detail pesanan." },
      { status: 500 }
    );
  }
}

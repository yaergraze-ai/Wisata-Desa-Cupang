import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import {
  createCheckoutOrderAtomic,
  getMemberDashboardSnapshot,
  OrderDomainError,
} from "@/server/orders/order-service";
import type { SupportedLocale } from "@/lib/currency";

export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const rawLocale = request.nextUrl.searchParams.get("locale");
    const locale: SupportedLocale =
      rawLocale === "en" || (rawLocale === null && authCtx.user.locale === "en")
        ? "en"
        : "id";

    const snapshot = await getMemberDashboardSnapshot({
      userId: authCtx.user.id,
      locale,
    });

    return NextResponse.json(snapshot, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal memuat daftar pesanan dan dompet tiket." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const rateDecision = await checkRateLimit({
      bucket: "checkout_create_order",
      identifier: authCtx.user.id,
      maxRequests: 15,
      windowSeconds: 300,
      headers: request.headers,
      actorId: authCtx.user.id,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error:
            authCtx.user.locale === "en"
              ? "Too many checkout requests. Wait a moment before retrying."
              : "Terlalu banyak permintaan pemesanan. Tunggu sebentar sebelum mencoba lagi.",
          code: "RATE_LIMITED",
          retryAfterSeconds: rateDecision.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      visitDate?: string;
      putihQty?: number;
      regulerQty?: number;
      visitorName?: string;
      visitorWhatsapp?: string;
      locale?: string;
    } | null;

    if (!body) {
      return NextResponse.json(
        { error: "Body JSON pemesanan tidak valid.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const locale: SupportedLocale =
      body.locale === "en" || (!body.locale && authCtx.user.locale === "en")
        ? "en"
        : "id";

    const created = await createCheckoutOrderAtomic({
      userId: authCtx.user.id,
      userEmail: authCtx.user.email,
      userRole: authCtx.user.role,
      userSavedWhatsapp: authCtx.user.whatsapp,
      userWhatsappVerifiedAt: authCtx.user.whatsappVerifiedAt,
      visitDate: String(body.visitDate ?? ""),
      putihQty: Number(body.putihQty ?? 0),
      regulerQty: Number(body.regulerQty ?? 0),
      visitorName: String(body.visitorName ?? ""),
      visitorWhatsapp: String(body.visitorWhatsapp ?? ""),
      locale,
      headers: request.headers,
    });

    return NextResponse.json({ order: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof OrderDomainError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: err.details ?? null,
        },
        { status: err.status }
      );
    }
    return NextResponse.json(
      {
        error: "Terjadi kesalahan server saat memproses pemesanan tiket.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

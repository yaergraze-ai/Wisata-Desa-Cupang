import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  checkRefundEligibility,
  requestOrderRefund,
  listRefundRequestsForAdmin,
  RefundServiceError,
} from "@/server/refund/refund-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      { headers: req.headers, requireTwoFactor: false }
    );

    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      if (
        auth.user.role === Role.ADMIN ||
        auth.user.role === Role.SUPER_ADMIN ||
        auth.user.role === Role.STAFF
      ) {
        const requests = await listRefundRequestsForAdmin();
        return NextResponse.json({ requests });
      }

      return NextResponse.json(
        { error: "Parameter orderId wajib disertakan." },
        { status: 400 }
      );
    }

    const eligibility = await checkRefundEligibility(auth.user.id, orderId);
    return NextResponse.json(eligibility);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      err instanceof Error ? err.message : "Gagal memeriksa kelayakan refund.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      { headers: req.headers, requireTwoFactor: false }
    );

    const body = (await req.json()) as { orderId?: string; reason?: string };
    if (!body.orderId || typeof body.orderId !== "string") {
      return NextResponse.json(
        { error: "orderId wajib diisi." },
        { status: 400 }
      );
    }

    if (!body.reason || typeof body.reason !== "string") {
      return NextResponse.json(
        { error: "Alasan refund wajib diisi." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await requestOrderRefund(
      auth.user.id,
      body.orderId,
      body.reason,
      { ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Pengajuan refund berhasil dikirim.",
        requestId: result.id,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof RefundServiceError) {
      const status =
        err.code === "NOT_ORDER_OWNER"
          ? 403
          : err.code === "ORDER_NOT_FOUND"
            ? 404
            : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }

    const message =
      err instanceof Error ? err.message : "Gagal memproses pengajuan refund.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

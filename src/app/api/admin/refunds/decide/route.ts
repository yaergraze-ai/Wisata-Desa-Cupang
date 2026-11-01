import { NextResponse, type NextRequest } from "next/server";
import { RefundChannel, Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  decideRefundRequest,
  RefundServiceError,
} from "@/server/refund/refund-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      { requireTwoFactor: false }
    );

    const body = (await req.json()) as {
      requestId?: string;
      refundRequestId?: string;
      decision?: "APPROVE" | "REJECT";
      note?: string;
      decisionNotes?: string;
      refundChannel?: "PROVIDER_API" | "MANUAL";
    };

    const targetRequestId = body.requestId || body.refundRequestId;
    const targetNote = body.note || body.decisionNotes;

    if (!targetRequestId || typeof targetRequestId !== "string") {
      return NextResponse.json(
        { error: "requestId wajib diisi." },
        { status: 400 }
      );
    }

    if (body.decision !== "APPROVE" && body.decision !== "REJECT") {
      return NextResponse.json(
        { error: "Keputusan harus APPROVE atau REJECT." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const channel =
      body.refundChannel === "PROVIDER_API"
        ? RefundChannel.PROVIDER_API
        : RefundChannel.MANUAL;

    const result = await decideRefundRequest(
      auth.user.id,
      targetRequestId,
      {
        decision: body.decision,
        note: targetNote,
        refundChannel: channel,
      },
      { ip, userAgent }
    );

    return NextResponse.json({
      success: true,
      message:
        body.decision === "APPROVE"
          ? "Refund berhasil disetujui dan kuota telah dikembalikan."
          : "Refund berhasil ditolak.",
      request: result,
    });
  } catch (err: unknown) {
    if (err instanceof RefundServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    const message =
      err instanceof Error ? err.message : "Gagal memproses keputusan refund.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

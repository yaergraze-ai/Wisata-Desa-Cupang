import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { revealServerQrPayload } from "@/server/tickets/qr-crypto";
import { generateTicketQrPngBuffer } from "@/server/tickets/ticket-documents";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authCtx = await requireApiRole(
      [Role.MEMBER, Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const { ticketId } = await context.params;
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          select: { userId: true },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Tiket tidak ditemukan.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const isAdmin =
      authCtx.user.role === Role.ADMIN ||
      authCtx.user.role === Role.SUPER_ADMIN;

    if (ticket.order.userId !== authCtx.user.id && !isAdmin) {
      return NextResponse.json(
        {
          error: "Anda tidak memiliki izin mengakses QR tiket ini.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const qrPayload = revealServerQrPayload(ticket.qrTokenCipher);
    const pngBuffer = await generateTicketQrPngBuffer(qrPayload);
    const isDownload = request.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="qr-${ticket.publicCode}.png"`,
        "Cache-Control": "private, max-age=3600",
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
      { error: "Gagal membuat gambar QR tiket." },
      { status: 500 }
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { revealServerQrPayload } from "@/server/tickets/qr-crypto";
import { generateTicketPdfBuffer } from "@/server/tickets/ticket-documents";
import { formatUtcDateToYmd } from "@/lib/datetime-wib";
import type { SupportedLocale } from "@/lib/currency";

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
        order: true,
        orderItem: true,
        product: true,
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
          error: "Anda tidak memiliki izin mengunduh PDF tiket ini.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const queryLocale = request.nextUrl.searchParams.get("locale");
    const locale: SupportedLocale =
      queryLocale === "en" ||
      (!queryLocale &&
        (authCtx.user.locale === "en" || ticket.order.locale === "en"))
        ? "en"
        : "id";

    const qrPayload = revealServerQrPayload(ticket.qrTokenCipher);
    const pdfBuffer = await generateTicketPdfBuffer(
      {
        publicCode: ticket.publicCode,
        orderNumber: ticket.order.orderNumber,
        productCode: ticket.product.code,
        productName:
          locale === "en" ? ticket.product.nameEn : ticket.product.nameId,
        visitorName: ticket.visitorName,
        visitorWhatsapp: ticket.visitorWhatsapp,
        visitDateYmd: formatUtcDateToYmd(ticket.visitDate),
        admitCount: ticket.admitCount,
        unitBase: ticket.orderItem.unitBase,
        unitParking: ticket.orderItem.unitParking,
        unitTotal: ticket.orderItem.unitTotal,
        subtotal: ticket.orderItem.subtotal,
        allowedGates: ticket.product.allowedGates,
        qrPayload,
        status: ticket.status,
        issuedAt: ticket.issuedAt,
      },
      locale
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="e-ticket-${ticket.publicCode}.pdf"`,
        "Cache-Control": "private, no-store",
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
      { error: "Gagal menghasilkan dokumen PDF tiket." },
      { status: 500 }
    );
  }
}

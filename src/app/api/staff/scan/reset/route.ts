import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { extractTicketLookupCriteria } from "@/server/scan/scan-service";

export async function POST(request: NextRequest) {
  try {
    const authCtx = await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const body = (await request.json().catch(() => null)) as {
      ticketId?: string;
      publicCode?: string;
    } | null;

    if (!body || (!body.ticketId && !body.publicCode)) {
      return NextResponse.json(
        { error: "Parameter ticketId atau publicCode wajib diisi." },
        { status: 400 }
      );
    }

    const where = body.ticketId
      ? { id: body.ticketId }
      : extractTicketLookupCriteria(body.publicCode || "");

    if (!where) {
      return NextResponse.json(
        { error: "Format kode tiket tidak valid." },
        { status: 400 }
      );
    }

    const ticket = await db.ticket.findUnique({
      where,
      select: { id: true, publicCode: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const deleted = await db.gateScan.deleteMany({
      where: { ticketId: ticket.id },
    });

    return NextResponse.json({
      success: true,
      message: `Pindaian tiket ${ticket.publicCode} berhasil direset (${deleted.count} rekaman dihapus). Tiket siap dipindai kembali.`,
      ticketId: ticket.id,
      publicCode: ticket.publicCode,
    });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal mereset status pindaian tiket." },
      { status: 500 }
    );
  }
}

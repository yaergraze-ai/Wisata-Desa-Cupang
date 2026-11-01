import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { revealTicketContactForStaff } from "@/server/scan/scan-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authCtx = await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const { ticketId } = await context.params;
    const body = (await request.json().catch(() => null)) as { reason?: string } | null;
    const reason = body?.reason?.trim() ?? "";

    if (reason.length < 5) {
      return NextResponse.json(
        {
          error: "Alasan darurat/operasional wajib diisi minimal 5 karakter.",
          code: "REASON_REQUIRED",
        },
        { status: 400 }
      );
    }

    const contact = await revealTicketContactForStaff({
      ticketId,
      staffUserId: authCtx.user.id,
      staffRole: authCtx.user.role,
      reason,
      headers: request.headers,
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Tiket tidak ditemukan.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal menampilkan nomor kontak pengunjung." },
      { status: 500 }
    );
  }
}

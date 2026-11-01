import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { requestSuddenLeave, StaffDomainError } from "@/server/staff/staff-schedule-service";
import type { SupportedLocale } from "@/lib/currency";

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
      reason?: string;
      locale?: string;
    } | null;

    const locale: SupportedLocale =
      body?.locale === "en" || authCtx.user.locale === "en" ? "en" : "id";

    const state = await requestSuddenLeave({
      userId: authCtx.user.id,
      reason: body?.reason,
      locale,
      headers: request.headers,
    });

    return NextResponse.json({ staff: state }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof StaffDomainError) {
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal mengajukan libur mendadak." },
      { status: 500 }
    );
  }
}

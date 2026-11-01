import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { searchTicketsForStaff } from "@/server/scan/scan-service";
import type { SupportedLocale } from "@/lib/currency";

export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const query = request.nextUrl.searchParams.get("q") ?? "";
    const rawLocale = request.nextUrl.searchParams.get("locale");
    const locale: SupportedLocale =
      rawLocale === "en" || authCtx.user.locale === "en" ? "en" : "id";

    const tickets = await searchTicketsForStaff({
      query,
      locale,
    });

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal mencari data tiket." },
      { status: 500 }
    );
  }
}

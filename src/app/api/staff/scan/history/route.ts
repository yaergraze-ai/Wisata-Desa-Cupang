import { NextResponse, type NextRequest } from "next/server";
import { GateType, Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { getTodayScanHistory } from "@/server/scan/scan-service";

export async function GET(request: NextRequest) {
  try {
    const authCtx = await requireApiRole(
      [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN],
      {
        headers: request.headers,
        requireTwoFactor: false,
      }
    );

    const rawGate = request.nextUrl.searchParams.get("gate");
    const gate =
      rawGate === GateType.GERBANG_BATU_LAWANG || rawGate === GateType.PINTU_GUNUNG_BENDERA
        ? (rawGate as GateType)
        : undefined;

    const history = await getTodayScanHistory({
      gate,
      staffUserId: authCtx.user.role === Role.STAFF ? authCtx.user.id : undefined,
      limit: 50,
    });

    return NextResponse.json({ history }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Gagal memuat riwayat pemindaian hari ini." },
      { status: 500 }
    );
  }
}

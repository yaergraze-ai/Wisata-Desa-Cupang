import { NextResponse, type NextRequest } from "next/server";
import { GateType, Role } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { scanTicketAtGate } from "@/server/scan/scan-service";
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

    const rateDecision = await checkRateLimit({
      bucket: "staff_scan_gate",
      identifier: authCtx.user.id,
      maxRequests: 120,
      windowSeconds: 60,
      headers: request.headers,
      actorId: authCtx.user.id,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error: "Terlalu banyak permintaan scan dalam 1 menit. Mohon tunggu.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      rawInput?: string;
      gate?: string;
      locale?: string;
      nowIso?: string;
    } | null;

    if (!body || !body.rawInput || !body.gate) {
      return NextResponse.json(
        { error: "Parameter rawInput dan gate wajib diisi.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    if (
      body.gate !== GateType.GERBANG_BATU_LAWANG &&
      body.gate !== GateType.PINTU_GUNUNG_BENDERA
    ) {
      return NextResponse.json(
        { error: "Tipe gerbang tidak valid.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const locale: SupportedLocale =
      body.locale === "en" || authCtx.user.locale === "en" ? "en" : "id";

    const scanTimeHeader = request.headers.get("x-scan-time");
    const scanTimeRaw = scanTimeHeader || body.nowIso;
    const customNow = scanTimeRaw ? new Date(scanTimeRaw) : undefined;
    const now = customNow && !isNaN(customNow.getTime()) ? customNow : undefined;

    const outcome = await scanTicketAtGate({
      rawInput: body.rawInput,
      gate: body.gate as GateType,
      staffUserId: authCtx.user.id,
      staffRole: authCtx.user.role,
      staffAssignedGates: authCtx.user.assignedGates,
      locale,
      headers: request.headers,
      now,
    });

    return NextResponse.json(outcome, { status: 200 });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Kesalahan server saat memvalidasi tiket gerbang." },
      { status: 500 }
    );
  }
}

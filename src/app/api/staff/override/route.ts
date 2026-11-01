import { NextResponse, type NextRequest } from "next/server";
import { Role, StaffOverrideMode } from "@prisma/client";
import { AuthGuardError, requireApiRole } from "@/server/auth/guards";
import { updateStaffSelfOverride, StaffDomainError } from "@/server/staff/staff-schedule-service";
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
      overrideMode?: string;
      overrideHours?: number;
      locale?: string;
    } | null;

    if (!body?.overrideMode) {
      return NextResponse.json(
        { error: "Mode override wajib ditentukan.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const validModes: string[] = [
      StaffOverrideMode.FOLLOW_SCHEDULE,
      StaffOverrideMode.FORCE_ACTIVE,
      StaffOverrideMode.FORCE_INACTIVE,
    ];
    if (!validModes.includes(body.overrideMode)) {
      return NextResponse.json(
        { error: "Nilai mode override tidak valid.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const locale: SupportedLocale =
      body.locale === "en" || authCtx.user.locale === "en" ? "en" : "id";

    const state = await updateStaffSelfOverride({
      userId: authCtx.user.id,
      overrideMode: body.overrideMode as StaffOverrideMode,
      overrideHours: body.overrideHours,
      locale,
      headers: request.headers,
    });

    return NextResponse.json({ staff: state }, { status: 200 });
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
      { error: "Gagal memperbarui status dinas petugas." },
      { status: 500 }
    );
  }
}

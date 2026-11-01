import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import {
  AuthGuardError,
  requireApiRole,
  verifyLiveUserTotp,
} from "@/server/auth/guards";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { writeAuditLog } from "@/server/audit/audit";

const stepUpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Kode TOTP harus 6 digit angka"),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireApiRole([Role.SUPER_ADMIN], {
      headers: request.headers,
      requireTwoFactor: true,
    });

    const limit = await checkRateLimit({
      bucket: "auth-step-up",
      identifier: ctx.user.id,
      maxRequests: 8,
      windowSeconds: 300,
      headers: request.headers,
      actorId: ctx.user.id,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 }
      );
    }

    const body: unknown = await request.json();
    const parsed = stepUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }

    const valid = await verifyLiveUserTotp(ctx.user.id, parsed.data.code);
    if (!valid) {
      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "AUTH_STEP_UP_FAILED",
        entity: "Session",
        entityId: ctx.sessionId,
        headers: request.headers,
      });
      return NextResponse.json({ code: "INVALID_TOTP" }, { status: 400 });
    }

    const verifiedAt = new Date();
    await db.session.update({
      where: { id: ctx.sessionId },
      data: { stepUpVerifiedAt: verifiedAt },
    });

    await writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: "AUTH_STEP_UP_VERIFIED",
      entity: "Session",
      entityId: ctx.sessionId,
      headers: request.headers,
    });

    return NextResponse.json({
      ok: true,
      stepUpVerifiedAt: verifiedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

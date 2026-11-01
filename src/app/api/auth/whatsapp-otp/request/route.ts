import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { AuthGuardError, requireApiAuth } from "@/server/auth/guards";
import { requestWhatsappOtp } from "@/server/auth/whatsapp-otp";

const schema = z.object({
  whatsapp: z.string().min(9).max(20),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireApiAuth(request.headers);
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PHONE" }, { status: 400 });
    }

    const res = await requestWhatsappOtp({
      rawPhone: parsed.data.whatsapp,
      purpose: OtpPurpose.VERIFY_WHATSAPP,
      locale: ctx.user.locale,
      userId: ctx.user.id,
      headers: request.headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        { code: res.code },
        { status: res.code === "RATE_LIMITED" ? 429 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresAt: res.expiresAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json({ code: err.code }, { status: err.status });
    }
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

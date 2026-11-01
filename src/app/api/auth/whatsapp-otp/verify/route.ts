import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { db } from "@/server/db";
import { AuthGuardError, requireApiAuth } from "@/server/auth/guards";
import { consumeWhatsappOtp } from "@/server/auth/whatsapp-otp";

const schema = z.object({
  whatsapp: z.string().min(9).max(20),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireApiAuth(request.headers);
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    }

    const res = await consumeWhatsappOtp({
      rawPhone: parsed.data.whatsapp,
      code: parsed.data.code,
      purpose: OtpPurpose.VERIFY_WHATSAPP,
      headers: request.headers,
    });

    if (!res.ok) {
      return NextResponse.json({ code: res.code }, { status: 400 });
    }

    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        whatsapp: res.phone,
        phoneNumber: res.phone,
        phoneNumberVerified: true,
        whatsappVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, whatsapp: res.phone });
  } catch (err) {
    if (err instanceof AuthGuardError) {
      return NextResponse.json({ code: err.code }, { status: err.status });
    }
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

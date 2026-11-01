import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { getServerAuthContext } from "@/server/auth/guards";
import { requestWhatsappOtp } from "@/server/auth/whatsapp-otp";

const schema = z.object({
  whatsapp: z.string().min(8).max(20).optional(),
  phone: z.string().min(8).max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const authCtx = await getServerAuthContext(request.headers);
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PHONE", error: "Nomor WhatsApp tidak valid." }, { status: 400 });
    }

    const rawPhone = parsed.data.whatsapp || parsed.data.phone;
    if (!rawPhone) {
      return NextResponse.json({ code: "INVALID_PHONE", error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }

    const res = await requestWhatsappOtp({
      rawPhone,
      purpose: authCtx ? OtpPurpose.VERIFY_WHATSAPP : OtpPurpose.LOGIN,
      locale: authCtx?.user.locale ?? "id",
      userId: authCtx?.user.id ?? null,
      headers: request.headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          code: res.code,
          error:
            res.code === "RATE_LIMITED"
              ? "Terlalu banyak permintaan OTP. Tunggu beberapa saat."
              : "Gagal meminta kode OTP.",
        },
        { status: res.code === "RATE_LIMITED" ? 429 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      expiresAt: res.expiresAt.toISOString(),
      demoCode: res.demoCode,
    });
  } catch {
    return NextResponse.json({ code: "INTERNAL_ERROR", error: "Terjadi kesalahan internal server." }, { status: 500 });
  }
}

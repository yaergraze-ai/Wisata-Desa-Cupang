import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose } from "@prisma/client";
import { db } from "@/server/db";
import { getServerAuthContext } from "@/server/auth/guards";
import { consumeWhatsappOtp } from "@/server/auth/whatsapp-otp";

const schema = z.object({
  whatsapp: z.string().min(8).max(20).optional(),
  phone: z.string().min(8).max(20).optional(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const authCtx = await getServerAuthContext(request.headers);
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_INPUT", error: "Format input kode atau nomor tidak valid." }, { status: 400 });
    }

    const rawPhone = parsed.data.whatsapp || parsed.data.phone;
    if (!rawPhone) {
      return NextResponse.json({ code: "INVALID_PHONE", error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }

    if (authCtx) {
      // 1. Verifikasi WhatsApp untuk profil pengguna yang sedang login
      let res = await consumeWhatsappOtp({
        rawPhone,
        code: parsed.data.code,
        purpose: OtpPurpose.VERIFY_WHATSAPP,
        headers: request.headers,
      });

      if (!res.ok) {
        // Fallback coba consume purpose LOGIN jika OTP sebelumnya dikirim sebagai login
        res = await consumeWhatsappOtp({
          rawPhone,
          code: parsed.data.code,
          purpose: OtpPurpose.LOGIN,
          headers: request.headers,
        });
      }

      if (!res.ok) {
        return NextResponse.json(
          {
            code: res.code,
            error:
              res.code === "INVALID_OTP"
                ? "Kode OTP salah. Periksa kembali kode 6-digit Anda."
                : res.code === "OTP_EXPIRED_OR_NOT_FOUND"
                ? "Kode OTP telah kedaluwarsa atau tidak ditemukan."
                : res.code === "OTP_LOCKED"
                ? "Batas percobaan terlampaui. Silakan minta kode baru."
                : "Gagal memverifikasi kode OTP.",
          },
          { status: 400 }
        );
      }

      await db.user.update({
        where: { id: authCtx.user.id },
        data: {
          whatsapp: res.phone,
          phoneNumber: res.phone,
          phoneNumberVerified: true,
          whatsappVerifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        whatsapp: res.phone,
        message: "Nomor WhatsApp berhasil diverifikasi!",
      });
    }

    // 2. Alur Login WhatsApp tanpa sesi awal
    const res = await consumeWhatsappOtp({
      rawPhone,
      code: parsed.data.code,
      purpose: OtpPurpose.LOGIN,
      headers: request.headers,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          code: res.code,
          error:
            res.code === "INVALID_OTP"
              ? "Kode OTP salah. Periksa kembali kode 6-digit Anda."
              : "Gagal memverifikasi kode OTP.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, phone: res.phone });
  } catch {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Terjadi kesalahan internal saat verifikasi OTP." },
      { status: 500 }
    );
  }
}

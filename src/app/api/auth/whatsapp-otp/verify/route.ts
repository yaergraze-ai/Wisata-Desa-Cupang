import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { OtpPurpose, Role } from "@prisma/client";
import { db } from "@/server/db";
import { getRoleHomePath, getServerAuthContext } from "@/server/auth/guards";
import { consumeWhatsappOtp } from "@/server/auth/whatsapp-otp";
import { makeSignature } from "better-auth/crypto";
import { getEnv } from "@/server/env";
import { writeAuditLog } from "@/server/audit/audit";

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
              : res.code === "OTP_EXPIRED_OR_NOT_FOUND"
              ? "Kode OTP telah kedaluwarsa atau tidak ditemukan."
              : res.code === "OTP_LOCKED"
              ? "Batas percobaan terlampaui. Silakan minta kode baru."
              : "Gagal memverifikasi kode OTP.",
        },
        { status: 400 }
      );
    }

    const normalizedPhone = res.phone;
    let user = await db.user.findFirst({
      where: {
        OR: [
          { whatsapp: normalizedPhone },
          { phoneNumber: normalizedPhone },
        ],
        deletedAt: null,
      },
    });

    if (!user) {
      // Pendaftaran otomatis jika akun pengunjung baru masuk via nomor WhatsApp
      const digits = normalizedPhone.replace(/\D/g, "");
      const tempEmail = `wa_${digits}@user.wisatacirebon.id`;
      const tempName = `Pengunjung ${normalizedPhone.slice(-4)}`;
      user = await db.user.create({
        data: {
          name: tempName,
          email: tempEmail,
          emailVerified: false,
          whatsapp: normalizedPhone,
          phoneNumber: normalizedPhone,
          phoneNumberVerified: true,
          whatsappVerifiedAt: new Date(),
          role: Role.MEMBER,
          locale: "id",
          consentAt: new Date(),
        },
      });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          whatsapp: normalizedPhone,
          phoneNumber: user.phoneNumber || normalizedPhone,
          phoneNumberVerified: true,
          whatsappVerifiedAt: user.whatsappVerifiedAt || new Date(),
        },
      });
    }

    if (user.banned) {
      return NextResponse.json(
        { code: "USER_BANNED", error: "Akun Anda telah dinonaktifkan." },
        { status: 403 }
      );
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 hari

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    const session = await db.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt: sessionExpiresAt,
        ipAddress,
        userAgent,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: "AUTH_LOGIN_SUCCESS",
      entity: "Session",
      entityId: session.id,
      headers: request.headers,
      metadata: { method: "whatsapp-otp" },
    }).catch(() => undefined);

    const env = getEnv();
    const signature = await makeSignature(sessionToken, env.BETTER_AUTH_SECRET);
    const signedValue = `${sessionToken}.${signature}`;
    const homePath = getRoleHomePath(user.role);

    const response = NextResponse.json({
      ok: true,
      phone: res.phone,
      homePath,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    const isSecure =
      request.url.startsWith("https:") ||
      (process.env.NODE_ENV === "production" &&
        !request.url.startsWith("http://localhost"));

    response.cookies.set("better-auth.session_token", signedValue, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      expires: sessionExpiresAt,
    });

    if (isSecure) {
      response.cookies.set("__Secure-better-auth.session_token", signedValue, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: sessionExpiresAt,
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Terjadi kesalahan internal saat verifikasi OTP." },
      { status: 500 }
    );
  }
}

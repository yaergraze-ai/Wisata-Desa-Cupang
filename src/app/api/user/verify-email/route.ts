import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { makeSignature } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { getRoleHomePath, getServerAuthContext } from "@/server/auth/guards";
import {
  generateRandomSixDigitOtp,
  verifyOtpHashConstantTime,
} from "@/server/auth/whatsapp-otp";
import { sendOtpEmailMessage } from "@/server/integrations/email/email-service";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { writeAuditLog } from "@/server/audit/audit";

const emailVerifySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    email: z.string().trim().email("Format alamat email tidak valid.").optional(),
    locale: z.enum(["id", "en"]).optional().default("id"),
  }),
  z.object({
    action: z.literal("verify"),
    code: z.string().trim().regex(/^\d{6}$/, "Kode OTP wajib 6 digit angka."),
    email: z.string().trim().email("Format alamat email tidak valid.").optional(),
    locale: z.enum(["id", "en"]).optional().default("id"),
  }),
]);

function hashEmailOtpCode(email: string, code: string): string {
  const secret = getEnv().BETTER_AUTH_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(`email-verify:${email.toLowerCase()}:${code.trim()}`)
    .digest("hex");
}

function deriveDisplayNameFromEmail(email: string): string {
  const prefix = email.split("@")[0] ?? "Wisatawan";
  const cleaned = prefix
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim();
  if (cleaned.length < 2) {
    return "Wisatawan Cirebon";
  }
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const authCtx = await getServerAuthContext(request.headers).catch(() => null);
    const body = await request.json().catch(() => null);
    const parsed = emailVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Permintaan verifikasi email tidak valid.",
        },
        { status: 400 }
      );
    }

    const rawTargetEmail = parsed.data.email ?? authCtx?.user.email;
    if (!rawTargetEmail || !rawTargetEmail.includes("@")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Masukkan alamat email resmi Anda terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const targetEmail = rawTargetEmail.trim().toLowerCase();
    const identifier = `email-verify:${targetEmail}`;

    if (parsed.data.action === "request") {
      const rate = await checkRateLimit({
        bucket: "email-otp-send",
        identifier: targetEmail,
        maxRequests: 8,
        windowSeconds: 300,
        headers: request.headers,
        actorId: authCtx?.user.id ?? null,
      });

      if (!rate.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Terlalu banyak permintaan OTP email. Silakan tunggu beberapa saat.",
          },
          { status: 429 }
        );
      }

      const existingUser = await db.user.findUnique({
        where: { email: targetEmail },
        include: {
          accounts: {
            select: { providerId: true },
          },
        },
      });

      if (existingUser && (existingUser.deletedAt || existingUser.banned)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Akun dengan alamat email ini sedang dinonaktifkan.",
          },
          { status: 403 }
        );
      }

      const code = generateRandomSixDigitOtp();
      const codeHash = hashEmailOtpCode(targetEmail, code);
      const expiresAt = new Date(Date.now() + 5 * 60_000);

      await db.verification.deleteMany({
        where: { identifier },
      });

      await db.verification.create({
        data: {
          id: crypto.randomUUID(),
          identifier,
          value: codeHash,
          expiresAt,
        },
      });

      const recipientName =
        existingUser?.name ??
        authCtx?.user.name ??
        deriveDisplayNameFromEmail(targetEmail);

      const sendRes = await sendOtpEmailMessage({
        to: targetEmail,
        name: recipientName,
        code,
        locale: parsed.data.locale,
      });

      const isGoogleRecorded = Boolean(
        existingUser?.accounts.some((a) => a.providerId === "google")
      );

      return NextResponse.json({
        ok: true,
        expiresAt: expiresAt.toISOString(),
        delivered: sendRes.delivered,
        email: targetEmail,
        isGoogleRecorded,
        demoCode: code,
      });
    }

    // action === "verify"
    const verifRecord = await db.verification.findFirst({
      where: {
        identifier,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verifRecord) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Kode OTP email sudah kedaluwarsa atau belum diminta. Silakan kirim ulang kode.",
        },
        { status: 400 }
      );
    }

    const candidateHash = hashEmailOtpCode(targetEmail, parsed.data.code);
    const valid = verifyOtpHashConstantTime(verifRecord.value, candidateHash);

    if (!valid) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kode OTP email tidak sesuai. Silakan periksa kembali 6 digit kode Anda.",
        },
        { status: 400 }
      );
    }

    await db.verification.delete({
      where: { id: verifRecord.id },
    });

    // KASUS 1: Pengguna sudah masuk (verifikasi dari tab Profil Dashboard)
    if (authCtx) {
      await db.user.update({
        where: { id: authCtx.user.id },
        data: {
          emailVerified: true,
        },
      });

      await writeAuditLog({
        actorId: authCtx.user.id,
        actorRole: authCtx.user.role,
        action: "EMAIL_OTP_VERIFIED",
        entity: "User",
        entityId: authCtx.user.id,
        headers: request.headers,
        metadata: { email: targetEmail },
      }).catch(() => undefined);

      return NextResponse.json({
        ok: true,
        homePath: getRoleHomePath(authCtx.user.role),
      });
    }

    // KASUS 2: Pengguna masuk melalui halaman /masuk dengan OTP Email
    let user = await db.user.findUnique({
      where: { email: targetEmail },
    });

    if (user && (user.deletedAt || user.banned)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akun ini telah dinonaktifkan.",
        },
        { status: 403 }
      );
    }

    if (!user) {
      user = await db.user.create({
        data: {
          name: deriveDisplayNameFromEmail(targetEmail),
          email: targetEmail,
          emailVerified: true,
          role: Role.MEMBER,
          locale: parsed.data.locale,
          consentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "AUTH_REGISTER_EMAIL_OTP",
        entity: "User",
        entityId: user.id,
        headers: request.headers,
        metadata: { email: targetEmail },
      }).catch(() => undefined);
    } else if (!user.emailVerified) {
      user = await db.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") ?? null;

    const session = await db.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt,
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
      metadata: { method: "email-otp", email: targetEmail },
    }).catch(() => undefined);

    const env = getEnv();
    const isSecure =
      request.url.startsWith("https:") ||
      (process.env.NODE_ENV === "production" &&
        !request.url.startsWith("http://localhost"));
    const signature = await makeSignature(sessionToken, env.BETTER_AUTH_SECRET);
    const signedCookieValue = `${sessionToken}.${signature}`;

    const response = NextResponse.json({
      ok: true,
      homePath: getRoleHomePath(user.role),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set("better-auth.session_token", signedCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      expires: expiresAt,
    });

    if (isSecure) {
      response.cookies.set(
        "__Secure-better-auth.session_token",
        signedCookieValue,
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: true,
          expires: expiresAt,
        }
      );
    }

    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses verifikasi OTP email.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

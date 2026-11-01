import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { requireApiAuth } from "@/server/auth/guards";
import { sendOtpEmailMessage } from "@/server/integrations/email/email-service";
import { getIntegrationFlags } from "@/server/env";

const requestSchema = z.object({
  action: z.literal("request"),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  code: z.string().regex(/^\d{6}$/),
});

const schema = z.discriminatedUnion("action", [requestSchema, verifySchema]);

export async function POST(request: Request) {
  try {
    const authCtx = await requireApiAuth(request.headers);
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Format permintaan tidak valid." },
        { status: 400 }
      );
    }

    const userId = authCtx.user.id;
    const identifier = `email-verify:${userId}`;

    if (parsed.data.action === "request") {
      // 1. Generate 6-digit secure numeric OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

      // Simpan di tabel verification
      await db.verification.deleteMany({
        where: { identifier },
      });

      await db.verification.create({
        data: {
          identifier,
          value: codeHash,
          expiresAt,
        },
      });

      // Kirim email
      const delivery = await sendOtpEmailMessage({
        to: authCtx.user.email,
        name: authCtx.user.name,
        code,
        locale: authCtx.user.locale,
      });

      const flags = getIntegrationFlags();
      const showDemo = !flags.smtpEmail || !delivery.configured || Boolean(delivery.error);

      return NextResponse.json({
        ok: true,
        message: "Kode OTP telah dikirim ke email Anda.",
        expiresAt: expiresAt.toISOString(),
        demoCode: showDemo ? code : undefined,
      });
    }

    if (parsed.data.action === "verify") {
      const record = await db.verification.findFirst({
        where: {
          identifier,
          expiresAt: { gt: new Date() },
        },
      });

      if (!record) {
        return NextResponse.json(
          { error: "Kode OTP telah kedaluwarsa atau belum diminta." },
          { status: 400 }
        );
      }

      const inputHash = crypto
        .createHash("sha256")
        .update(parsed.data.code)
        .digest("hex");

      if (record.value !== inputHash) {
        return NextResponse.json(
          { error: "Kode OTP salah. Periksa kembali kotak masuk surel Anda." },
          { status: 400 }
        );
      }

      // Tandai email terverifikasi
      await Promise.all([
        db.user.update({
          where: { id: userId },
          data: { emailVerified: true },
        }),
        db.verification.deleteMany({
          where: { identifier },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        message: "Email berhasil diverifikasi!",
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan internal server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

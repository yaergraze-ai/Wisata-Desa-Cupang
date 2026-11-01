import "server-only";
import crypto from "node:crypto";
import { OtpPurpose } from "@prisma/client";
import { db } from "@/server/db";
import { getEnv, getIntegrationFlags } from "@/server/env";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";
import type { SupportedLocale } from "@/lib/currency";
import { sendWhatsappMessage } from "@/server/integrations/whatsapp/whatsapp-service";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { writeAuditLog } from "@/server/audit/audit";

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

export function hashWhatsappOtpCode(phoneE164: string, code: string): string {
  const secret = getEnv().BETTER_AUTH_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(`${phoneE164}:${code.trim()}`)
    .digest("hex");
}

export function verifyOtpHashConstantTime(
  expectedHex: string,
  candidateHex: string
): boolean {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(candidateHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateRandomSixDigitOtp(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export async function requestWhatsappOtp(params: {
  rawPhone: string;
  purpose: OtpPurpose;
  locale: SupportedLocale;
  userId?: string | null;
  headers?: Headers;
}): Promise<{ ok: true; expiresAt: Date; demoCode?: string } | { ok: false; code: string }> {
  const phone = normalizeIndonesianWhatsapp(params.rawPhone);
  if (!phone) {
    return { ok: false, code: "INVALID_PHONE" };
  }

  const rate = await checkRateLimit({
    bucket: "wa-otp-send",
    identifier: phone,
    maxRequests: 5,
    windowSeconds: 300,
    headers: params.headers,
    actorId: params.userId ?? null,
  });
  if (!rate.allowed) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const code = generateRandomSixDigitOtp();
  const codeHash = hashWhatsappOtpCode(phone, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const record = await db.whatsappOtp.create({
    data: {
      phone,
      userId: params.userId ?? null,
      purpose: params.purpose,
      codeHash,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
    },
  });

  const text =
    params.locale === "en"
      ? `[Wisata Cirebon] Your verification code is ${code}. Valid for ${OTP_TTL_MINUTES} minutes. Never share this code with anyone.`
      : `[Wisata Cirebon] Kode verifikasi Anda adalah ${code}. Berlaku ${OTP_TTL_MINUTES} menit. Jangan bagikan kode ini kepada siapa pun.`;

  const delivery = await sendWhatsappMessage(phone, text);

  await writeAuditLog({
    actorId: params.userId ?? null,
    action: "WA_OTP_REQUESTED",
    entity: "WhatsappOtp",
    entityId: record.id,
    headers: params.headers,
    metadata: { purpose: params.purpose, delivered: delivery.delivered },
  });

  const flags = getIntegrationFlags();
  const showDemo = !flags.whatsapp || !delivery.configured || Boolean(delivery.error);

  return {
    ok: true,
    expiresAt,
    demoCode: showDemo ? code : undefined,
  };
}

export async function consumeWhatsappOtp(params: {
  rawPhone: string;
  code: string;
  purpose: OtpPurpose;
  headers?: Headers;
}): Promise<
  | { ok: true; phone: string; userId: string | null }
  | { ok: false; code: "INVALID_PHONE" | "OTP_EXPIRED_OR_NOT_FOUND" | "OTP_LOCKED" | "INVALID_OTP" }
> {
  const phone = normalizeIndonesianWhatsapp(params.rawPhone);
  if (!phone) {
    return { ok: false, code: "INVALID_PHONE" };
  }

  const latest = await db.whatsappOtp.findFirst({
    where: {
      phone,
      purpose: params.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, code: "OTP_EXPIRED_OR_NOT_FOUND" };
  }

  if (latest.attempts >= latest.maxAttempts) {
    return { ok: false, code: "OTP_LOCKED" };
  }

  const candidateHash = hashWhatsappOtpCode(phone, params.code);
  const valid = verifyOtpHashConstantTime(latest.codeHash, candidateHash);

  if (!valid) {
    await db.whatsappOtp.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
    });
    await writeAuditLog({
      actorId: latest.userId,
      action: "WA_OTP_FAILED",
      entity: "WhatsappOtp",
      entityId: latest.id,
      headers: params.headers,
      metadata: { purpose: params.purpose, attempts: latest.attempts + 1 },
    });
    return { ok: false, code: "INVALID_OTP" };
  }

  await db.whatsappOtp.update({
    where: { id: latest.id },
    data: { consumedAt: new Date() },
  });

  await writeAuditLog({
    actorId: latest.userId,
    action: "WA_OTP_VERIFIED",
    entity: "WhatsappOtp",
    entityId: latest.id,
    headers: params.headers,
    metadata: { purpose: params.purpose },
  });

  return { ok: true, phone, userId: latest.userId };
}

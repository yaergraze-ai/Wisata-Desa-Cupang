import "server-only";
import nodemailer from "nodemailer";
import { getEnv, getIntegrationFlags } from "@/server/env";
import type { SupportedLocale } from "@/lib/currency";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface EmailDeliveryResult {
  delivered: boolean;
  configured: boolean;
  messageId?: string;
  error?: string;
}

function createTransporter() {
  const env = getEnv();
  const flags = getIntegrationFlags();
  if (!flags.smtpEmail) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!,
    },
  });
}

export async function sendTransactionalEmail(
  payload: SendEmailPayload
): Promise<EmailDeliveryResult> {
  const env = getEnv();
  const transporter = createTransporter();
  if (!transporter || !env.MAIL_FROM) {
    return {
      delivered: false,
      configured: false,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });
    return {
      delivered: true,
      configured: true,
      messageId: info.messageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP error";
    return {
      delivered: false,
      configured: true,
      error: message,
    };
  }
}

export async function testEmailConnection(): Promise<{
  status: "connected" | "unconfigured" | "error";
  detail: string;
}> {
  const transporter = createTransporter();
  if (!transporter) {
    return {
      status: "unconfigured",
      detail: "SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM belum diisi.",
    };
  }
  try {
    await transporter.verify();
    return {
      status: "connected",
      detail: "Koneksi SMTP berhasil diverifikasi.",
    };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Gagal memverifikasi SMTP.",
    };
  }
}

export async function sendVerificationEmailMessage(params: {
  to: string;
  name: string;
  url: string;
  locale: SupportedLocale;
}): Promise<EmailDeliveryResult> {
  const isEn = params.locale === "en";
  const subject = isEn
    ? "Verify your email — Wisata Cirebon (Batu Lawang & Gunung Bendera)"
    : "Verifikasi email Anda — Wisata Cirebon (Batu Lawang & Gunung Bendera)";

  const text = isEn
    ? `Hello ${params.name},\n\nVerify your Wisata Cirebon account email by opening this link:\n${params.url}\n\nIf you did not register, ignore this message.`
    : `Halo ${params.name},\n\nVerifikasi email akun Wisata Cirebon Anda melalui tautan berikut:\n${params.url}\n\nJika Anda tidak merasa mendaftar, abaikan pesan ini.`;

  const html = `<div style="font-family:sans-serif;background:#08110E;color:#E8F1EC;padding:28px;border-radius:14px;">
    <h2 style="color:#F2A65A;margin:0 0 12px 0;">Wisata Cirebon — Desa Cupang</h2>
    <p>${isEn ? `Hello ${params.name},` : `Halo ${params.name},`}</p>
    <p>${
      isEn
        ? "Confirm your email address using the button below:"
        : "Konfirmasi alamat email akun Anda melalui tombol di bawah ini:"
    }</p>
    <p style="margin:22px 0;">
      <a href="${params.url}" style="background:#F2A65A;color:#08110E;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;">
        ${isEn ? "Verify Email" : "Verifikasi Email"}
      </a>
    </p>
  </div>`;

  return sendTransactionalEmail({ to: params.to, subject, text, html });
}

export async function sendPasswordResetEmailMessage(params: {
  to: string;
  name: string;
  url: string;
  locale: SupportedLocale;
}): Promise<EmailDeliveryResult> {
  const isEn = params.locale === "en";
  const subject = isEn
    ? "Reset your password — Wisata Cirebon"
    : "Atur ulang kata sandi — Wisata Cirebon";

  const text = isEn
    ? `Hello ${params.name},\n\nReset your Wisata Cirebon password using this link:\n${params.url}\n\nThis link expires shortly. Ignore if not requested by you.`
    : `Halo ${params.name},\n\nAtur ulang kata sandi akun Wisata Cirebon Anda melalui tautan berikut:\n${params.url}\n\nTautan ini memiliki masa berlaku singkat. Abaikan bila bukan permintaan Anda.`;

  const html = `<div style="font-family:sans-serif;background:#08110E;color:#E8F1EC;padding:28px;border-radius:14px;">
    <h2 style="color:#F2A65A;margin:0 0 12px 0;">Wisata Cirebon — Desa Cupang</h2>
    <p>${isEn ? `Hello ${params.name},` : `Halo ${params.name},`}</p>
    <p>${
      isEn
        ? "Open the secure link below to set a new password:"
        : "Buka tautan aman di bawah ini untuk membuat kata sandi baru:"
    }</p>
    <p style="margin:22px 0;">
      <a href="${params.url}" style="background:#F2A65A;color:#08110E;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;">
        ${isEn ? "Reset Password" : "Atur Ulang Kata Sandi"}
      </a>
    </p>
  </div>`;

  return sendTransactionalEmail({ to: params.to, subject, text, html });
}

export async function sendOtpEmailMessage(params: {
  to: string;
  name: string;
  code: string;
  locale: SupportedLocale;
}): Promise<EmailDeliveryResult> {
  const isEn = params.locale === "en";
  const subject = isEn
    ? `[Wisata Cirebon] ${params.code} is your email verification code`
    : `[Wisata Cirebon] ${params.code} adalah kode verifikasi email Anda`;

  const text = isEn
    ? `Hello ${params.name},\n\nYour Wisata Cirebon verification code is: ${params.code}\nThis code expires in 10 minutes. Do not share this code with anyone.`
    : `Halo ${params.name},\n\nKode verifikasi email Wisata Cirebon Anda adalah: ${params.code}\nKode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`;

  const html = `<div style="font-family:sans-serif;background:#05070e;color:#f8fafc;padding:32px;border-radius:16px;max-width:520px;margin:0 auto;border:1px solid rgba(255,255,255,0.1);">
    <h2 style="color:#f59e0b;margin:0 0 16px 0;font-size:22px;">Wisata Cirebon</h2>
    <p style="font-size:14px;color:#cbd5e1;line-height:1.6;">${isEn ? `Hello ${params.name},` : `Halo ${params.name},`}</p>
    <p style="font-size:14px;color:#cbd5e1;line-height:1.6;">${
      isEn
        ? "Use the following 6-digit verification code to complete your email verification:"
        : "Gunakan 6-digit kode verifikasi berikut untuk menyelesaikan verifikasi email akun Anda:"
    }</p>
    <div style="margin:24px 0;padding:16px;background:rgba(245,158,11,0.1);border:1px dashed #f59e0b;border-radius:12px;text-align:center;">
      <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#f59e0b;font-family:monospace;">${params.code}</span>
    </div>
    <p style="font-size:12px;color:#94a3b8;">${
      isEn
        ? "This code is valid for 10 minutes. If you did not request this, please ignore this email."
        : "Kode ini berlaku selama 10 menit. Jika Anda tidak merasa meminta kode ini, abaikan email ini."
    }</p>
  </div>`;

  console.log(`[Email Sandbox Sim] Penerima: ${params.to} | Kode OTP: ${params.code}`);
  const delivery = await sendTransactionalEmail({ to: params.to, subject, text, html });
  return delivery;
}

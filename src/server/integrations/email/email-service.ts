import "server-only";
import crypto from "node:crypto";
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildAntiSpamEmailLayout(options: {
  locale: SupportedLocale;
  preheader: string;
  badgeText: string;
  badgeColor?: string;
  title: string;
  recipientName: string;
  bodyHtml: string;
  actionButton?: {
    label: string;
    url: string;
  };
  otpCode?: string;
  footerReason: string;
}): string {
  const isEn = options.locale === "en";
  const badgeColor = options.badgeColor || "#f59e0b";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${isEn ? "en" : "id"}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(options.title)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 16px !important; }
      .otp-display { font-size: 28px !important; letter-spacing: 4px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; color: #f1f5f9;">
  <!-- Gmail & Apple Mail Preheader Snippet -->
  <div style="display: none; font-size: 1px; color: #0b0f19; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(options.preheader)}
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="container-table" style="max-width: 580px; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td valign="middle">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; font-size: 11px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${escapeHtml(options.badgeText)}
                    </span>
                    <h1 style="margin: 8px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
                      Wisata Cirebon
                    </h1>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #94a3b8;">
                      Batu Lawang &amp; Puncak 520 mdpl Gunung Bendera • Desa Cupang
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td class="content-cell" style="padding: 32px; background-color: #111827;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e8f0; line-height: 1.6;">
                ${isEn ? "Hello" : "Halo"} <strong style="color: #ffffff;">${escapeHtml(options.recipientName)}</strong>,
              </p>

              <div style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                ${options.bodyHtml}
              </div>

              ${options.otpCode ? `
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="padding: 20px; background-color: #1e293b; border: 2px dashed #f59e0b; border-radius: 12px;">
                    <span style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 6px;">
                      ${isEn ? "Verification Code" : "Kode Verifikasi"}
                    </span>
                    <span class="otp-display" style="font-family: 'SF Mono', Consolas, Menlo, Monaco, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #f59e0b;">
                      ${escapeHtml(options.otpCode)}
                    </span>
                    <span style="display: block; font-size: 11px; color: #94a3b8; margin-top: 6px;">
                      ${isEn ? "Valid for 10 minutes" : "Berlaku selama 10 menit"}
                    </span>
                  </td>
                </tr>
              </table>
              ` : ""}

              ${options.actionButton ? `
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 16px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                    <a href="${escapeHtml(options.actionButton.url)}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #0b0f19; text-decoration: none; border-radius: 10px; letter-spacing: 0.2px;">
                      ${escapeHtml(options.actionButton.label)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                ${isEn ? "Or copy-paste this URL in your browser:" : "Atau salin tautan berikut ke peramban Anda:"}<br />
                <a href="${escapeHtml(options.actionButton.url)}" target="_blank" style="color: #38bdf8; word-break: break-all; font-size: 11px; text-decoration: underline;">
                  ${escapeHtml(options.actionButton.url)}
                </a>
              </p>
              ` : ""}

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f2937;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  <strong style="color: #cbd5e1;">${isEn ? "Security Notice:" : "Pemberitahuan Keamanan:"}</strong>
                  ${isEn
                    ? "Wisata Cirebon officers will never ask for your password or verification codes. Never forward or share this message."
                    : "Petugas Wisata Cirebon tidak pernah meminta kata sandi atau kode verifikasi Anda. Jangan pernah membagikan pesan ini kepada pihak mana pun."}
                </p>
              </div>
            </td>
          </tr>

          <!-- CAN-SPAM Compliant Footer (Mandatory for Gmail & Yahoo 2024 Deliverability) -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0b1120; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                ${escapeHtml(options.footerReason)}
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                <strong>Pengelola Kawasan Wisata Desa Cupang</strong><br />
                Kecamatan Gempol, Kabupaten Cirebon, Jawa Barat 45161, Republik Indonesia
              </p>
              <p style="margin: 0; font-size: 10px; color: #475569;">
                &copy; 2026 Pemerintah Desa Cupang. ${isEn ? "All rights reserved." : "Hak cipta dilindungi undang-undang."}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createTransporter() {
  const env = getEnv();
  const flags = getIntegrationFlags();
  if (!flags.smtpEmail) {
    return null;
  }

  const isSecure = env.SMTP_PORT === 465;

  return nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: isSecure,
    connectionTimeout: 4500,
    greetingTimeout: 4500,
    socketTimeout: 6000,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
      minVersion: "TLSv1.2",
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
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

  // Parse sender display name and email address for RFC compliance
  let senderEmail = env.MAIL_FROM.trim();
  let senderName = "Wisata Desa Cupang Cirebon";
  const match = env.MAIL_FROM.match(/^(?:["']?([^"']+)["']?\s*)?<([^>]+)>$/);
  if (match && match[2]) {
    senderName = match[1] ? match[1].trim() : senderName;
    senderEmail = match[2].trim();
  }
  const fromDomain = senderEmail.includes("@") ? senderEmail.split("@")[1] : "wisatacupang.id";
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${fromDomain}>`;

  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      replyTo: `"${senderName}" <${senderEmail}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
      messageId,
      envelope: {
        from: senderEmail,
        to: payload.to,
      },
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        "X-Report-Abuse-To": senderEmail,
        "Feedback-ID": `transactional:${fromDomain}`,
        "X-Priority": "1",
        "Priority": "urgent",
        "Importance": "high",
        Date: new Date().toUTCString(),
      },
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
    ? "[Wisata Cirebon] Verify your account email address"
    : "[Wisata Cirebon] Konfirmasi alamat email akun Anda";

  const text = isEn
    ? `Hello ${params.name},\n\nThank you for signing up for Wisata Cirebon (Batu Lawang & Gunung Bendera).\n\nPlease verify your email address by opening this secure link:\n${params.url}\n\nThis message was sent automatically for your account verification. If you did not register, ignore this email.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`
    : `Halo ${params.name},\n\nTerima kasih telah mendaftar di Wisata Cirebon (Batu Lawang & Gunung Bendera).\n\nSilakan konfirmasi alamat email Anda melalui tautan aman berikut:\n${params.url}\n\nPesan ini dikirim otomatis untuk verifikasi akun Anda. Jika Anda tidak merasa mendaftar, abaikan pesan ini.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`;

  const html = buildAntiSpamEmailLayout({
    locale: params.locale,
    preheader: isEn
      ? "Confirm your email to complete registration for Wisata Cirebon."
      : "Konfirmasi email Anda untuk menyelesaikan pendaftaran akun Wisata Cirebon.",
    badgeText: isEn ? "Email Verification" : "Verifikasi Email",
    title: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin: 0 0 14px 0;">${
      isEn
        ? "Thank you for creating an account with <strong>Wisata Cirebon</strong>. Please confirm your email address by clicking the button below to activate your account and start booking tickets:"
        : "Terima kasih telah membuat akun di <strong>Wisata Cirebon</strong>. Silakan konfirmasi alamat email Anda dengan mengeklik tombol di bawah ini untuk mengaktifkan akun dan mulai memesan tiket:"
    }</p>`,
    actionButton: {
      label: isEn ? "Verify Email Address" : "Konfirmasi Alamat Email",
      url: params.url,
    },
    footerReason: isEn
      ? "You received this email because an account was registered with this address on Wisata Desa Cupang portal."
      : "Anda menerima surel ini karena alamat ini didaftarkan pada portal resmi Wisata Desa Cupang Cirebon.",
  });

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
    ? "[Wisata Cirebon] Reset your account password"
    : "[Wisata Cirebon] Permintaan atur ulang kata sandi akun";

  const text = isEn
    ? `Hello ${params.name},\n\nA password reset request was received for your Wisata Cirebon account.\n\nReset your password using this secure link:\n${params.url}\n\nThis link is valid for 1 hour. If you did not request this reset, your account is safe and you can safely ignore this email.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`
    : `Halo ${params.name},\n\nKami menerima permintaan untuk mengatur ulang kata sandi akun Wisata Cirebon Anda.\n\nAtur ulang kata sandi Anda melalui tautan aman berikut:\n${params.url}\n\nTautan ini berlaku selama 1 jam. Jika Anda tidak merasa meminta pengaturan ulang ini, abaikan pesan ini.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`;

  const html = buildAntiSpamEmailLayout({
    locale: params.locale,
    preheader: isEn
      ? "Reset your password for Wisata Cirebon account."
      : "Atur ulang kata sandi akun Wisata Cirebon Anda.",
    badgeText: isEn ? "Password Reset" : "Atur Ulang Sandi",
    badgeColor: "#38bdf8",
    title: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin: 0 0 14px 0;">${
      isEn
        ? "We received a request to reset your Wisata Cirebon account password. Click the secure button below to set a new password:"
        : "Kami menerima permintaan pengaturan ulang kata sandi untuk akun Wisata Cirebon Anda. Klik tombol aman di bawah ini untuk membuat kata sandi baru:"
    }</p>`,
    actionButton: {
      label: isEn ? "Reset My Password" : "Atur Ulang Kata Sandi Saya",
      url: params.url,
    },
    footerReason: isEn
      ? "You received this email because a password reset was requested for your account on Wisata Desa Cupang portal."
      : "Anda menerima surel ini karena adanya permintaan atur ulang kata sandi pada portal Wisata Desa Cupang Cirebon.",
  });

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
    ? `[Wisata Cirebon] ${params.code} is your verification code`
    : `[Wisata Cirebon] ${params.code} adalah kode verifikasi Anda`;

  const text = isEn
    ? `Hello ${params.name},\n\nYour Wisata Cirebon email verification code is: ${params.code}\n\nThis 6-digit code expires in 10 minutes. For your security, do not share this code with anyone.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`
    : `Halo ${params.name},\n\nKode verifikasi email Wisata Cirebon Anda adalah: ${params.code}\n\nKode 6-digit ini berlaku selama 10 menit. Demi keamanan, jangan pernah membagikan kode ini kepada siapa pun.\n\nPengelola Wisata Desa Cupang, Kec. Gempol, Kab. Cirebon 45161`;

  const html = buildAntiSpamEmailLayout({
    locale: params.locale,
    preheader: isEn
      ? `Your 6-digit verification code is ${params.code}. Valid for 10 minutes.`
      : `Kode verifikasi 6-digit Anda adalah ${params.code}. Berlaku selama 10 menit.`,
    badgeText: isEn ? "OTP Verification" : "Kode OTP Verifikasi",
    badgeColor: "#f59e0b",
    title: subject,
    recipientName: params.name,
    bodyHtml: `<p style="margin: 0 0 14px 0;">${
      isEn
        ? "Use the following 6-digit verification code to complete your email verification on the Wisata Cirebon portal:"
        : "Gunakan 6-digit kode verifikasi berikut untuk menyelesaikan verifikasi alamat email Anda pada portal Wisata Cirebon:"
    }</p>`,
    otpCode: params.code,
    footerReason: isEn
      ? "You received this email because an OTP verification was initiated from your account on Wisata Desa Cupang portal."
      : "Anda menerima surel ini karena permintaan verifikasi OTP dipicu dari akun Anda pada portal Wisata Desa Cupang Cirebon.",
  });

  console.log(`[Email Sandbox Sim] Penerima: ${params.to} | Kode OTP: ${params.code}`);
  return sendTransactionalEmail({ to: params.to, subject, text, html });
}

import "server-only";
import { z } from "zod";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => {
    if (typeof val === "string" && val.trim() === "") {
      return undefined;
    }
    return val;
  }, schema.optional());

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  DIRECT_URL: emptyToUndefined(z.string().min(1)),
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET minimal 32 karakter"),
  QR_SIGNING_SECRET: z
    .string()
    .min(32, "QR_SIGNING_SECRET minimal 32 karakter"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET minimal 16 karakter"),

  // OAuth (opsional)
  GOOGLE_CLIENT_ID: emptyToUndefined(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().min(1)),
  FACEBOOK_CLIENT_ID: emptyToUndefined(z.string().min(1)),
  FACEBOOK_CLIENT_SECRET: emptyToUndefined(z.string().min(1)),

  // WhatsApp (opsional)
  WA_PROVIDER: emptyToUndefined(z.enum(["fonnte", "meta"])),
  FONNTE_TOKEN: emptyToUndefined(z.string().min(1)),
  META_WA_TOKEN: emptyToUndefined(z.string().min(1)),
  META_WA_PHONE_ID: emptyToUndefined(z.string().min(1)),

  // Midtrans Snap (opsional saat boot awal; wajib saat transaksi dibuat)
  MIDTRANS_SERVER_KEY: emptyToUndefined(z.string().min(1)),
  MIDTRANS_CLIENT_KEY: emptyToUndefined(z.string().min(1)),
  MIDTRANS_IS_PRODUCTION: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),

  // Email SMTP (opsional)
  SMTP_HOST: emptyToUndefined(z.string().min(1)),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: emptyToUndefined(z.string().min(1)),
  SMTP_PASS: emptyToUndefined(z.string().min(1)),
  MAIL_FROM: emptyToUndefined(z.string().min(3)),

  // Storage ("local" | "s3")
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: emptyToUndefined(z.string().url()),
  S3_REGION: emptyToUndefined(z.string().min(1)),
  S3_BUCKET: emptyToUndefined(z.string().min(1)),
  S3_ACCESS_KEY_ID: emptyToUndefined(z.string().min(1)),
  S3_SECRET_ACCESS_KEY: emptyToUndefined(z.string().min(1)),
  S3_PUBLIC_URL: emptyToUndefined(z.string().url()),

  // Seed Super Admin (opsional saat runtime; dipakai oleh seed.ts)
  SEED_SUPERADMIN_EMAIL: emptyToUndefined(z.string().email()),
  SEED_SUPERADMIN_PASSWORD: emptyToUndefined(z.string().min(10)),
  SEED_SUPERADMIN_NAME: emptyToUndefined(z.string().min(2)),
  SEED_SUPERADMIN_WHATSAPP: emptyToUndefined(z.string().min(9)),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Konfigurasi environment tidak valid: ${formatted}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export interface IntegrationFeatureFlags {
  googleOAuth: boolean;
  facebookOAuth: boolean;
  whatsapp: boolean;
  whatsappProvider: "fonnte" | "meta" | null;
  midtrans: boolean;
  midtransIsProduction: boolean;
  smtpEmail: boolean;
  s3Storage: boolean;
}

export function getIntegrationFlags(): IntegrationFeatureFlags {
  const e = getEnv();
  const hasFonnte = e.WA_PROVIDER === "fonnte" && Boolean(e.FONNTE_TOKEN);
  const hasMetaWa =
    e.WA_PROVIDER === "meta" &&
    Boolean(e.META_WA_TOKEN && e.META_WA_PHONE_ID);

  return {
    googleOAuth: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    facebookOAuth: Boolean(e.FACEBOOK_CLIENT_ID && e.FACEBOOK_CLIENT_SECRET),
    whatsapp: hasFonnte || hasMetaWa,
    whatsappProvider: hasFonnte ? "fonnte" : hasMetaWa ? "meta" : null,
    midtrans: Boolean(e.MIDTRANS_SERVER_KEY && e.MIDTRANS_CLIENT_KEY),
    midtransIsProduction: e.MIDTRANS_IS_PRODUCTION,
    smtpEmail: Boolean(
      e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS && e.MAIL_FROM
    ),
    s3Storage:
      e.STORAGE_DRIVER === "s3" &&
      Boolean(
        e.S3_ENDPOINT &&
          e.S3_BUCKET &&
          e.S3_ACCESS_KEY_ID &&
          e.S3_SECRET_ACCESS_KEY
      ),
  };
}

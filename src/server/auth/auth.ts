import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, phoneNumber, twoFactor } from "better-auth/plugins";
import {
  adminAc,
  userAc,
} from "better-auth/plugins/admin/access";
import { Locale, Role } from "@prisma/client";
import { db } from "@/server/db";
import { getEnv, getIntegrationFlags } from "@/server/env";
import { normalizeIndonesianWhatsapp } from "@/lib/datetime-wib";
import {
  sendPasswordResetEmailMessage,
  sendVerificationEmailMessage,
} from "@/server/integrations/email/email-service";
import { sendWhatsappMessage } from "@/server/integrations/whatsapp/whatsapp-service";
import { writeAuditLog } from "@/server/audit/audit";

const env = getEnv();
const flags = getIntegrationFlags();

const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};

if (flags.googleOAuth && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

if (
  flags.facebookOAuth &&
  env.FACEBOOK_CLIENT_ID &&
  env.FACEBOOK_CLIENT_SECRET
) {
  socialProviders.facebook = {
    clientId: env.FACEBOOK_CLIENT_ID,
    clientSecret: env.FACEBOOK_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  appName: "Wisata Cirebon",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  rateLimit: {
    window: 60,
    max: 200,
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      const userRecord = await db.user.findUnique({
        where: { id: user.id },
        select: { locale: true },
      });
      await sendPasswordResetEmailMessage({
        to: user.email,
        name: user.name,
        url,
        locale: userRecord?.locale === Locale.en ? "en" : "id",
      });
    },
  },
  emailVerification: {
    sendOnSignUp: flags.smtpEmail,
    async sendVerificationEmail({ user, url }) {
      const userRecord = await db.user.findUnique({
        where: { id: user.id },
        select: { locale: true },
      });
      await sendVerificationEmailMessage({
        to: user.email,
        name: user.name,
        url,
        locale: userRecord?.locale === Locale.en ? "en" : "id",
      });
    },
  },
  socialProviders,
  user: {
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        defaultValue: "id",
        input: true,
      },
      whatsapp: {
        type: "string",
        required: false,
        input: true,
      },
      consentAt: {
        type: "date",
        required: false,
        input: false,
      },
      whatsappVerifiedAt: {
        type: "date",
        required: false,
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const rawWa =
            typeof user.whatsapp === "string" ? user.whatsapp : undefined;
          const normalizedWa = rawWa
            ? normalizeIndonesianWhatsapp(rawWa)
            : null;
          const rawLocale = user.locale === "en" ? Locale.en : Locale.id;

          return {
            data: {
              ...user,
              email: user.email.toLowerCase().trim(),
              // Pendaftaran publik tidak pernah boleh memilih peran selain MEMBER (§7 & §10.3)
              role: Role.MEMBER,
              locale: rawLocale,
              whatsapp: normalizedWa,
              phoneNumber: normalizedWa ?? undefined,
              consentAt: new Date(),
            },
          };
        },
        async after(user) {
          await writeAuditLog({
            actorId: user.id,
            actorRole: Role.MEMBER,
            action: "AUTH_REGISTER",
            entity: "User",
            entityId: user.id,
            metadata: { email: user.email },
          }).catch(() => undefined);
        },
      },
    },
    session: {
      create: {
        async before(session) {
          const targetUser = await db.user.findUnique({
            where: { id: session.userId },
            select: { deletedAt: true, banned: true },
          });
          if (!targetUser || targetUser.deletedAt || targetUser.banned) {
            return false;
          }
          return { data: session };
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const returned = ctx.context.returned;
        const isError =
          returned instanceof Response
            ? !returned.ok
            : Boolean(
                returned &&
                  typeof returned === "object" &&
                  "error" in returned
              );

        if (isError) {
          await writeAuditLog({
            action: "AUTH_LOGIN_FAILED",
            entity: "Session",
            headers: ctx.headers,
            metadata: { path: ctx.path },
          }).catch(() => undefined);
        } else if (ctx.context.newSession) {
          await writeAuditLog({
            actorId: ctx.context.newSession.user.id,
            action: "AUTH_LOGIN_SUCCESS",
            entity: "Session",
            entityId: ctx.context.newSession.session.id,
            headers: ctx.headers,
            metadata: { method: "email" },
          }).catch(() => undefined);
        }
      }
    }),
  },
  plugins: [
    twoFactor({
      issuer: "Wisata Cirebon",
    }),
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      phoneNumberValidator: (phone) =>
        Boolean(normalizeIndonesianWhatsapp(phone)),
      async sendOTP({ phoneNumber: rawPhone, code }) {
        if (!getIntegrationFlags().whatsapp) {
          throw new Error("Penyedia WhatsApp belum dikonfigurasi.");
        }
        const normalized = normalizeIndonesianWhatsapp(rawPhone);
        if (!normalized) {
          throw new Error("Nomor WhatsApp Indonesia tidak valid.");
        }
        const result = await sendWhatsappMessage(
          normalized,
          `[Wisata Cirebon] Kode OTP login Anda: ${code}. Berlaku 5 menit. Jangan bagikan kepada siapa pun.`
        );
        if (!result.delivered) {
          throw new Error(result.error || "Gagal mengirim OTP WhatsApp.");
        }
      },
    }),
    admin({
      defaultRole: Role.MEMBER,
      adminRoles: [Role.SUPER_ADMIN],
      roles: {
        [Role.MEMBER]: userAc,
        [Role.STAFF]: userAc,
        [Role.ADMIN]: userAc,
        [Role.SUPER_ADMIN]: adminAc,
      },
    }),
    nextCookies(),
  ],
});

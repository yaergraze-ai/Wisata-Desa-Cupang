import "server-only";
import { headers } from "next/headers";
import { Role, type GateType } from "@prisma/client";
import { symmetricDecrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { writeAuditLog } from "@/server/audit/audit";

export class AuthGuardError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN_ROLE"
      | "TWO_FACTOR_SETUP_REQUIRED"
      | "STEP_UP_REQUIRED",
    message: string
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export interface AuthenticatedContext {
  sessionId: string;
  sessionToken: string;
  stepUpVerifiedAt: Date | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    locale: AppLocale;
    whatsapp: string | null;
    whatsappVerifiedAt: Date | null;
    image?: string | null;
    bio?: string | null;
    nik?: string | null;
    address?: string | null;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    postalCode?: string | null;
    emergencyContact?: string | null;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    assignedGates: GateType[];
    staffProfileId: string | null;
  };
}

export function getRoleHomePath(role: Role): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "/dashboard/super-admin";
    case Role.ADMIN:
      return "/dashboard/admin";
    case Role.STAFF:
      return "/dashboard/staff";
    case Role.MEMBER:
    default:
      return "/dashboard";
  }
}

export function sanitizeNextPath(rawNext?: string | null): string | null {
  if (!rawNext) return null;
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
}

export async function getServerAuthContext(
  explicitHeaders?: Headers
): Promise<AuthenticatedContext | null> {
  const reqHeaders = explicitHeaders ?? (await headers());
  const sessionRes = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!sessionRes?.session || !sessionRes.user) {
    return null;
  }

  const [dbUser, dbSession] = await Promise.all([
    db.user.findUnique({
      where: { id: sessionRes.user.id },
      include: { staffProfile: true },
    }),
    db.session.findUnique({
      where: { id: sessionRes.session.id },
      select: { id: true, token: true, stepUpVerifiedAt: true, expiresAt: true },
    }),
  ]);

  if (
    !dbUser ||
    dbUser.deletedAt ||
    dbUser.banned ||
    !dbSession ||
    dbSession.expiresAt <= new Date()
  ) {
    return null;
  }

  return {
    sessionId: dbSession.id,
    sessionToken: dbSession.token,
    stepUpVerifiedAt: dbSession.stepUpVerifiedAt,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      locale: dbUser.locale === "en" ? "en" : "id",
      whatsapp: dbUser.whatsapp,
      whatsappVerifiedAt: dbUser.whatsappVerifiedAt,
      image: dbUser.image ?? null,
      bio: dbUser.bio ?? null,
      nik: dbUser.nik ?? null,
      address: dbUser.address ?? null,
      province: dbUser.province ?? null,
      city: dbUser.city ?? null,
      district: dbUser.district ?? null,
      postalCode: dbUser.postalCode ?? null,
      emergencyContact: dbUser.emergencyContact ?? null,
      emailVerified: Boolean(dbUser.emailVerified),
      twoFactorEnabled: Boolean(dbUser.twoFactorEnabled),
      assignedGates: dbUser.staffProfile?.assignedGates ?? [],
      staffProfileId: dbUser.staffProfile?.id ?? null,
    },
  };
}

export async function requireApiAuth(
  reqHeaders?: Headers
): Promise<AuthenticatedContext> {
  const ctx = await getServerAuthContext(reqHeaders);
  if (!ctx) {
    throw new AuthGuardError(401, "UNAUTHENTICATED", "Sesi tidak ditemukan.");
  }
  return ctx;
}

export async function requireApiRole(
  allowedRoles: readonly Role[],
  options?: {
    headers?: Headers;
    requireTwoFactor?: boolean;
    requireStepUpMinutes?: number;
  }
): Promise<AuthenticatedContext> {
  const reqHeaders = options?.headers ?? (await headers());
  const ctx = await requireApiAuth(reqHeaders);

  if (!allowedRoles.includes(ctx.user.role)) {
    await writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: "AUTH_FORBIDDEN_ACCESS",
      entity: "RouteGuard",
      headers: reqHeaders,
      metadata: {
        requiredRoles: allowedRoles,
        actualRole: ctx.user.role,
      },
    }).catch(() => undefined);

    throw new AuthGuardError(
      403,
      "FORBIDDEN_ROLE",
      "Peran akun Anda tidak memiliki izin untuk aksi ini."
    );
  }

  const mustHave2fa = Boolean(options?.requireTwoFactor);

  if (mustHave2fa && !ctx.user.twoFactorEnabled) {
    throw new AuthGuardError(
      403,
      "TWO_FACTOR_SETUP_REQUIRED",
      "Akun Admin/Super Admin wajib mengaktifkan 2FA TOTP terlebih dahulu."
    );
  }

  if (options?.requireStepUpMinutes) {
    const windowMs = options.requireStepUpMinutes * 60_000;
    const isFresh =
      ctx.stepUpVerifiedAt !== null &&
      Date.now() - ctx.stepUpVerifiedAt.getTime() <= windowMs;
    if (!isFresh) {
      throw new AuthGuardError(
        403,
        "STEP_UP_REQUIRED",
        "Verifikasi ulang kode TOTP diperlukan untuk aksi sensitif ini."
      );
    }
  }

  return ctx;
}

export async function requirePageRole(params: {
  locale: AppLocale;
  allowedRoles: readonly Role[];
  currentPath: string;
  requireTwoFactor?: boolean;
}): Promise<AuthenticatedContext> {
  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect(`/${params.locale}/masuk?next=${encodeURIComponent(params.currentPath)}`);
  }

  if (!params.allowedRoles.includes(ctx.user.role)) {
    await writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: "AUTH_FORBIDDEN_PAGE",
      entity: "PageGuard",
      entityId: params.currentPath,
      metadata: {
        requiredRoles: params.allowedRoles,
        actualRole: ctx.user.role,
      },
    }).catch(() => undefined);

    redirect(`/${params.locale}${getRoleHomePath(ctx.user.role)}`);
  }

  const mustHave2fa = Boolean(params.requireTwoFactor);
  if (mustHave2fa && !ctx.user.twoFactorEnabled) {
    redirect(
      `/${params.locale}/verifikasi-2fa?setup=1&next=${encodeURIComponent(params.currentPath)}`
    );
  }

  return ctx;
}

/**
 * Memverifikasi kode TOTP 6 digit langsung terhadap rahasia terenkripsi milik user
 * untuk kebutuhan Step-Up Super Admin (§7).
 */
export async function verifyLiveUserTotp(
  userId: string,
  code: string
): Promise<boolean> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return false;
  }

  const tf = await db.twoFactor.findFirst({
    where: { userId },
  });
  if (!tf) {
    return false;
  }

  const decryptedSecret = await symmetricDecrypt({
    key: getEnv().BETTER_AUTH_SECRET,
    data: tf.secret,
  });

  return createOTP(decryptedSecret, { digits: 6, period: 30 }).verify(trimmed, {
    window: 1,
  });
}

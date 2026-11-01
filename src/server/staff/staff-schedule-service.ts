import "server-only";
import { Role, StaffOverrideMode } from "@prisma/client";
import { db } from "@/server/db";
import { getEnv, getIntegrationFlags } from "@/server/env";
import type { SupportedLocale } from "@/lib/currency";
import { formatTimestampWib } from "@/lib/datetime-wib";
import { computeStaffDutyStatusWib, type StaffDutyStatusResult, type WeeklyScheduleMap, parseWeeklySchedule } from "@/server/staff/staff-availability";
import {
  sendTransactionalEmail,
  buildAntiSpamEmailLayout,
} from "@/server/integrations/email/email-service";
import { writeAuditLog } from "@/server/audit/audit";

export interface StaffSelfState {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  whatsapp: string;
  destinationId: string;
  destinationSlug: string;
  destinationName: string;
  jobTitle: string;
  initials: string;
  isMinor: boolean;
  assignedGates: string[];
  weeklySchedule: WeeklyScheduleMap;
  overrideMode: StaffOverrideMode;
  overrideUntilIso: string | null;
  isActive: boolean;
  duty: StaffDutyStatusResult;
  leaveCooldownRemainingSeconds: number;
}

export class StaffDomainError extends Error {
  constructor(
    public readonly code:
      | "STAFF_NOT_FOUND"
      | "DESTINATION_NOT_FOUND"
      | "LEAVE_COOLDOWN_ACTIVE"
      | "INVALID_INPUT"
      | "FORBIDDEN",
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "StaffDomainError";
  }
}

/**
 * Mengambil detail profil petugas yang sedang login beserta status jadwal dan durasi jeda (cooldown) libur mendadak (§5.7).
 */
export async function getStaffSelfState(params: {
  userId: string;
  locale: SupportedLocale;
  now?: Date;
}): Promise<StaffSelfState> {
  const now = params.now ?? new Date();
  const profile = await db.staffProfile.findUnique({
    where: { userId: params.userId },
    include: {
      user: { select: { name: true, email: true, role: true } },
      destination: true,
      leaveRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!profile) {
    throw new StaffDomainError(
      "STAFF_NOT_FOUND",
      404,
      params.locale === "en"
        ? "Staff profile not found for this account."
        : "Profil petugas tidak ditemukan untuk akun ini."
    );
  }

  const [cooldownSetting] = await Promise.all([
    db.siteSetting.findUnique({ where: { key: "leaveCooldownMinutes" } }),
  ]);
  const cooldownMin = Math.max(
    1,
    Number.parseInt(cooldownSetting?.value ?? "30", 10) || 30
  );

  // Periksa cooldown berdasarkan pengajuan libur terakhir di destinasi ini
  let leaveCooldownRemainingSeconds = 0;
  const latestDestLeave = await db.leaveRequest.findFirst({
    where: { destinationId: profile.destinationId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latestDestLeave) {
    const elapsedMs = now.getTime() - latestDestLeave.createdAt.getTime();
    const cooldownMs = cooldownMin * 60_000;
    if (elapsedMs < cooldownMs) {
      leaveCooldownRemainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
    }
  }

  const duty = computeStaffDutyStatusWib(
    {
      isActive: profile.isActive,
      weeklySchedule: profile.weeklySchedule,
      overrideMode: profile.overrideMode,
      overrideUntil: profile.overrideUntil,
      updatedAt: profile.updatedAt,
      latestLeaveAt: profile.leaveRequests[0]?.createdAt ?? null,
    },
    now
  );

  return {
    profileId: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    role: profile.user.role,
    whatsapp: profile.whatsapp,
    destinationId: profile.destinationId,
    destinationSlug: profile.destination.slug,
    destinationName:
      params.locale === "en" ? profile.destination.nameEn : profile.destination.nameId,
    jobTitle:
      params.locale === "en" ? profile.jobTitleEn : profile.jobTitleId,
    initials: profile.initials,
    isMinor: profile.isMinor,
    assignedGates: profile.assignedGates,
    weeklySchedule: parseWeeklySchedule(profile.weeklySchedule),
    overrideMode: profile.overrideMode,
    overrideUntilIso: profile.overrideUntil ? profile.overrideUntil.toISOString() : null,
    isActive: profile.isActive,
    duty,
    leaveCooldownRemainingSeconds,
  };
}

/**
 * Memperbarui mode override status kerja petugas mandiri (FOLLOW_SCHEDULE / FORCE_ACTIVE / FORCE_INACTIVE) (§5.7).
 */
export async function updateStaffSelfOverride(params: {
  userId: string;
  overrideMode: StaffOverrideMode;
  overrideHours?: number;
  locale: SupportedLocale;
  headers?: Headers;
  now?: Date;
}): Promise<StaffSelfState> {
  const now = params.now ?? new Date();

  let overrideUntil: Date | null = null;
  if (
    params.overrideMode !== StaffOverrideMode.FOLLOW_SCHEDULE &&
    params.overrideHours &&
    params.overrideHours > 0
  ) {
    overrideUntil = new Date(now.getTime() + params.overrideHours * 3600_000);
  }

  const profile = await db.staffProfile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });

  if (!profile) {
    throw new StaffDomainError(
      "STAFF_NOT_FOUND",
      404,
      params.locale === "en"
        ? "Staff profile not found."
        : "Profil petugas tidak ditemukan."
    );
  }

  await db.staffProfile.update({
    where: { id: profile.id },
    data: {
      overrideMode: params.overrideMode,
      overrideUntil,
    },
  });

  await writeAuditLog({
    actorId: params.userId,
    actorRole: Role.STAFF,
    action: "STAFF_OVERRIDE_UPDATED",
    entity: "StaffProfile",
    entityId: profile.id,
    headers: params.headers,
    metadata: {
      overrideMode: params.overrideMode,
      overrideUntil: overrideUntil?.toISOString() ?? null,
    },
  }).catch(() => undefined);

  return getStaffSelfState({ userId: params.userId, locale: params.locale, now });
}

/**
 * Mengajukan libur mendadak dengan penegakan kunci baris Destination dan jeda minimum (cooldown 30 menit) di DB (§5.7).
 * Begitu diajukan, kartu publik petugas seketika nonaktif, notifikasi in-app Admin dibuat, dan email dikirim bila SMTP aktif.
 */
export async function requestSuddenLeave(params: {
  userId: string;
  reason?: string;
  locale: SupportedLocale;
  headers?: Headers;
  now?: Date;
}): Promise<StaffSelfState> {
  const now = params.now ?? new Date();
  const isEn = params.locale === "en";

  const result = await db.$transaction(async (tx) => {
    const profile = await tx.staffProfile.findUnique({
      where: { userId: params.userId },
      include: {
        user: { select: { name: true, email: true } },
        destination: true,
      },
    });

    if (!profile) {
      throw new StaffDomainError(
        "STAFF_NOT_FOUND",
        404,
        isEn ? "Staff profile not found." : "Profil petugas tidak ditemukan."
      );
    }

    // Kunci baris Destination untuk mencegah 2 pengajuan libur mendadak bersamaan melewati cooldown
    await tx.$queryRaw`
      SELECT "id" FROM "Destination" WHERE "id" = ${profile.destinationId} FOR UPDATE
    `;

    const cooldownSetting = await tx.siteSetting.findUnique({
      where: { key: "leaveCooldownMinutes" },
    });
    const cooldownMin = Math.max(
      1,
      Number.parseInt(cooldownSetting?.value ?? "30", 10) || 30
    );
    const cooldownMs = cooldownMin * 60_000;

    const latestLeave = await tx.leaveRequest.findFirst({
      where: { destinationId: profile.destinationId },
      orderBy: { createdAt: "desc" },
    });

    if (latestLeave) {
      const elapsedMs = now.getTime() - latestLeave.createdAt.getTime();
      if (elapsedMs < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
        const remainingMin = Math.ceil(remainingSec / 60);
        throw new StaffDomainError(
          "LEAVE_COOLDOWN_ACTIVE",
          429,
          isEn
            ? `Sudden leave cooldown active for ${profile.destination.nameEn}. Please wait ${remainingMin} minute(s).`
            : `Jeda pengajuan libur mendadak untuk ${profile.destination.nameId} sedang aktif. Tunggu ${remainingMin} menit lagi.`,
          {
            destinationId: profile.destinationId,
            destinationName:
              isEn ? profile.destination.nameEn : profile.destination.nameId,
            remainingSeconds: remainingSec,
            remainingMinutes: remainingMin,
          }
        );
      }
    }

    // Buat LeaveRequest
    const leave = await tx.leaveRequest.create({
      data: {
        staffProfileId: profile.id,
        destinationId: profile.destinationId,
        reason: params.reason ? params.reason.trim().slice(0, 300) : null,
        createdAt: now,
      },
    });

    // Set overrideMode = FORCE_INACTIVE agar kartu publik langsung nonaktif seketika
    await tx.staffProfile.update({
      where: { id: profile.id },
      data: {
        overrideMode: StaffOverrideMode.FORCE_INACTIVE,
        overrideUntil: null,
      },
    });

    // Buat Notification Admin in-app (§5.7)
    await tx.notification.create({
      data: {
        recipientRole: Role.ADMIN,
        type: "STAFF_SUDDEN_LEAVE",
        titleKey: "Notifications.staffLeaveTitle",
        bodyKey: "Notifications.staffLeaveBody",
        params: {
          staffName: profile.user.name,
          destinationName:
            isEn ? profile.destination.nameEn : profile.destination.nameId,
          reason: params.reason?.trim() || "-",
          time: formatTimestampWib(now, params.locale),
        },
        linkPath: "/dashboard/admin?tab=staff",
      },
    });

    return {
      leaveId: leave.id,
      staffName: profile.user.name,
      destinationName:
        isEn ? profile.destination.nameEn : profile.destination.nameId,
      destinationId: profile.destinationId,
    };
  });

  // Kirim email notifikasi ke pengelola bila SMTP aktif (dilakukan di luar transaksi DB)
  const [managerEmailSetting] = await Promise.all([
    db.siteSetting.findUnique({ where: { key: "managerEmail" } }),
  ]);
  const managerEmail =
    managerEmailSetting?.value ||
    getEnv().SEED_SUPERADMIN_EMAIL ||
    "pengelola@wisatacirebon.id";

  if (getIntegrationFlags().smtpEmail && managerEmail) {
    const timeFormatted = formatTimestampWib(now, params.locale);
    const subject = isEn
      ? `[Alert] Sudden Leave: ${result.staffName} (${result.destinationName})`
      : `[Pemberitahuan] Libur Mendadak Petugas: ${result.staffName} (${result.destinationName})`;

    const text = isEn
      ? `Field staff ${result.staffName} has submitted a sudden leave request at ${timeFormatted} for destination ${result.destinationName}.\nReason: ${params.reason || "-"}\n\nThe public staff card has been deactivated automatically.`
      : `Petugas lapangan ${result.staffName} mengajukan libur mendadak pada ${timeFormatted} untuk destinasi ${result.destinationName}.\nAlasan: ${params.reason || "-"}\n\nKartu siaga publik telah dinonaktifkan secara otomatis.`;

    const html = buildAntiSpamEmailLayout({
      locale: isEn ? "en" : "id",
      preheader: `Pemberitahuan libur mendadak: ${result.staffName} (${result.destinationName}).`,
      badgeText: "Pemberitahuan Internal",
      badgeColor: "#f43f5e",
      title: subject,
      recipientName: "Manajer Operasional",
      bodyHtml: `
        <p style="margin: 0 0 10px 0;"><strong>Petugas:</strong> ${result.staffName}</p>
        <p style="margin: 0 0 10px 0;"><strong>Destinasi:</strong> ${result.destinationName}</p>
        <p style="margin: 0 0 10px 0;"><strong>Waktu Pengajuan:</strong> ${timeFormatted}</p>
        <p style="margin: 0 0 14px 0;"><strong>Alasan:</strong> ${params.reason || "-"}</p>
        <p style="font-size: 13px; color: #38bdf8; margin: 0;">Kartu siaga publik telah dinonaktifkan seketika dan dialihkan ke WhatsApp pengelola.</p>
      `,
      footerReason: "Pesan ini dikirimkan kepada pengelola wisata untuk pembaruan operasional petugas lapangan.",
    });

    await sendTransactionalEmail({
      to: managerEmail,
      subject,
      text,
      html,
    }).catch(() => undefined);
  }

  await writeAuditLog({
    actorId: params.userId,
    actorRole: Role.STAFF,
    action: "STAFF_SUDDEN_LEAVE_REQUESTED",
    entity: "LeaveRequest",
    entityId: result.leaveId,
    headers: params.headers,
    metadata: {
      destinationId: result.destinationId,
      destinationName: result.destinationName,
      reason: params.reason || null,
    },
  }).catch(() => undefined);

  return getStaffSelfState({ userId: params.userId, locale: params.locale, now });
}

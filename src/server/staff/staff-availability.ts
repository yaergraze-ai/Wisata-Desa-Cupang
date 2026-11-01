import { StaffOverrideMode } from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import {
  formatTimestampWib,
  getTodayWibDateString,
  getWibClockParts,
  parseTimeHhMmToMinutes,
} from "@/lib/datetime-wib";

export interface WeeklyScheduleDay {
  enabled: boolean;
  start: string;
  end: string;
}

export type WeeklyScheduleMap = Record<string, WeeklyScheduleDay>;

export interface StaffDutyComputationInput {
  isActive: boolean;
  weeklySchedule: unknown;
  overrideMode: StaffOverrideMode;
  overrideUntil: Date | null;
  updatedAt?: Date | null;
  latestLeaveAt?: Date | null;
}

export interface StaffDutyStatusResult {
  onDuty: boolean;
  source:
    | "INACTIVE"
    | "LEAVE_TODAY"
    | "FORCE_ACTIVE"
    | "FORCE_INACTIVE"
    | "SCHEDULE_ACTIVE"
    | "SCHEDULE_OFF";
  todayShiftLabel: string | null;
}

export interface PublicStaffCardDto {
  id: string;
  destinationSlug: string;
  destinationName: string;
  jobTitle: string;
  displayName: string;
  initials: string;
  isMinorProtected: boolean;
  onDuty: boolean;
  dutySource: StaffDutyStatusResult["source"];
  todayShiftLabel: string | null;
  contactAction: "DIRECT_STAFF" | "MANAGER";
  contactWhatsappDigits: string;
}

export interface PublicStaffStatusResponse {
  evaluatedAtIso: string;
  wibTimeDisplay: string;
  managerWhatsappDigits: string;
  staffCards: PublicStaffCardDto[];
}

const VALID_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseWeeklySchedule(raw: unknown): WeeklyScheduleMap {
  const result: WeeklyScheduleMap = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return result;
  }

  const record = raw as Record<string, unknown>;
  for (let day = 0; day <= 6; day++) {
    const key = String(day);
    const entry = record[key];
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      const start = typeof e.start === "string" && VALID_TIME_RE.test(e.start) ? e.start : "07:00";
      const end = typeof e.end === "string" && VALID_TIME_RE.test(e.end) ? e.end : "17:00";
      result[key] = {
        enabled: Boolean(e.enabled),
        start,
        end,
      };
    }
  }
  return result;
}

/**
 * Menghitung status siaga petugas dalam zona waktu WIB (Asia/Jakarta) di sisi server (§5.7).
 */
export function computeStaffDutyStatusWib(
  input: StaffDutyComputationInput,
  now: Date = new Date()
): StaffDutyStatusResult {
  const clock = getWibClockParts(now);
  const schedule = parseWeeklySchedule(input.weeklySchedule);
  const todayEntry = schedule[String(clock.dayOfWeek)];
  const todayShiftLabel =
    todayEntry && todayEntry.enabled ? `${todayEntry.start}–${todayEntry.end} WIB` : null;

  if (!input.isActive) {
    return {
      onDuty: false,
      source: "INACTIVE",
      todayShiftLabel,
    };
  }

  const overrideActive = !input.overrideUntil || input.overrideUntil.getTime() > now.getTime();

  // Jika petugas mengajukan libur mendadak pada hari WIB yang sama, kartu langsung nonaktif
  // kecuali petugas/admin secara eksplisit menyetel FORCE_ACTIVE setelah pengajuan libur tersebut.
  if (input.latestLeaveAt) {
    const leaveDateWib = getTodayWibDateString(input.latestLeaveAt);
    const reactivatedAfterLeave =
      overrideActive &&
      input.overrideMode === StaffOverrideMode.FORCE_ACTIVE &&
      input.updatedAt &&
      input.updatedAt.getTime() > input.latestLeaveAt.getTime();

    if (leaveDateWib === clock.dateStr && !reactivatedAfterLeave) {
      return {
        onDuty: false,
        source: "LEAVE_TODAY",
        todayShiftLabel,
      };
    }
  }

  if (overrideActive && input.overrideMode === StaffOverrideMode.FORCE_ACTIVE) {
    return {
      onDuty: true,
      source: "FORCE_ACTIVE",
      todayShiftLabel,
    };
  }

  if (overrideActive && input.overrideMode === StaffOverrideMode.FORCE_INACTIVE) {
    return {
      onDuty: false,
      source: "FORCE_INACTIVE",
      todayShiftLabel,
    };
  }

  if (todayEntry && todayEntry.enabled) {
    const startMin = parseTimeHhMmToMinutes(todayEntry.start);
    const endMin = parseTimeHhMmToMinutes(todayEntry.end);
    const withinWindow =
      clock.minutesSinceMidnight >= startMin && clock.minutesSinceMidnight < endMin;

    return {
      onDuty: withinWindow,
      source: withinWindow ? "SCHEDULE_ACTIVE" : "SCHEDULE_OFF",
      todayShiftLabel,
    };
  }

  return {
    onDuty: false,
    source: "SCHEDULE_OFF",
    todayShiftLabel: null,
  };
}

/**
 * Membentuk kartu publik petugas dengan perlindungan privasi UU PDP bagi petugas <18 tahun (§5.7 & AGENTS.md §7).
 * Petugas di bawah 18 tahun hanya menampilkan inisial dan selalu diarahkan ke nomor WhatsApp pengelola.
 */
export function buildPublicStaffCardDto(params: {
  id: string;
  destinationSlug: string;
  destinationNameId: string;
  destinationNameEn: string;
  jobTitleId: string;
  jobTitleEn: string;
  publicName: string;
  initials: string;
  isMinor: boolean;
  whatsapp: string;
  duty: StaffDutyStatusResult;
  managerWhatsapp: string;
  locale: SupportedLocale;
}): PublicStaffCardDto {
  const managerDigits = params.managerWhatsapp.replace(/[^\d]/g, "");
  const staffDigits = params.whatsapp.replace(/[^\d]/g, "");
  const safeInitials = params.initials.trim().toUpperCase().slice(0, 4) || "PT";

  const useDirectStaff = !params.isMinor && params.duty.onDuty && staffDigits.length >= 9;

  return {
    id: params.id,
    destinationSlug: params.destinationSlug,
    destinationName:
      params.locale === "en" ? params.destinationNameEn : params.destinationNameId,
    jobTitle: params.locale === "en" ? params.jobTitleEn : params.jobTitleId,
    displayName: params.isMinor ? safeInitials : params.publicName,
    initials: safeInitials,
    isMinorProtected: params.isMinor,
    onDuty: params.duty.onDuty,
    dutySource: params.duty.source,
    todayShiftLabel: params.duty.todayShiftLabel,
    contactAction: useDirectStaff ? "DIRECT_STAFF" : "MANAGER",
    contactWhatsappDigits: useDirectStaff ? staffDigits : managerDigits,
  };
}

export async function getPublicStaffStatusData(
  locale: SupportedLocale,
  now: Date = new Date()
): Promise<PublicStaffStatusResponse> {
  const [profiles, managerSetting] = await Promise.all([
    db.staffProfile.findMany({
      where: {
        isActive: true,
        user: {
          deletedAt: null,
          banned: { not: true },
        },
      },
      include: {
        destination: true,
        leaveRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ destination: { slug: "asc" } }, { publicName: "asc" }],
    }),
    db.siteSetting.findUnique({
      where: { key: "managerWhatsapp" },
    }),
  ]);

  const managerWhatsapp = managerSetting?.value || "+6281224001001";
  const managerWhatsappDigits = managerWhatsapp.replace(/[^\d]/g, "");

  const staffCards = profiles.map((profile) => {
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

    return buildPublicStaffCardDto({
      id: profile.id,
      destinationSlug: profile.destination.slug,
      destinationNameId: profile.destination.nameId,
      destinationNameEn: profile.destination.nameEn,
      jobTitleId: profile.jobTitleId,
      jobTitleEn: profile.jobTitleEn,
      publicName: profile.publicName,
      initials: profile.initials,
      isMinor: profile.isMinor,
      whatsapp: profile.whatsapp,
      duty,
      managerWhatsapp,
      locale,
    });
  });

  return {
    evaluatedAtIso: now.toISOString(),
    wibTimeDisplay: formatTimestampWib(now, locale),
    managerWhatsappDigits,
    staffCards,
  };
}

import { describe, expect, it } from "vitest";
import { StaffOverrideMode } from "@prisma/client";
import {
  buildPublicStaffCardDto,
  computeStaffDutyStatusWib,
} from "../../src/server/staff/staff-availability";
import { evaluateDateAndCutoffRules } from "../../src/server/pricing/quote-service";

describe("Fase 3 — Ketersediaan Petugas WIB & Perlindungan UU PDP (<18 Tahun)", () => {
  // 2026-10-31T02:30:00Z = Sabtu 31 Okt 2026 pukul 09:30 WIB (dayOfWeek = 6)
  const saturdayMorningWib = new Date("2026-10-31T02:30:00.000Z");
  // 2026-10-31T11:30:00Z = Sabtu 31 Okt 2026 pukul 18:30 WIB
  const saturdayEveningWib = new Date("2026-10-31T11:30:00.000Z");

  const scheduleSaturday = {
    "6": { enabled: true, start: "07:00", end: "16:30" },
  };

  it("menghitung status aktif mengikuti jadwal WIB mingguan", () => {
    const active = computeStaffDutyStatusWib(
      {
        isActive: true,
        weeklySchedule: scheduleSaturday,
        overrideMode: StaffOverrideMode.FOLLOW_SCHEDULE,
        overrideUntil: null,
      },
      saturdayMorningWib
    );
    expect(active.onDuty).toBe(true);
    expect(active.source).toBe("SCHEDULE_ACTIVE");
    expect(active.todayShiftLabel).toBe("07:00–16:30 WIB");

    const offHours = computeStaffDutyStatusWib(
      {
        isActive: true,
        weeklySchedule: scheduleSaturday,
        overrideMode: StaffOverrideMode.FOLLOW_SCHEDULE,
        overrideUntil: null,
      },
      saturdayEveningWib
    );
    expect(offHours.onDuty).toBe(false);
    expect(offHours.source).toBe("SCHEDULE_OFF");
  });

  it("langsung menonaktifkan kartu petugas bila ada LeaveRequest pada hari WIB yang sama", () => {
    const leaveAtNineWib = new Date("2026-10-31T02:00:00.000Z");
    const status = computeStaffDutyStatusWib(
      {
        isActive: true,
        weeklySchedule: scheduleSaturday,
        overrideMode: StaffOverrideMode.FOLLOW_SCHEDULE,
        overrideUntil: null,
        latestLeaveAt: leaveAtNineWib,
      },
      saturdayMorningWib
    );
    expect(status.onDuty).toBe(false);
    expect(status.source).toBe("LEAVE_TODAY");
  });

  it("melindungi identitas dan nomor WA pribadi petugas <18 tahun (UU PDP)", () => {
    const dutyOn = {
      onDuty: true,
      source: "SCHEDULE_ACTIVE" as const,
      todayShiftLabel: "07:00–16:30 WIB",
    };

    const minorCard = buildPublicStaffCardDto({
      id: "staff-minor-1",
      destinationSlug: "gunung-bendera",
      destinationNameId: "Gunung Bendera",
      destinationNameEn: "Gunung Bendera",
      jobTitleId: "Pemandu Pos",
      jobTitleEn: "Trail Guide",
      publicName: "Raka Pratama",
      initials: "RP",
      isMinor: true,
      whatsapp: "+6281399998888",
      duty: dutyOn,
      managerWhatsapp: "+6281224001001",
      locale: "id",
    });

    expect(minorCard.displayName).toBe("RP");
    expect(minorCard.isMinorProtected).toBe(true);
    expect(minorCard.contactAction).toBe("MANAGER");
    expect(minorCard.contactWhatsappDigits).toBe("6281224001001");
    expect(minorCard.contactWhatsappDigits).not.toContain("81399998888");

    const adultActiveCard = buildPublicStaffCardDto({
      id: "staff-adult-1",
      destinationSlug: "batu-lawang",
      destinationNameId: "Batu Lawang",
      destinationNameEn: "Batu Lawang",
      jobTitleId: "Penjaga Gerbang",
      jobTitleEn: "Gate Ranger",
      publicName: "Pak Hendra",
      initials: "PH",
      isMinor: false,
      whatsapp: "+6281277776666",
      duty: dutyOn,
      managerWhatsapp: "+6281224001001",
      locale: "id",
    });

    expect(adultActiveCard.displayName).toBe("Pak Hendra");
    expect(adultActiveCard.contactAction).toBe("DIRECT_STAFF");
    expect(adultActiveCard.contactWhatsappDigits).toBe("6281277776666");
  });
});

describe("Fase 3 — Validasi Tanggal Kunjungan & Penutupan Hari-H 1 Jam Sebelum Tutup", () => {
  const destinations = [
    { slug: "batu-lawang", name: "Batu Lawang", closeTime: "17:00" },
    { slug: "gunung-bendera", name: "Gunung Bendera", closeTime: "17:00" },
  ];

  it("menolak tanggal masa lalu dan tanggal di luar bookingWindowDays", () => {
    const past = evaluateDateAndCutoffRules({
      visitDate: "2026-10-30",
      todayWib: "2026-10-31",
      bookingWindowDays: 60,
      sameDayCloseBufferMinutes: 60,
      currentWibMinutes: 9 * 60,
      consumedDestinations: destinations,
    });
    expect(past.blockingCode).toBe("PAST_DATE");

    const tooFar = evaluateDateAndCutoffRules({
      visitDate: "2027-02-01",
      todayWib: "2026-10-31",
      bookingWindowDays: 60,
      sameDayCloseBufferMinutes: 60,
      currentWibMinutes: 9 * 60,
      consumedDestinations: destinations,
    });
    expect(tooFar.blockingCode).toBe("OUTSIDE_BOOKING_WINDOW");
  });

  it("menutup pembelian hari-H tepat 60 menit sebelum jam tutup WIB (16:00 untuk tutup 17:00)", () => {
    const at1559 = evaluateDateAndCutoffRules({
      visitDate: "2026-10-31",
      todayWib: "2026-10-31",
      bookingWindowDays: 60,
      sameDayCloseBufferMinutes: 60,
      currentWibMinutes: 15 * 60 + 59,
      consumedDestinations: destinations,
    });
    expect(at1559.blockingCode).toBeNull();

    const at1600 = evaluateDateAndCutoffRules({
      visitDate: "2026-10-31",
      todayWib: "2026-10-31",
      bookingWindowDays: 60,
      sameDayCloseBufferMinutes: 60,
      currentWibMinutes: 16 * 60,
      consumedDestinations: destinations,
    });
    expect(at1600.blockingCode).toBe("SAME_DAY_CUTOFF");
    expect(at1600.cutoffTimeWib).toBe("16:00");
  });
});

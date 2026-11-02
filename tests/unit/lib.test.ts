import { describe, expect, it } from "vitest";
import { formatRupiah } from "../../src/lib/currency";
import {
  addDaysToYmd,
  getTodayWibDateString,
  getWibClockParts,
  normalizeIndonesianWhatsapp,
  parseTimeHhMmToMinutes,
} from "../../src/lib/datetime-wib";
import {
  computeTrailTelemetry,
  haversineDistanceM,
  type TrailPointNode,
} from "../../src/lib/geo";
import { validateIndonesianNik } from "../../src/lib/nik-validator";

const GUNUNG_BENDERA_TRAIL: TrailPointNode[] = [
  {
    order: 0,
    code: "GATE",
    name: "Pintu Gunung Bendera",
    lat: -6.7287300041484785,
    lng: 108.382065227753,
    elevationM: 365,
    distFromPrevM: 0,
    minsFromPrev: 0,
  },
  {
    order: 1,
    code: "POS-1",
    name: "Pos 1",
    lat: -6.731303051407472,
    lng: 108.38230336912525,
    elevationM: 410,
    distFromPrevM: 290,
    minsFromPrev: 12,
  },
  {
    order: 2,
    code: "POS-2",
    name: "Pos 2",
    lat: -6.732029541218015,
    lng: 108.38256010969788,
    elevationM: 438,
    distFromPrevM: 95,
    minsFromPrev: 6,
  },
  {
    order: 3,
    code: "POS-3",
    name: "Pos 3",
    lat: -6.733036871907536,
    lng: 108.38324270590506,
    elevationM: 472,
    distFromPrevM: 140,
    minsFromPrev: 8,
  },
  {
    order: 4,
    code: "POS-4",
    name: "Pos 4",
    lat: -6.733372648339432,
    lng: 108.38289821809958,
    elevationM: 490,
    distFromPrevM: 60,
    minsFromPrev: 4,
  },
  {
    order: 5,
    code: "SUMMIT",
    name: "Puncak Gunung Bendera",
    lat: -6.73529125216858,
    lng: 108.38117851090418,
    elevationM: 520,
    distFromPrevM: 285,
    minsFromPrev: 15,
  },
];

describe("formatRupiah", () => {
  it("memformat integer Rupiah sesuai konvensi id (Rp18.000) dan en (IDR 18,000)", () => {
    expect(formatRupiah(18000, "id")).toBe("Rp18.000");
    expect(formatRupiah(13000, "id")).toBe("Rp13.000");
    expect(formatRupiah(18000, "en")).toBe("IDR 18,000");
    expect(formatRupiah(13000, "en")).toBe("IDR 13,000");
  });

  it("menolak angka pecahan non-integer", () => {
    expect(() => formatRupiah(18000.5, "id")).toThrow();
  });
});

describe("datetime-wib & WhatsApp E.164", () => {
  it("menghitung tanggal WIB dengan benar saat UTC masih hari sebelumnya (18:30 UTC = 01:30 WIB besok)", () => {
    const utcLate = new Date("2026-10-31T18:30:00.000Z");
    expect(getTodayWibDateString(utcLate)).toBe("2026-11-01");
    const parts = getWibClockParts(utcLate);
    expect(parts.hour).toBe(1);
    expect(parts.minute).toBe(30);
    expect(parts.dayOfWeek).toBe(0); // Minggu 1 Nov 2026
  });

  it("mengonversi jam buka HH:mm dan menambah hari pada YYYY-MM-DD", () => {
    expect(parseTimeHhMmToMinutes("05:30")).toBe(330);
    expect(parseTimeHhMmToMinutes("17:00")).toBe(1020);
    expect(addDaysToYmd("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("menormalisasi nomor WhatsApp Indonesia ke format E.164", () => {
    expect(normalizeIndonesianWhatsapp("0812-3456-7890")).toBe("+6281234567890");
    expect(normalizeIndonesianWhatsapp("6281234567890")).toBe("+6281234567890");
    expect(normalizeIndonesianWhatsapp("+62 812 3456 7890")).toBe(
      "+6281234567890"
    );
    expect(normalizeIndonesianWhatsapp("12345")).toBeNull();
  });
});

describe("Geometri Jalur Nyata Gunung Bendera (§5.8)", () => {
  it("menghitung panjang kumulatif polyline sekitar ~870 meter", () => {
    let total = 0;
    for (let i = 0; i < GUNUNG_BENDERA_TRAIL.length - 1; i++) {
      total += haversineDistanceM(
        GUNUNG_BENDERA_TRAIL[i]!,
        GUNUNG_BENDERA_TRAIL[i + 1]!
      );
    }
    expect(total).toBeGreaterThan(840);
    expect(total).toBeLessThan(910);
  });

  it("mendeteksi pendaki di dalam koridor antara Pos 1 dan Pos 2 sebagai aman (tidak keluar jalur)", () => {
    const midPos1Pos2 = {
      lat: (-6.731303051407472 + -6.732029541218015) / 2,
      lng: (108.38230336912525 + 108.38256010969788) / 2,
    };
    const telemetry = computeTrailTelemetry(
      midPos1Pos2,
      GUNUNG_BENDERA_TRAIL,
      35
    );
    expect(telemetry.isOffTrail).toBe(false);
    expect(telemetry.distanceToTrailM).toBeLessThan(2);
    expect(telemetry.nextPost?.code).toBe("POS-2");
    expect(telemetry.estimatedMinutesToNextPost).toBeGreaterThanOrEqual(1);
  });

  it("memicu peringatan keluar jalur (>35 m) ketika pendaki melenceng ke barat Pos 3 dan memberi arah kembali ke Timur", () => {
    // Geser 0.0008 derajat bujur ke Barat Pos 3 (~62.4 m tegak lurus dari segmen terdekat POS-2..POS-3)
    const offWestOfPos3 = {
      lat: -6.733036871907536,
      lng: 108.38324270590506 - 0.0008,
    };
    const telemetry = computeTrailTelemetry(
      offWestOfPos3,
      GUNUNG_BENDERA_TRAIL,
      35
    );
    expect(telemetry.isOffTrail).toBe(true);
    expect(telemetry.distanceToTrailM).toBeGreaterThan(55);
    expect(["E", "NE", "SE"]).toContain(telemetry.returnDirectionCode);
  });
});

describe("validateIndonesianNik - Standar Dukcapil & UU No. 24/2013", () => {
  it("memvalidasi NIK pria yang sah (3209121508980001 - Jawa Barat)", () => {
    const res = validateIndonesianNik("3209121508980001");
    expect(res.isValid).toBe(true);
    expect(res.data?.gender).toBe("LAKI_LAKI");
    expect(res.data?.birthDay).toBe(15);
    expect(res.data?.birthMonth).toBe(8);
    expect(res.data?.provinceCode).toBe("32");
    expect(res.data?.provinceName).toBe("Jawa Barat");
  });

  it("memvalidasi NIK wanita yang sah (+40 pada hari lahir: 3171015504010002 - DKI Jakarta)", () => {
    // 15 April 2001 wanita -> 15 + 40 = 55
    const res = validateIndonesianNik("3171015504010002");
    expect(res.isValid).toBe(true);
    expect(res.data?.gender).toBe("PEREMPUAN");
    expect(res.data?.birthDay).toBe(15);
    expect(res.data?.birthMonth).toBe(4);
    expect(res.data?.provinceCode).toBe("31");
    expect(res.data?.provinceName).toBe("DKI Jakarta");
  });

  it("menolak NIK kosong, kurang digit, atau mengandung karakter non-angka", () => {
    expect(validateIndonesianNik("").isValid).toBe(false);
    expect(validateIndonesianNik("32091215089800").isValid).toBe(false);
    expect(validateIndonesianNik("320912150898000199").isValid).toBe(false);
    expect(validateIndonesianNik("320912150898000A").isValid).toBe(false);
  });

  it("menolak NIK dummy repetitif identik", () => {
    expect(validateIndonesianNik("1111111111111111").isValid).toBe(false);
    expect(validateIndonesianNik("0000000000000000").isValid).toBe(false);
  });

  it("menolak NIK urutan angka dummy", () => {
    expect(validateIndonesianNik("1234567890123456").isValid).toBe(false);
    expect(validateIndonesianNik("0123456789012345").isValid).toBe(false);
  });

  it("menolak kode provinsi yang tidak terdaftar di Indonesia", () => {
    // 99 bukan kode provinsi di Indonesia
    const res = validateIndonesianNik("9909121508980001");
    expect(res.isValid).toBe(false);
    expect(res.message).toContain("Kode wilayah provinsi");
  });

  it("menolak tanggal lahir di luar batas (misal 32 pria atau 72 wanita)", () => {
    // Pria tanggal 32
    expect(validateIndonesianNik("3209123208980001").isValid).toBe(false);
    // Wanita tanggal 32 + 40 = 72
    expect(validateIndonesianNik("3209127208980001").isValid).toBe(false);
  });

  it("menolak bulan lahir di luar batas 01-12", () => {
    expect(validateIndonesianNik("3209121513980001").isValid).toBe(false);
    expect(validateIndonesianNik("3209121500980001").isValid).toBe(false);
  });

  it("menolak nomor urut registrasi 0000", () => {
    expect(validateIndonesianNik("3209121508980000").isValid).toBe(false);
  });
});

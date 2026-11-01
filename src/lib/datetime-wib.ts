import type { SupportedLocale } from "./currency";

export const WIB_TIMEZONE = "Asia/Jakarta";

/**
 * Mengembalikan tanggal hari ini dalam zona Asia/Jakarta (WIB) dengan format "YYYY-MM-DD".
 */
export function getTodayWibDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Mengembalikan komponen waktu WIB saat ini (hari dalam minggu 0=Minggu..6=Sabtu, jam, menit, total menit sejak 00:00).
 */
export function getWibClockParts(now: Date = new Date()): {
  dateStr: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
} {
  const dateStr = getTodayWibDateString(now);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: WIB_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const rawHour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return {
    dateStr,
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/**
 * Mengonversi string "HH:mm" (mis. "06:00" atau "17:00") menjadi menit sejak tengah malam.
 */
export function parseTimeHhMmToMinutes(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) {
    throw new Error(`Format jam tidak valid: ${hhmm}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Mengonversi string "YYYY-MM-DD" menjadi objek Date UTC tengah malam (untuk kolom Prisma @db.Date).
 */
export function parseVisitDateToUtcDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Format tanggal kunjungan tidak valid: ${dateStr}`);
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Tanggal kunjungan tidak valid: ${dateStr}`);
  }
  return date;
}

/**
 * Mengonversi Date dari kolom @db.Date kembali ke string "YYYY-MM-DD".
 */
export function formatUtcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Menambah N hari pada string tanggal "YYYY-MM-DD".
 */
export function addDaysToYmd(dateStr: string, days: number): string {
  const d = parseVisitDateToUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatUtcDateToYmd(d);
}

/**
 * Format tanggal kunjungan yang ramah pengguna sesuai locale (id: "31 Okt 2026", en: "31 Oct 2026").
 */
export function formatVisitDateDisplay(
  dateInput: Date | string,
  locale: SupportedLocale = "id"
): string {
  const date =
    typeof dateInput === "string"
      ? parseVisitDateToUtcDate(dateInput)
      : dateInput;

  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Format timestamp UTC ke tampilan tanggal + jam WIB.
 */
export function formatTimestampWib(
  date: Date,
  locale: SupportedLocale = "id"
): string {
  const formatted = new Intl.DateTimeFormat(
    locale === "en" ? "en-GB" : "id-ID",
    {
      timeZone: WIB_TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);

  return `${formatted} WIB`;
}

/**
 * Normalisasi nomor WhatsApp Indonesia ("0812..." / "62812..." / "+62812...") ke E.164 "+628...".
 */
export function normalizeIndonesianWhatsapp(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (/^08\d{7,12}$/.test(cleaned)) {
    return `+62${cleaned.slice(1)}`;
  }
  if (/^628\d{7,12}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^\+628\d{7,12}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

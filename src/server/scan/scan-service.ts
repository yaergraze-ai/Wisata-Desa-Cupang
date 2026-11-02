import "server-only";
import {
  GateType,
  OrderStatus,
  Prisma,
  Role,
  ScanResult,
  TicketStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import {
  formatUtcDateToYmd,
  getWibClockParts,
  parseTimeHhMmToMinutes,
  parseVisitDateToUtcDate,
} from "@/lib/datetime-wib";
import { verifyServerQrPayload } from "@/server/tickets/qr-crypto";
import { hashQrPayload } from "@/lib/qr-crypto";
import { writeAuditLog } from "@/server/audit/audit";

export type ScanReasonCode =
  | "OK"
  | "INVALID_TOKEN"
  | "UNAUTHORIZED_GATE"
  | "TICKET_INACTIVE"
  | "WRONG_DATE"
  | "OUTSIDE_HOURS"
  | "NOT_WHITE_TICKET"
  | "ALREADY_SCANNED_AT_GATE";

/** Gerbang fisik → slug destinasi untuk pengecekan jam buka (§5.4). */
export const GATE_DESTINATION_SLUG: Record<GateType, string> = {
  [GateType.GERBANG_BATU_LAWANG]: "batu-lawang",
  [GateType.PINTU_GUNUNG_BENDERA]: "gunung-bendera",
};

export interface ScanTicketSummary {
  id: string;
  publicCode: string;
  productCode: string;
  productName: string;
  visitorName: string;
  visitDateYmd: string;
  admitCount: number;
  status: TicketStatus;
  allowedGates: GateType[];
  acceptedGates: GateType[];
}

export interface ScanOutcome {
  result: ScanResult;
  reason: ScanReasonCode;
  gate: GateType;
  scannedAtIso: string;
  scanId: string | null;
  ticket: ScanTicketSummary | null;
  detail: Record<string, string | number> | null;
  todayAdmittedAtGate: number;
}

export interface ScanInput {
  rawInput: string;
  gate: GateType;
  staffUserId: string;
  staffRole: Role;
  staffAssignedGates: GateType[];
  locale: SupportedLocale;
  headers?: Headers;
  now?: Date;
}

const PUBLIC_CODE_RE = /^(PUTIH-CBN|REG-BL)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

/**
 * Resolusi string input dari pemindai QR atau input manual menjadi kriteria pencarian tiket Prisma.
 * Mendukung:
 * 1. Payload QR bertanda tangan: WC1.<nonce>.<hmac>
 * 2. URL lengkap tiket (mis. https://.../id/tickets?code=... atau /api/tickets/[ticketId]/qr)
 * 3. JSON terenkode (mis. {"token":"..."} atau {"code":"..."})
 * 4. Kode publik tiket (PUTIH-CBN-XXXXXX atau REG-BL-XXXXXX)
 * 5. Kode publik tanpa tanda strip (PUTIHCBNXXXXXX atau REGBLXXXXXX)
 * 6. ID tiket langsung (CUID / UUID)
 */
export function extractTicketLookupCriteria(
  rawInput: string
): Prisma.TicketWhereUniqueInput | null {
  if (!rawInput) return null;
  let raw = rawInput.trim();

  // Bersihkan kutip pembungkus
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // 1. Cek URL (misal scan tautan tiket pengunjung)
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsedUrl = new URL(raw);
      const urlToken =
        parsedUrl.searchParams.get("token") ||
        parsedUrl.searchParams.get("qr");
      if (urlToken) {
        const sub = extractTicketLookupCriteria(urlToken);
        if (sub) return sub;
      }

      const urlCode =
        parsedUrl.searchParams.get("code") ||
        parsedUrl.searchParams.get("publicCode");
      if (urlCode) {
        const sub = extractTicketLookupCriteria(urlCode);
        if (sub) return sub;
      }

      const urlTicketId =
        parsedUrl.searchParams.get("ticketId") ||
        parsedUrl.searchParams.get("id");
      if (urlTicketId) {
        const sub = extractTicketLookupCriteria(urlTicketId);
        if (sub) return sub;
      }

      // Cek segmen path URL: e.g. /tickets/[ticketId] atau /qr/[ticketId]
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      for (const segment of pathSegments.reverse()) {
        const sub = extractTicketLookupCriteria(segment);
        if (sub) return sub;
      }
    } catch {
      // Abaikan bila bukan URL yang valid
    }
  }

  // 2. Cek JSON
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const cand = String(
        parsed.token ||
          parsed.qr ||
          parsed.code ||
          parsed.publicCode ||
          parsed.ticketId ||
          parsed.id ||
          ""
      );
      if (cand) {
        const sub = extractTicketLookupCriteria(cand);
        if (sub) return sub;
      }
    } catch {
      // Abaikan
    }
  }

  // 3. Cek payload QR bertanda tangan WC1.<nonce>.<hmac>
  const wc1Match = raw.match(/WC1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (wc1Match) {
    const token = wc1Match[0];
    const verified = verifyServerQrPayload(token);
    if (verified.validSignature && verified.qrTokenHash) {
      return { qrTokenHash: verified.qrTokenHash };
    }
    // Fallback hash langsung
    return { qrTokenHash: hashQrPayload(token) };
  }

  // 4. Cek kode publik tiket (PUTIH-CBN-... atau REG-BL-...)
  const cleanCode = raw.toUpperCase().replace(/\s+/g, "");
  const publicCodeMatch = cleanCode.match(
    /(PUTIH-CBN|REG-BL)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/
  );
  if (publicCodeMatch) {
    return { publicCode: publicCodeMatch[0] };
  }

  // 4b. Toleransi kode publik tanpa tanda strip: PUTIHCBNXXXXXX -> PUTIH-CBN-XXXXXX
  const noDashMatch = cleanCode.match(
    /^(PUTIHCBN|REGBL)([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6})$/
  );
  if (noDashMatch) {
    const prefix = noDashMatch[1] === "PUTIHCBN" ? "PUTIH-CBN" : "REG-BL";
    return { publicCode: `${prefix}-${noDashMatch[2]}` };
  }

  // 5. Cek ID tiket langsung (CUID / UUID / CMID)
  if (/^[a-z0-9_-]{20,36}$/i.test(raw)) {
    return { id: raw };
  }

  return null;
}

/**
 * Evaluasi aturan murni (tanpa I/O) untuk tiket yang sudah ditemukan. Urutan pemeriksaan
 * mengikuti §5.4: status → tanggal WIB → jam buka → izin gerbang produk → sudah dipindai.
 */
export function evaluateScanRules(params: {
  gate: GateType;
  ticketStatus: TicketStatus;
  orderStatus: OrderStatus;
  visitDateYmd: string;
  allowedGates: GateType[];
  acceptedGates: GateType[];
  destinationOpenTime: string;
  destinationCloseTime: string;
  now: Date;
}): { reason: ScanReasonCode; detail: Record<string, string | number> | null } {
  const clock = getWibClockParts(params.now);

  if (
    params.ticketStatus !== TicketStatus.ACTIVE ||
    params.orderStatus !== OrderStatus.PAID
  ) {
    return { reason: "TICKET_INACTIVE", detail: { status: params.ticketStatus } };
  }

  if (params.visitDateYmd !== clock.dateStr) {
    return {
      reason: "WRONG_DATE",
      detail: { visitDate: params.visitDateYmd, today: clock.dateStr },
    };
  }

  const openMin = parseTimeHhMmToMinutes(params.destinationOpenTime);
  const closeMin = parseTimeHhMmToMinutes(params.destinationCloseTime);
  if (clock.minutesSinceMidnight < openMin || clock.minutesSinceMidnight >= closeMin) {
    return {
      reason: "OUTSIDE_HOURS",
      detail: {
        openTime: params.destinationOpenTime,
        closeTime: params.destinationCloseTime,
      },
    };
  }

  if (!params.allowedGates.includes(params.gate)) {
    return { reason: "NOT_WHITE_TICKET", detail: null };
  }

  if (params.acceptedGates.includes(params.gate)) {
    return { reason: "ALREADY_SCANNED_AT_GATE", detail: null };
  }

  return { reason: "OK", detail: null };
}

async function countAdmittedToday(gate: GateType, now: Date): Promise<number> {
  const todayYmd = getWibClockParts(now).dateStr;
  const startUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const rows = await db.gateScan.findMany({
    where: {
      gate,
      result: ScanResult.ACCEPTED,
      scannedAt: { gte: startUtc, lt: endUtc },
    },
    select: { ticket: { select: { admitCount: true } } },
  });
  return rows.reduce((sum, r) => sum + r.ticket.admitCount, 0);
}

/**
 * Memvalidasi satu pindaian QR/kode manual di gerbang. Penerimaan dilakukan dalam transaksi
 * dengan kunci baris Ticket + partial unique index `GateScan_ticket_gate_accepted_idx`, sehingga dua
 * petugas yang memindai bersamaan tidak mungkin sama-sama diterima (§5.4).
 */
export async function scanTicketAtGate(input: ScanInput): Promise<ScanOutcome> {
  const now = input.now ?? new Date();
  const raw = input.rawInput.trim();
  const isEn = input.locale === "en";

  const baseOutcome = (
    partial: Omit<ScanOutcome, "gate" | "todayAdmittedAtGate">
  ): Promise<ScanOutcome> =>
    countAdmittedToday(input.gate, now).then((todayAdmittedAtGate) => ({
      ...partial,
      gate: input.gate,
      todayAdmittedAtGate,
    }));

  // 1. Staf hanya boleh memindai di gerbang yang ditugaskan kepadanya
  const isAdminRole =
    input.staffRole === Role.ADMIN || input.staffRole === Role.SUPER_ADMIN;
  if (!isAdminRole && !input.staffAssignedGates.includes(input.gate)) {
    await writeAuditLog({
      actorId: input.staffUserId,
      actorRole: input.staffRole,
      action: "GATE_SCAN_UNAUTHORIZED_GATE",
      entity: "GateScan",
      headers: input.headers,
      metadata: { gate: input.gate },
    }).catch(() => undefined);
    return baseOutcome({
      result: ScanResult.REJECTED,
      reason: "UNAUTHORIZED_GATE",
      scannedAtIso: now.toISOString(),
      scanId: null,
      ticket: null,
      detail: null,
    });
  }

  // 2. Resolusi tiket: payload QR bertanda tangan HMAC, kode publik tiket, atau ID tiket
  const ticketWhere = extractTicketLookupCriteria(raw);

  const ticket = ticketWhere
    ? await db.ticket.findUnique({
        where: ticketWhere,
        include: {
          product: true,
          order: { select: { status: true } },
          gateScans: {
            where: { result: ScanResult.ACCEPTED },
            select: { gate: true },
          },
        },
      })
    : null;

  if (!ticket) {
    // GateScan mensyaratkan ticketId, maka percobaan token tak dikenal dicatat ke AuditLog (KEP-10)
    await writeAuditLog({
      actorId: input.staffUserId,
      actorRole: input.staffRole,
      action: "GATE_SCAN_INVALID_TOKEN",
      entity: "GateScan",
      headers: input.headers,
      metadata: {
        gate: input.gate,
        inputLength: raw.length,
        inputPrefix: raw.slice(0, 4),
      },
    }).catch(() => undefined);
    return baseOutcome({
      result: ScanResult.REJECTED,
      reason: "INVALID_TOKEN",
      scannedAtIso: now.toISOString(),
      scanId: null,
      ticket: null,
      detail: null,
    });
  }

  const destination = await db.destination.findUniqueOrThrow({
    where: { slug: GATE_DESTINATION_SLUG[input.gate] },
    select: { openTime: true, closeTime: true },
  });

  const buildSummary = (acceptedGates: GateType[]): ScanTicketSummary => ({
    id: ticket.id,
    publicCode: ticket.publicCode,
    productCode: ticket.product.code,
    productName: isEn ? ticket.product.nameEn : ticket.product.nameId,
    visitorName: ticket.visitorName,
    visitDateYmd: formatUtcDateToYmd(ticket.visitDate),
    admitCount: ticket.admitCount,
    status: ticket.status,
    allowedGates: ticket.product.allowedGates,
    acceptedGates,
  });

  const preAccepted = ticket.gateScans.map((s) => s.gate);
  const preCheck = evaluateScanRules({
    gate: input.gate,
    ticketStatus: ticket.status,
    orderStatus: ticket.order.status,
    visitDateYmd: formatUtcDateToYmd(ticket.visitDate),
    allowedGates: ticket.product.allowedGates,
    acceptedGates: preAccepted,
    destinationOpenTime: destination.openTime,
    destinationCloseTime: destination.closeTime,
    now,
  });

  const recordRejection = async (
    reason: ScanReasonCode,
    detail: Record<string, string | number> | null,
    acceptedGates: GateType[]
  ): Promise<ScanOutcome> => {
    const scan = await db.gateScan.create({
      data: {
        ticketId: ticket.id,
        gate: input.gate,
        staffId: input.staffUserId,
        result: ScanResult.REJECTED,
        reason,
        scannedAt: now,
      },
    });
    return baseOutcome({
      result: ScanResult.REJECTED,
      reason,
      scannedAtIso: scan.scannedAt.toISOString(),
      scanId: scan.id,
      ticket: buildSummary(acceptedGates),
      detail,
    });
  };

  if (preCheck.reason !== "OK") {
    return recordRejection(preCheck.reason, preCheck.detail, preAccepted);
  }

  // 3. Penerimaan transaksional anti-ganda
  try {
    const accepted = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE`;

      const fresh = await tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: {
          status: true,
          order: { select: { status: true } },
          gateScans: {
            where: { result: ScanResult.ACCEPTED },
            select: { gate: true },
          },
        },
      });
      const freshAccepted = fresh.gateScans.map((s) => s.gate);

      if (
        fresh.status !== TicketStatus.ACTIVE ||
        fresh.order.status !== OrderStatus.PAID
      ) {
        return { ok: false as const, reason: "TICKET_INACTIVE" as const, freshAccepted };
      }
      if (freshAccepted.includes(input.gate)) {
        return {
          ok: false as const,
          reason: "ALREADY_SCANNED_AT_GATE" as const,
          freshAccepted,
        };
      }

      const scan = await tx.gateScan.create({
        data: {
          ticketId: ticket.id,
          gate: input.gate,
          staffId: input.staffUserId,
          result: ScanResult.ACCEPTED,
          reason: "OK",
          scannedAt: now,
        },
      });
      return {
        ok: true as const,
        scan,
        freshAccepted: [...freshAccepted, input.gate],
      };
    });

    if (!accepted.ok) {
      return recordRejection(accepted.reason, null, accepted.freshAccepted);
    }

    return baseOutcome({
      result: ScanResult.ACCEPTED,
      reason: "OK",
      scannedAtIso: accepted.scan.scannedAt.toISOString(),
      scanId: accepted.scan.id,
      ticket: buildSummary(accepted.freshAccepted),
      detail: null,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return recordRejection("ALREADY_SCANNED_AT_GATE", null, [
        ...preAccepted,
        input.gate,
      ]);
    }
    throw err;
  }
}

export interface StaffScanHistoryRow {
  id: string;
  gate: GateType;
  result: ScanResult;
  reason: string;
  scannedAtIso: string;
  publicCode: string;
  productCode: string;
  visitorName: string;
  admitCount: number;
}

export async function getTodayScanHistory(params: {
  gate?: GateType;
  staffUserId?: string;
  now?: Date;
  limit?: number;
}): Promise<StaffScanHistoryRow[]> {
  const now = params.now ?? new Date();
  const todayYmd = getWibClockParts(now).dateStr;
  const startUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const rows = await db.gateScan.findMany({
    where: {
      scannedAt: { gte: startUtc, lt: endUtc },
      ...(params.gate ? { gate: params.gate } : {}),
      ...(params.staffUserId ? { staffId: params.staffUserId } : {}),
    },
    orderBy: { scannedAt: "desc" },
    take: params.limit ?? 60,
    include: {
      ticket: {
        select: {
          publicCode: true,
          visitorName: true,
          admitCount: true,
          product: { select: { code: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    gate: r.gate,
    result: r.result,
    reason: r.reason,
    scannedAtIso: r.scannedAt.toISOString(),
    publicCode: r.ticket.publicCode,
    productCode: r.ticket.product.code,
    visitorName: r.ticket.visitorName,
    admitCount: r.ticket.admitCount,
  }));
}

export interface StaffTicketSearchRow {
  id: string;
  publicCode: string;
  productCode: string;
  productName: string;
  visitorName: string;
  visitDateYmd: string;
  admitCount: number;
  status: TicketStatus;
  acceptedGates: GateType[];
}

/**
 * Pencarian tiket oleh staf (kode atau nama). Nomor WhatsApp sengaja TIDAK dikembalikan;
 * hanya bisa dibuka lewat endpoint "Tampilkan kontak" yang tercatat di AuditLog (§6.D.2).
 */
export async function searchTicketsForStaff(params: {
  query: string;
  locale: SupportedLocale;
  now?: Date;
}): Promise<StaffTicketSearchRow[]> {
  const q = params.query.trim();
  if (q.length < 3) return [];
  const now = params.now ?? new Date();
  const todayYmd = getWibClockParts(now).dateStr;
  const fromDate = parseVisitDateToUtcDate(todayYmd);
  fromDate.setUTCDate(fromDate.getUTCDate() - 7);

  const rows = await db.ticket.findMany({
    where: {
      visitDate: { gte: fromDate },
      OR: [
        { publicCode: { contains: q.toUpperCase() } },
        { visitorName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ visitDate: "asc" }, { issuedAt: "desc" }],
    take: 25,
    include: {
      product: true,
      gateScans: {
        where: { result: ScanResult.ACCEPTED },
        select: { gate: true },
      },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    publicCode: t.publicCode,
    productCode: t.product.code,
    productName: params.locale === "en" ? t.product.nameEn : t.product.nameId,
    visitorName: t.visitorName,
    visitDateYmd: formatUtcDateToYmd(t.visitDate),
    admitCount: t.admitCount,
    status: t.status,
    acceptedGates: t.gateScans.map((s) => s.gate),
  }));
}

export async function revealTicketContactForStaff(params: {
  ticketId: string;
  staffUserId: string;
  staffRole: Role;
  reason: string;
  headers?: Headers;
}): Promise<{ publicCode: string; visitorName: string; visitorWhatsapp: string } | null> {
  const ticket = await db.ticket.findUnique({
    where: { id: params.ticketId },
    select: { id: true, publicCode: true, visitorName: true, visitorWhatsapp: true },
  });
  if (!ticket) return null;

  await writeAuditLog({
    actorId: params.staffUserId,
    actorRole: params.staffRole,
    action: "STAFF_REVEAL_VISITOR_CONTACT",
    entity: "Ticket",
    entityId: ticket.id,
    headers: params.headers,
    metadata: {
      publicCode: ticket.publicCode,
      reason: params.reason.slice(0, 200),
    },
  });

  return {
    publicCode: ticket.publicCode,
    visitorName: ticket.visitorName,
    visitorWhatsapp: ticket.visitorWhatsapp,
  };
}

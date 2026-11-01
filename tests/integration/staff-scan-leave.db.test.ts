import { GateType, OrderStatus, Role, ScanResult, TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getTodayWibDateString, parseVisitDateToUtcDate } from "@/lib/datetime-wib";
import { generateReadableTicketCode } from "@/lib/qr-crypto";
import { issueServerQrCredentials } from "@/server/tickets/qr-crypto";
import {
  revealTicketContactForStaff,
  scanTicketAtGate,
} from "@/server/scan/scan-service";
import {
  requestSuddenLeave,
} from "@/server/staff/staff-schedule-service";

describe("Fase 5 DB Integration: Gate Scan Concurrency, Scan Rules, Cooldown & Contact Reveal (§5.4 & §5.7)", () => {
  const todayYmd = getTodayWibDateString();
  const todayUtc = parseVisitDateToUtcDate(todayYmd);

  let staffUser1Id = "";
  let staffProfile1Id = "";
  let staffUser2Id = "";
  let staffProfile2Id = "";
  let destinationId = "";

  let buyerUserId = "";
  let orderId = "";
  let whiteTicketId = "";
  let whiteTicketQr = "";
  let whiteTicketPublicCode = "";

  let regularTicketId = "";
  let regularTicketQr = "";
  let regularTicketPublicCode = "";

  beforeAll(async () => {
    // 1. Ambil destinasi Batu Lawang & Gunung Bendera
    const destBatuLawang = await db.destination.findUniqueOrThrow({
      where: { slug: "batu-lawang" },
    });
    destinationId = destBatuLawang.id;

    // Bersihkan sisa leave requests pada destinasi ini untuk pengujian bersih
    await db.leaveRequest.deleteMany({
      where: { destinationId },
    });

    // 2. Buat 2 akun Petugas Lapangan (STAFF)
    const staffUser1 = await db.user.create({
      data: {
        name: "Petugas Lapangan Uji 1",
        email: `staff-scan-1-${Date.now()}@wisata-cirebon.local`,
        role: Role.STAFF,
        whatsapp: "+6285724908831",
      },
    });
    staffUser1Id = staffUser1.id;

    const profile1 = await db.staffProfile.create({
      data: {
        userId: staffUser1Id,
        destinationId,
        jobTitleId: "Petugas Gerbang Utama",
        jobTitleEn: "Main Gate Ranger",
        publicName: "Budi Santoso",
        initials: "BS",
        whatsapp: "+6285724908831",
        assignedGates: [
          GateType.GERBANG_BATU_LAWANG,
          GateType.PINTU_GUNUNG_BENDERA,
        ],
        weeklySchedule: {
          "0": { enabled: true, start: "06:00", end: "17:00" },
          "1": { enabled: true, start: "06:00", end: "17:00" },
          "2": { enabled: true, start: "06:00", end: "17:00" },
          "3": { enabled: true, start: "06:00", end: "17:00" },
          "4": { enabled: true, start: "06:00", end: "17:00" },
          "5": { enabled: true, start: "06:00", end: "17:00" },
          "6": { enabled: true, start: "06:00", end: "17:00" },
        },
      },
    });
    staffProfile1Id = profile1.id;

    const staffUser2 = await db.user.create({
      data: {
        name: "Petugas Lapangan Uji 2",
        email: `staff-scan-2-${Date.now()}@wisata-cirebon.local`,
        role: Role.STAFF,
        whatsapp: "+6285724908832",
      },
    });
    staffUser2Id = staffUser2.id;

    const profile2 = await db.staffProfile.create({
      data: {
        userId: staffUser2Id,
        destinationId,
        jobTitleId: "Petugas Pintu Hutan",
        jobTitleEn: "Trailhead Ranger",
        publicName: "Siti Rahma",
        initials: "SR",
        whatsapp: "+6285724908832",
        assignedGates: [GateType.GERBANG_BATU_LAWANG],
        weeklySchedule: {
          "0": { enabled: true, start: "06:00", end: "17:00" },
          "1": { enabled: true, start: "06:00", end: "17:00" },
          "2": { enabled: true, start: "06:00", end: "17:00" },
          "3": { enabled: true, start: "06:00", end: "17:00" },
          "4": { enabled: true, start: "06:00", end: "17:00" },
          "5": { enabled: true, start: "06:00", end: "17:00" },
          "6": { enabled: true, start: "06:00", end: "17:00" },
        },
      },
    });
    staffProfile2Id = profile2.id;

    // 3. Buat Akun Pembeli & Pesanan Lunas dengan Tiket Putih dan Tiket Reguler untuk hari ini WIB
    const buyer = await db.user.create({
      data: {
        name: "Pengunjung Rombongan",
        email: `buyer-scan-${Date.now()}@wisata-cirebon.local`,
        role: Role.MEMBER,
        whatsapp: "+6285724908899",
      },
    });
    buyerUserId = buyer.id;

    const prodPutih = await db.ticketProduct.findUniqueOrThrow({
      where: { code: "TIKET_PUTIH" },
      include: { tariffs: { take: 1 } },
    });
    const prodReguler = await db.ticketProduct.findUniqueOrThrow({
      where: { code: "REGULER_BL" },
      include: { tariffs: { take: 1 } },
    });

    const order = await db.order.create({
      data: {
        orderNumber: `WC-${todayYmd.replace(/-/g, "")}-SCN${Date.now().toString().slice(-4)}`,
        userId: buyerUserId,
        visitDate: todayUtc,
        status: OrderStatus.PAID,
        paidAt: new Date(),
        totalAmount: 49000,
        expiresAt: new Date(Date.now() + 3600_000),
        provider: "midtrans",
        visitorName: "Raka Pratama",
        visitorWhatsapp: "+6285724908899",
        items: {
          create: [
            {
              productId: prodPutih.id,
              tariffId: prodPutih.tariffs[0]!.id,
              qty: 2,
              unitBase: 15000,
              unitParking: 3000,
              unitTotal: 18000,
              subtotal: 36000,
            },
            {
              productId: prodReguler.id,
              tariffId: prodReguler.tariffs[0]!.id,
              qty: 1,
              unitBase: 10000,
              unitParking: 3000,
              unitTotal: 13000,
              subtotal: 13000,
            },
          ],
        },
      },
      include: { items: true },
    });
    orderId = order.id;

    // Terbitkan Tiket Putih
    const itemPutih = order.items.find((i) => i.productId === prodPutih.id)!;
    const qrWhite = issueServerQrCredentials();
    whiteTicketQr = qrWhite.qrPayload;
    whiteTicketPublicCode = generateReadableTicketCode("TIKET_PUTIH");

    const tWhite = await db.ticket.create({
      data: {
        orderId: order.id,
        orderItemId: itemPutih.id,
        productId: prodPutih.id,
        publicCode: whiteTicketPublicCode,
        qrTokenHash: qrWhite.qrTokenHash,
        qrTokenCipher: qrWhite.qrTokenCipher,
        visitorName: "Raka Pratama",
        visitorWhatsapp: "+6285724908899",
        visitDate: todayUtc,
        admitCount: 2,
        status: TicketStatus.ACTIVE,
      },
    });
    whiteTicketId = tWhite.id;

    // Terbitkan Tiket Reguler
    const itemReguler = order.items.find((i) => i.productId === prodReguler.id)!;
    const qrReguler = issueServerQrCredentials();
    regularTicketQr = qrReguler.qrPayload;
    regularTicketPublicCode = generateReadableTicketCode("REGULER_BL");

    const tReguler = await db.ticket.create({
      data: {
        orderId: order.id,
        orderItemId: itemReguler.id,
        productId: prodReguler.id,
        publicCode: regularTicketPublicCode,
        qrTokenHash: qrReguler.qrTokenHash,
        qrTokenCipher: qrReguler.qrTokenCipher,
        visitorName: "Raka Pratama",
        visitorWhatsapp: "+6285724908899",
        visitDate: todayUtc,
        admitCount: 1,
        status: TicketStatus.ACTIVE,
      },
    });
    regularTicketId = tReguler.id;
  });

  afterAll(async () => {
    // Bersihkan seluruh data uji
    if (orderId) {
      await db.gateScan.deleteMany({
        where: { ticketId: { in: [whiteTicketId, regularTicketId] } },
      });
      await db.ticket.deleteMany({
        where: { orderId },
      });
      await db.order.deleteMany({
        where: { id: orderId },
      });
    }

    if (destinationId) {
      await db.leaveRequest.deleteMany({
        where: { destinationId },
      });
      await db.notification.deleteMany({
        where: { type: "STAFF_SUDDEN_LEAVE" },
      });
    }

    if (staffProfile1Id || staffProfile2Id) {
      await db.staffProfile.deleteMany({
        where: { id: { in: [staffProfile1Id, staffProfile2Id] } },
      });
    }

    const testUserIds = [staffUser1Id, staffUser2Id, buyerUserId].filter(Boolean);
    if (testUserIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { actorId: { in: testUserIds } },
      });
      await db.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
  });

  it("2 pindaian paralel untuk tiket yang sama di gerbang yang sama menghasilkan tepat 1 ACCEPTED dan 1 REJECTED (§5.4)", async () => {
    // Jalankan 2 pemindaian secara bersamaan
    // Menggunakan jam dinas siang (10:00 WIB)
    const scanTime = new Date(`${todayYmd}T03:00:00.000Z`);

    const scanPromise1 = scanTicketAtGate({
      rawInput: whiteTicketQr,
      gate: GateType.GERBANG_BATU_LAWANG,
      staffUserId: staffUser1Id,
      staffRole: Role.STAFF,
      staffAssignedGates: [
        GateType.GERBANG_BATU_LAWANG,
        GateType.PINTU_GUNUNG_BENDERA,
      ],
      locale: "id",
      now: scanTime,
    });

    const scanPromise2 = scanTicketAtGate({
      rawInput: whiteTicketQr,
      gate: GateType.GERBANG_BATU_LAWANG,
      staffUserId: staffUser2Id,
      staffRole: Role.STAFF,
      staffAssignedGates: [GateType.GERBANG_BATU_LAWANG],
      locale: "id",
      now: scanTime,
    });

    const [res1, res2] = await Promise.all([scanPromise1, scanPromise2]);

    const acceptedCount = (res1.result === ScanResult.ACCEPTED ? 1 : 0) +
      (res2.result === ScanResult.ACCEPTED ? 1 : 0);
    const rejectedCount = (res1.result === ScanResult.REJECTED ? 1 : 0) +
      (res2.result === ScanResult.REJECTED ? 1 : 0);

    expect(acceptedCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const rejectedRes = res1.result === ScanResult.REJECTED ? res1 : res2;
    expect(rejectedRes.reason).toBe("ALREADY_SCANNED_AT_GATE");

    // Pastikan di database tabel GateScan hanya ada tepat 1 baris ACCEPTED untuk tiket ini di gerbang ini
    const dbAcceptedScans = await db.gateScan.findMany({
      where: {
        ticketId: whiteTicketId,
        gate: GateType.GERBANG_BATU_LAWANG,
        result: ScanResult.ACCEPTED,
      },
    });
    expect(dbAcceptedScans).toHaveLength(1);
  });

  it("Tiket Putih yang telah di-scan di Gerbang Batu Lawang dapat dipindai lagi di Pintu Gunung Bendera (§5.4)", async () => {
    const scanTime = new Date(`${todayYmd}T04:00:00.000Z`);

    const secondGateRes = await scanTicketAtGate({
      rawInput: whiteTicketQr,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      staffUserId: staffUser1Id,
      staffRole: Role.STAFF,
      staffAssignedGates: [
        GateType.GERBANG_BATU_LAWANG,
        GateType.PINTU_GUNUNG_BENDERA,
      ],
      locale: "id",
      now: scanTime,
    });

    expect(secondGateRes.result).toBe(ScanResult.ACCEPTED);
    expect(secondGateRes.reason).toBe("OK");
    expect(secondGateRes.ticket?.acceptedGates).toContain(
      GateType.PINTU_GUNUNG_BENDERA
    );
  });

  it("menolak Tiket Reguler di Pintu Gunung Bendera dengan alasan NOT_WHITE_TICKET (§5.4)", async () => {
    const scanTime = new Date(`${todayYmd}T04:30:00.000Z`);

    const res = await scanTicketAtGate({
      rawInput: regularTicketQr,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      staffUserId: staffUser1Id,
      staffRole: Role.STAFF,
      staffAssignedGates: [
        GateType.GERBANG_BATU_LAWANG,
        GateType.PINTU_GUNUNG_BENDERA,
      ],
      locale: "id",
      now: scanTime,
    });

    expect(res.result).toBe(ScanResult.REJECTED);
    expect(res.reason).toBe("NOT_WHITE_TICKET");
  });

  it("menolak pemindaian di gerbang yang tidak ditugaskan kepada staf (§5.4)", async () => {
    const scanTime = new Date(`${todayYmd}T04:35:00.000Z`);

    // staffUser2 hanya ditugaskan di GERBANG_BATU_LAWANG
    const res = await scanTicketAtGate({
      rawInput: whiteTicketPublicCode,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      staffUserId: staffUser2Id,
      staffRole: Role.STAFF,
      staffAssignedGates: [GateType.GERBANG_BATU_LAWANG], // Tidak ada PINTU_GUNUNG_BENDERA
      locale: "id",
      now: scanTime,
    });

    expect(res.result).toBe(ScanResult.REJECTED);
    expect(res.reason).toBe("UNAUTHORIZED_GATE");
  });

  it("pengajuan libur mendadak menonaktifkan status dinas dan menegakkan cooldown 30 menit per destinasi di DB (§5.7)", async () => {
    const now = new Date(`${todayYmd}T05:00:00.000Z`);

    // Pengajuan libur ke-1 oleh Petugas 1 -> Berhasil
    const stateAfterLeave1 = await requestSuddenLeave({
      userId: staffUser1Id,
      reason: "Demam mendadak butuh istirahat",
      locale: "id",
      now,
    });

    expect(stateAfterLeave1.duty.onDuty).toBe(false);
    expect(stateAfterLeave1.leaveCooldownRemainingSeconds).toBeGreaterThan(0);

    // Verifikasi Notifikasi Admin in-app terbentuk
    const notif = await db.notification.findFirst({
      where: {
        type: "STAFF_SUDDEN_LEAVE",
        recipientRole: Role.ADMIN,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(notif).toBeDefined();

    // Pengajuan libur ke-2 oleh Petugas 2 pada destinasi yang sama selang 5 menit -> Wajib Ditolak 429 LEAVE_COOLDOWN_ACTIVE
    const nowPlus5Mins = new Date(now.getTime() + 5 * 60_000);

    await expect(
      requestSuddenLeave({
        userId: staffUser2Id,
        reason: "Keperluan mendadak lainnya",
        locale: "id",
        now: nowPlus5Mins,
      })
    ).rejects.toMatchObject({
      code: "LEAVE_COOLDOWN_ACTIVE",
      status: 429,
    });
  });

  it("fitur pembukaan kontak darurat pengunjung mengembalikan nomor WA dan mencatat ke AuditLog (§6.D.2)", async () => {
    const revealResult = await revealTicketContactForStaff({
      ticketId: whiteTicketId,
      staffUserId: staffUser1Id,
      staffRole: Role.STAFF,
      reason: "Pengunjung terpisah dari rombongan di pos 2 butuh dihubungi",
    });

    expect(revealResult).not.toBeNull();
    expect(revealResult?.visitorWhatsapp).toBe("+6285724908899");

    const audit = await db.auditLog.findFirst({
      where: {
        actorId: staffUser1Id,
        action: "STAFF_REVEAL_VISITOR_CONTACT",
        entityId: whiteTicketId,
      },
    });
    expect(audit).toBeDefined();
    expect((audit?.metadata as { reason?: string })?.reason).toContain("pos 2");
  });
});

import crypto from "node:crypto";
import { OrderStatus, Role, TicketStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  addDaysToYmd,
  getTodayWibDateString,
  parseVisitDateToUtcDate,
} from "@/lib/datetime-wib";
import { calculateServerOrderQuote } from "@/server/pricing/quote-service";
import {
  cancelPendingOrder,
  createCheckoutOrderAtomic,
  expireStaleOrders,
  OrderDomainError,
  processMidtransWebhook,
} from "@/server/orders/order-service";
import {
  revealServerQrPayload,
  verifyServerQrPayload,
} from "@/server/tickets/qr-crypto";

const TEST_WEBHOOK_SERVER_KEY = "SB-Mid-server-IntegrationTestKey2026Cirebon";

function signMidtransPayload(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return crypto
    .createHash("sha512")
    .update(
      `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`,
      "utf8"
    )
    .digest("hex");
}

describe("Fase 4 DB Integration: 100-Way Atomic Quota Lock & Midtrans Webhook (§5.2, §5.3, §5.4)", () => {
  const testUserEmail = `quota-test-${Date.now()}@wisata-cirebon.local`;
  let testUserId = "";
  let testVisitDateYmd = "";
  let testVisitUtcDate: Date;

  beforeAll(async () => {
    const todayWib = getTodayWibDateString();
    testVisitDateYmd = addDaysToYmd(todayWib, 42);
    testVisitUtcDate = parseVisitDateToUtcDate(testVisitDateYmd);

    const user = await db.user.create({
      data: {
        name: "Penguji Kuota Paralel",
        email: testUserEmail,
        emailVerified: true,
        role: Role.MEMBER,
        whatsapp: "+6285724908822",
      },
    });
    testUserId = user.id;

    // Bersihkan sisa data lama pada tanggal uji jika ada, lalu set kapasitas ketat = 10
    await db.order.deleteMany({
      where: { visitDate: testVisitUtcDate },
    });
    await db.dailyQuota.deleteMany({
      where: { date: testVisitUtcDate },
    });

    const destinations = await db.destination.findMany({
      where: { isActive: true },
    });

    for (const dest of destinations) {
      await db.dailyQuota.create({
        data: {
          date: testVisitUtcDate,
          destinationId: dest.id,
          capacity: 10,
          isCustom: true,
        },
      });
    }
  });

  afterAll(async () => {
    if (testUserId) {
      const userOrders = await db.order.findMany({
        where: { userId: testUserId },
        select: { id: true, orderNumber: true },
      });
      const orderIds = userOrders.map((o) => o.id);
      const orderNumbers = userOrders.map((o) => o.orderNumber);

      if (orderIds.length > 0) {
        await db.paymentEvent.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await db.order.deleteMany({
          where: { id: { in: orderIds } },
        });
      }
      if (orderNumbers.length > 0) {
        await db.auditLog.deleteMany({
          where: { entityId: { in: [...orderIds, ...orderNumbers] } },
        });
      }
      await db.auditLog.deleteMany({
        where: { actorId: testUserId },
      });
      await db.user.deleteMany({
        where: { id: testUserId },
      });
    }

    if (testVisitUtcDate) {
      await db.dailyQuota.deleteMany({
        where: { date: testVisitUtcDate },
      });
    }
  });

  it("100 pembelian paralel untuk sisa kuota 10 menghasilkan tepat 10 pesanan berhasil dan 0 oversell", async () => {
    const attempts = Array.from({ length: 100 }, (_, idx) =>
      createCheckoutOrderAtomic({
        userId: testUserId,
        userEmail: testUserEmail,
        userRole: Role.MEMBER,
        userSavedWhatsapp: "+6285724908822",
        userWhatsappVerifiedAt: new Date(),
        visitDate: testVisitDateYmd,
        putihQty: 1, // Mengunci 2 destinasi sekaligus (Batu Lawang + Gunung Bendera)
        regulerQty: 0,
        visitorName: `Pemesan Paralel ${idx + 1}`,
        visitorWhatsapp: "085724908822",
        locale: "id",
        skipExternalPaymentSession: true,
      })
    );

    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(10);
    expect(rejected).toHaveLength(90);

    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(OrderDomainError);
      expect((rej.reason as OrderDomainError).code).toBe("INSUFFICIENT_QUOTA");
    }

    // Pastikan sisa kuota di kedua destinasi tepat 0 (tidak pernah negatif / oversell)
    const quoteAfter = await calculateServerOrderQuote({
      visitDate: testVisitDateYmd,
      putihQty: 1,
      regulerQty: 0,
      locale: "id",
    });

    for (const dest of quoteAfter.destinations) {
      expect(dest.used).toBe(10);
      expect(dest.remaining).toBe(0);
    }
    expect(quoteAfter.canCheckout).toBe(false);
    expect(quoteAfter.blockingCode).toBe("INSUFFICIENT_QUOTA");
  });

  it("pembatalan pesanan PENDING dan kedaluwarsa expiresAt langsung melepas kuota kembali", async () => {
    const activePendingOrders = await db.order.findMany({
      where: {
        userId: testUserId,
        visitDate: testVisitUtcDate,
        status: OrderStatus.PENDING,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(activePendingOrders.length).toBe(10);

    // 1. Batalkan pesanan pertama -> 1 kursi langsung lepas
    const firstOrder = activePendingOrders[0]!;
    const cancelled = await cancelPendingOrder({
      orderId: firstOrder.id,
      actorId: testUserId,
      actorRole: Role.MEMBER,
      locale: "id",
    });
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    const replacementOrder = await createCheckoutOrderAtomic({
      userId: testUserId,
      userEmail: testUserEmail,
      userRole: Role.MEMBER,
      userSavedWhatsapp: "+6285724908822",
      userWhatsappVerifiedAt: new Date(),
      visitDate: testVisitDateYmd,
      putihQty: 1,
      regulerQty: 0,
      visitorName: "Pengganti Kursi Batal",
      visitorWhatsapp: "085724908822",
      locale: "id",
      skipExternalPaymentSession: true,
    });
    expect(replacementOrder.status).toBe(OrderStatus.PENDING);

    // 2. Mundurkan expiresAt pada pesanan kedua -> otomatis melepas kuota meski cron belum jalan
    const secondOrder = activePendingOrders[1]!;
    await db.order.update({
      where: { id: secondOrder.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const quoteAfterExpiry = await calculateServerOrderQuote({
      visitDate: testVisitDateYmd,
      putihQty: 1,
      regulerQty: 0,
      locale: "id",
    });
    expect(quoteAfterExpiry.canCheckout).toBe(true);
    expect(quoteAfterExpiry.destinations[0]?.remaining).toBe(1);

    const expireSummary = await expireStaleOrders();
    expect(expireSummary.expiredOrdersCount).toBeGreaterThanOrEqual(1);

    const refreshedSecond = await db.order.findUniqueOrThrow({
      where: { id: secondOrder.id },
    });
    expect(refreshedSecond.status).toBe(OrderStatus.EXPIRED);
  });

  it("memverifikasi tanda tangan webhook Midtrans, menolak manipulasi jumlah, menerbitkan QR, dan idempoten terhadap duplikat", async () => {
    const targetOrder = await db.order.findFirstOrThrow({
      where: {
        userId: testUserId,
        visitDate: testVisitUtcDate,
        status: OrderStatus.PENDING,
      },
      include: { items: true },
    });

    const grossStr = `${targetOrder.totalAmount}.00`;

    // A. Tanda tangan salah -> wajib ditolak 401
    await expect(
      processMidtransWebhook(
        {
          order_id: targetOrder.orderNumber,
          status_code: "200",
          gross_amount: grossStr,
          signature_key: "00".repeat(64),
          transaction_status: "settlement",
          transaction_id: "mid-tx-invalid-sig",
        },
        {
          explicitServerKey: TEST_WEBHOOK_SERVER_KEY,
          skipDelivery: true,
        }
      )
    ).rejects.toMatchObject({
      code: "INVALID_SIGNATURE",
      status: 401,
    });

    // B. Tanda tangan valid untuk angka yang dimanipulasi -> wajib ditolak 400 GROSS_AMOUNT_MISMATCH
    const wrongGross = "1000.00";
    const wrongGrossSig = signMidtransPayload({
      orderId: targetOrder.orderNumber,
      statusCode: "200",
      grossAmount: wrongGross,
      serverKey: TEST_WEBHOOK_SERVER_KEY,
    });

    await expect(
      processMidtransWebhook(
        {
          order_id: targetOrder.orderNumber,
          status_code: "200",
          gross_amount: wrongGross,
          signature_key: wrongGrossSig,
          transaction_status: "settlement",
          transaction_id: "mid-tx-wrong-gross",
        },
        {
          explicitServerKey: TEST_WEBHOOK_SERVER_KEY,
          skipDelivery: true,
        }
      )
    ).rejects.toMatchObject({
      code: "GROSS_AMOUNT_MISMATCH",
      status: 400,
    });

    // C. Webhook settlement sah -> pesanan PAID & Ticket QR terbit
    const validSig = signMidtransPayload({
      orderId: targetOrder.orderNumber,
      statusCode: "200",
      grossAmount: grossStr,
      serverKey: TEST_WEBHOOK_SERVER_KEY,
    });

    const settlementPayload = {
      order_id: targetOrder.orderNumber,
      status_code: "200",
      gross_amount: grossStr,
      signature_key: validSig,
      transaction_status: "settlement",
      fraud_status: "accept",
      transaction_id: "mid-tx-valid-001",
      payment_type: "qris",
    };

    const firstProcess = await processMidtransWebhook(settlementPayload, {
      explicitServerKey: TEST_WEBHOOK_SERVER_KEY,
      skipDelivery: true,
    });

    expect(firstProcess.ok).toBe(true);
    expect(firstProcess.duplicate).toBe(false);
    expect(firstProcess.status).toBe(OrderStatus.PAID);
    expect(firstProcess.ticketsIssued).toBe(targetOrder.items.length);

    // D. Pengiriman ulang webhook duplikat (5x paralel) -> 100% idempoten, tidak menerbitkan tiket ganda
    const duplicateRuns = await Promise.all(
      Array.from({ length: 5 }, () =>
        processMidtransWebhook(settlementPayload, {
          explicitServerKey: TEST_WEBHOOK_SERVER_KEY,
          skipDelivery: true,
        })
      )
    );

    for (const dup of duplicateRuns) {
      expect(dup.ok).toBe(true);
      expect(dup.duplicate).toBe(true);
      expect(dup.ticketsIssued).toBe(0);
    }

    const issuedTickets = await db.ticket.findMany({
      where: { orderId: targetOrder.id },
    });
    expect(issuedTickets).toHaveLength(targetOrder.items.length);

    const ticket = issuedTickets[0]!;
    expect(ticket.status).toBe(TicketStatus.ACTIVE);
    expect(ticket.publicCode.startsWith("PUTIH-CBN-")).toBe(true);
    expect(ticket.admitCount).toBe(1);

    const revealedQr = revealServerQrPayload(ticket.qrTokenCipher);
    const verified = verifyServerQrPayload(revealedQr);
    expect(verified.validSignature).toBe(true);
    expect(verified.qrTokenHash).toBe(ticket.qrTokenHash);
  });
});

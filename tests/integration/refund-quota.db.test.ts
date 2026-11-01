import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GateType,
  OrderStatus,
  RefundStatus,
  Role,
  ScanResult,
  TicketStatus,
} from "@prisma/client";
import { db } from "../../src/server/db";
import {
  checkRefundEligibility,
  decideRefundRequest,
  requestOrderRefund,
} from "../../src/server/refund/refund-service";
import { calculateServerOrderQuote } from "../../src/server/pricing/quote-service";

describe("Refund & Atomic Quota Release Engine", () => {
  let testUserId: string;
  let testAdminId: string;
  let testOrderId: string;
  let testOrderIdUsed: string;
  let testOrderIdPast: string;
  let futureVisitDate: Date;
  let futureYmd: string;
  let batuLawangDestId: string;
  let tiketPutihProductId: string;
  let tiketPutihTariffId: string;

  beforeAll(async () => {
    // 1. Get destination & product
    const bl = await db.destination.findUniqueOrThrow({
      where: { slug: "batu-lawang" },
    });
    batuLawangDestId = bl.id;

    const prod = await db.ticketProduct.findUniqueOrThrow({
      where: { code: "TIKET_PUTIH" },
      include: { tariffs: { orderBy: { version: "desc" }, take: 1 } },
    });
    tiketPutihProductId = prod.id;
    tiketPutihTariffId = prod.tariffs[0]!.id;

    // 2. Create test user & admin
    const user = await db.user.create({
      data: {
        email: `test-member-refund-${Date.now()}@example.com`,
        name: "Pengunjung Uji Refund",
        role: Role.MEMBER,
        whatsapp: "+6281234567801",
      },
    });
    testUserId = user.id;

    const admin = await db.user.create({
      data: {
        email: `test-admin-refund-${Date.now()}@example.com`,
        name: "Admin Uji Refund",
        role: Role.ADMIN,
        whatsapp: "+6281234567802",
      },
    });
    testAdminId = admin.id;

    // 3. Set future visit date (5 days ahead)
    const future = new Date();
    future.setDate(future.getDate() + 5);
    futureYmd = future.toISOString().slice(0, 10);
    const [fy, fm, fd] = futureYmd.split("-").map((n) => Number.parseInt(n, 10));
    futureVisitDate = new Date(Date.UTC(fy!, fm! - 1, fd!, 0, 0, 0));

    // 4. Materialize DailyQuota (capacity 100)
    await db.dailyQuota.upsert({
      where: {
        date_destinationId: {
          date: futureVisitDate,
          destinationId: batuLawangDestId,
        },
      },
      update: {
        capacity: 100,
        isCustom: true,
      },
      create: {
        date: futureVisitDate,
        destinationId: batuLawangDestId,
        capacity: 100,
        isCustom: true,
      },
    });

    // 5. Create eligible test order (2 tickets, each has separate OrderItem)
    const order = await db.order.create({
      data: {
        orderNumber: `ORD-REF-TEST-${Date.now()}`,
        userId: testUserId,
        visitorName: "Pengunjung Utama",
        visitorWhatsapp: "+6281234567801",
        visitDate: futureVisitDate,
        status: OrderStatus.PAID,
        totalAmount: 50000,
        provider: "midtrans",
        providerRef: `SNAP-REF-${Date.now()}`,
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        items: {
          create: [
            {
              productId: tiketPutihProductId,
              tariffId: tiketPutihTariffId,
              qty: 1,
              unitBase: 20000,
              unitParking: 5000,
              unitTotal: 25000,
              subtotal: 25000,
            },
            {
              productId: tiketPutihProductId,
              tariffId: tiketPutihTariffId,
              qty: 1,
              unitBase: 20000,
              unitParking: 5000,
              unitTotal: 25000,
              subtotal: 25000,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });
    testOrderId = order.id;

    // Create tickets linked to items
    await db.ticket.create({
      data: {
        orderId: order.id,
        orderItemId: order.items[0]!.id,
        productId: tiketPutihProductId,
        publicCode: `TKT-RF1-${Date.now()}`,
        qrTokenHash: `hash-rf1-${Date.now()}`,
        qrTokenCipher: "cipher-rf1",
        visitorName: "Pengunjung A",
        visitorWhatsapp: "+6281234567801",
        visitDate: futureVisitDate,
        admitCount: 1,
        status: TicketStatus.ACTIVE,
      },
    });

    await db.ticket.create({
      data: {
        orderId: order.id,
        orderItemId: order.items[1]!.id,
        productId: tiketPutihProductId,
        publicCode: `TKT-RF2-${Date.now()}`,
        qrTokenHash: `hash-rf2-${Date.now()}`,
        qrTokenCipher: "cipher-rf2",
        visitorName: "Pengunjung B",
        visitorWhatsapp: "+6281234567801",
        visitDate: futureVisitDate,
        admitCount: 1,
        status: TicketStatus.ACTIVE,
      },
    });

    // 6. Create order with used ticket (has scan)
    const usedOrder = await db.order.create({
      data: {
        orderNumber: `ORD-USED-${Date.now()}`,
        userId: testUserId,
        visitorName: "Pengunjung Used Utama",
        visitorWhatsapp: "+6281234567801",
        visitDate: futureVisitDate,
        status: OrderStatus.PAID,
        totalAmount: 25000,
        provider: "midtrans",
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        items: {
          create: [
            {
              productId: tiketPutihProductId,
              tariffId: tiketPutihTariffId,
              qty: 1,
              unitBase: 20000,
              unitParking: 5000,
              unitTotal: 25000,
              subtotal: 25000,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });
    testOrderIdUsed = usedOrder.id;

    const usedTicket = await db.ticket.create({
      data: {
        orderId: usedOrder.id,
        orderItemId: usedOrder.items[0]!.id,
        productId: tiketPutihProductId,
        publicCode: `TKT-USED-${Date.now()}`,
        qrTokenHash: `hash-used-${Date.now()}`,
        qrTokenCipher: "cipher-used",
        visitorName: "Pengunjung Used",
        visitorWhatsapp: "+6281234567801",
        visitDate: futureVisitDate,
        admitCount: 1,
        status: TicketStatus.ACTIVE,
      },
    });

    await db.gateScan.create({
      data: {
        ticketId: usedTicket.id,
        gate: GateType.GERBANG_BATU_LAWANG,
        staffId: testAdminId,
        result: ScanResult.ACCEPTED,
        reason: "VALID",
      },
    });

    // 7. Create past order (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastYmd = yesterday.toISOString().slice(0, 10);
    const [py, pm, pd] = pastYmd.split("-").map((n) => Number.parseInt(n, 10));
    const pastDate = new Date(Date.UTC(py!, pm! - 1, pd!, 0, 0, 0));

    const pastOrder = await db.order.create({
      data: {
        orderNumber: `ORD-PAST-${Date.now()}`,
        userId: testUserId,
        visitorName: "Pengunjung Past Utama",
        visitorWhatsapp: "+6281234567801",
        visitDate: pastDate,
        status: OrderStatus.PAID,
        totalAmount: 25000,
        provider: "midtrans",
        paidAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        items: {
          create: [
            {
              productId: tiketPutihProductId,
              tariffId: tiketPutihTariffId,
              qty: 1,
              unitBase: 20000,
              unitParking: 5000,
              unitTotal: 25000,
              subtotal: 25000,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });
    testOrderIdPast = pastOrder.id;

    await db.ticket.create({
      data: {
        orderId: pastOrder.id,
        orderItemId: pastOrder.items[0]!.id,
        productId: tiketPutihProductId,
        publicCode: `TKT-PAST-${Date.now()}`,
        qrTokenHash: `hash-past-${Date.now()}`,
        qrTokenCipher: "cipher-past",
        visitorName: "Pengunjung Past",
        visitorWhatsapp: "+6281234567801",
        visitDate: pastDate,
        admitCount: 1,
        status: TicketStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    const validOrderIds = [testOrderId, testOrderIdUsed, testOrderIdPast].filter(Boolean);
    if (validOrderIds.length > 0) {
      await db.refundRequest.deleteMany({
        where: { orderId: { in: validOrderIds } },
      });
      await db.gateScan.deleteMany({
        where: { staffId: testAdminId },
      });
      await db.ticket.deleteMany({
        where: { orderId: { in: validOrderIds } },
      });
      await db.orderItem.deleteMany({
        where: { orderId: { in: validOrderIds } },
      });
      await db.order.deleteMany({
        where: { id: { in: validOrderIds } },
      });
    }
    const validUserIds = [testUserId, testAdminId].filter(Boolean);
    if (validUserIds.length > 0) {
      await db.auditLog.deleteMany({
        where: { actorId: { in: validUserIds } },
      });
      await db.notification.deleteMany({
        where: { recipientUserId: { in: validUserIds } },
      });
      await db.user.deleteMany({
        where: { id: { in: validUserIds } },
      });
    }
  });

  it("evaluates eligibility correctly for active, used, and expired orders", async () => {
    // 1. Eligible future order
    const checkEligible = await checkRefundEligibility(testUserId, testOrderId);
    expect(checkEligible.canRefund).toBe(true);
    expect(checkEligible.order?.totalAmount).toBe(50000);
    expect(checkEligible.order?.ticketCount).toBe(2);

    // 2. Used ticket order is rejected
    const checkUsed = await checkRefundEligibility(testUserId, testOrderIdUsed);
    expect(checkUsed.canRefund).toBe(false);
    expect(checkUsed.code).toBe("TICKET_ALREADY_USED");

    // 3. Past order is rejected (cutoff exceeded)
    const checkPast = await checkRefundEligibility(testUserId, testOrderIdPast);
    expect(checkPast.canRefund).toBe(false);
    expect(checkPast.code).toBe("CUTOFF_EXCEEDED");
  });

  it("submits refund request and transitions order to REFUND_REQUESTED", async () => {
    const request = await requestOrderRefund(
      testUserId,
      testOrderId,
      "Rencana perjalanan keluarga mendadak dibatalkan karena hal darurat."
    );

    expect(request.id).toBeDefined();
    expect(request.status).toBe(RefundStatus.PENDING);
    expect(request.amount).toBe(50000);

    // Verify order status
    const order = await db.order.findUniqueOrThrow({
      where: { id: testOrderId },
    });
    expect(order.status).toBe(OrderStatus.REFUND_REQUESTED);

    // Verify duplicate request blocked
    const checkDuplicate = await checkRefundEligibility(testUserId, testOrderId);
    expect(checkDuplicate.canRefund).toBe(false);
    expect(checkDuplicate.code).toBe("ALREADY_REQUESTED");
  });

  it("approves refund, releases quota in server quote engine, and cancels tickets", async () => {
    const pendingRequest = await db.refundRequest.findFirstOrThrow({
      where: { orderId: testOrderId, status: RefundStatus.PENDING },
    });

    // Check server quote used quota before refund approval
    const quoteBefore = await calculateServerOrderQuote({
      visitDate: futureYmd,
      putihQty: 1,
      regulerQty: 0,
      locale: "id",
    });
    const blBefore = quoteBefore.destinations.find((d) => d.slug === "batu-lawang");
    const usedBefore = blBefore?.used ?? 0;
    expect(usedBefore).toBeGreaterThanOrEqual(2);

    // Admin approves refund
    const decision = await decideRefundRequest(
      testAdminId,
      pendingRequest.id,
      {
        decision: "APPROVE",
        note: "Refund disetujui penuh sesuai kebijakan pembatalan H-24.",
      }
    );

    expect(decision.status).toBe(RefundStatus.APPROVED);

    // 1. Verify server quote releases quota: used count should drop by 2 tickets!
    const quoteAfter = await calculateServerOrderQuote({
      visitDate: futureYmd,
      putihQty: 1,
      regulerQty: 0,
      locale: "id",
    });
    const blAfter = quoteAfter.destinations.find((d) => d.slug === "batu-lawang");
    const usedAfter = blAfter?.used ?? 0;
    expect(usedAfter).toBe(usedBefore - 2);

    // 2. Order status must be REFUNDED
    const orderAfter = await db.order.findUniqueOrThrow({
      where: { id: testOrderId },
    });
    expect(orderAfter.status).toBe(OrderStatus.REFUNDED);

    // 3. Tickets status must be REFUNDED
    const ticketsAfter = await db.ticket.findMany({
      where: { orderId: testOrderId },
    });
    expect(ticketsAfter.length).toBe(2);
    expect(ticketsAfter.every((t) => t.status === TicketStatus.REFUNDED)).toBe(true);

    // 4. Audit Log created
    const auditLogs = await db.auditLog.findMany({
      where: {
        action: "REFUND_APPROVED",
        entityId: pendingRequest.id,
      },
    });
    expect(auditLogs.length).toBe(1);
    const meta = auditLogs[0]!.metadata as Record<string, unknown>;
    expect(meta.releasedTicketsCount).toBe(2);
  });
});

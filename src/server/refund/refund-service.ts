import {
  OrderStatus,
  RefundChannel,
  RefundStatus,
  Role,
  TicketStatus,
} from "@prisma/client";
import { db } from "@/server/db";

export class RefundServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "NOT_ORDER_OWNER"
      | "ORDER_NOT_PAID"
      | "CUTOFF_EXCEEDED"
      | "TICKET_ALREADY_USED"
      | "ALREADY_REQUESTED"
      | "INVALID_REASON"
      | "REQUEST_NOT_FOUND"
      | "REQUEST_NOT_PENDING"
  ) {
    super(message);
    this.name = "RefundServiceError";
  }
}

export interface RefundEligibilityResult {
  canRefund: boolean;
  code?: string;
  reasonId?: string;
  reasonEn?: string;
  minHoursBeforeVisit?: number;
  order?: {
    id: string;
    orderNumber: string;
    visitDateYmd: string;
    totalAmount: number;
    ticketCount: number;
  };
}

/**
 * Checks whether an order is eligible for refund:
 * 1. Must be PAID
 * 2. Visit date must be >= refundMinHoursBeforeVisit (default 24h) in future
 * 3. 0 tickets of this order have an accepted gate scan
 * 4. Not already requested or refunded
 */
export async function checkRefundEligibility(
  userId: string,
  orderId: string
): Promise<RefundEligibilityResult> {
  const [order, settingRow] = await Promise.all([
    db.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: {
          include: {
            gateScans: {
              where: { result: "ACCEPTED" },
              select: { id: true },
            },
          },
        },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.siteSetting.findUnique({
      where: { key: "refundMinHoursBeforeVisit" },
      select: { value: true },
    }),
  ]);

  if (!order || order.userId !== userId) {
    return {
      canRefund: false,
      code: "ORDER_NOT_FOUND",
      reasonId: "Pesanan tidak ditemukan atau bukan milik Anda.",
      reasonEn: "Order not found or does not belong to you.",
    };
  }

  // Check pending refund request first
  const latestRequest = order.refundRequests[0];
  if (latestRequest && latestRequest.status === RefundStatus.PENDING) {
    return {
      canRefund: false,
      code: "ALREADY_REQUESTED",
      reasonId: "Pengajuan refund sedang menunggu persetujuan pengelola.",
      reasonEn: "A refund request is pending manager approval.",
    };
  }

  if (order.status !== OrderStatus.PAID) {
    return {
      canRefund: false,
      code: "ORDER_NOT_PAID",
      reasonId:
        order.status === OrderStatus.REFUND_REQUESTED
          ? "Pengajuan refund untuk pesanan ini sedang dalam antrean peninjauan."
          : order.status === OrderStatus.REFUNDED
            ? "Pesanan ini sudah berhasil di-refund sebelumnya."
            : "Hanya pesanan yang sudah lunas (PAID) yang dapat diajukan refund.",
      reasonEn:
        order.status === OrderStatus.REFUND_REQUESTED
          ? "A refund request for this order is currently pending review."
          : order.status === OrderStatus.REFUNDED
            ? "This order has already been refunded."
            : "Only fully paid orders are eligible for refund.",
    };
  }

  // Check if any ticket has been used/scanned
  const hasUsedTicket = order.tickets.some((t) => t.gateScans.length > 0);
  if (hasUsedTicket) {
    return {
      canRefund: false,
      code: "TICKET_ALREADY_USED",
      reasonId:
        "Tiket pada pesanan ini sudah pernah dipindai/digunakan di gerbang wisata.",
      reasonEn:
        "Tickets from this order have already been scanned/used at the gate.",
    };
  }

  // Calculate cutoff hours before visit date at 06:00 WIB
  const minHours = Number.parseInt(settingRow?.value ?? "24", 10) || 24;
  const visitYmd = order.visitDate.toISOString().slice(0, 10);
  const [vy, vm, vd] = visitYmd.split("-").map((n) => Number.parseInt(n, 10));

  // Gate opens at 06:00 WIB (UTC+7)
  const visitOpeningUtcMs = Date.UTC(vy!, vm! - 1, vd!, 6 - 7, 0, 0);
  const nowMs = Date.now();
  const diffHours = (visitOpeningUtcMs - nowMs) / (1000 * 60 * 60);

  if (diffHours < minHours) {
    return {
      canRefund: false,
      code: "CUTOFF_EXCEEDED",
      minHoursBeforeVisit: minHours,
      reasonId: `Batas waktu pengajuan refund adalah minimal ${minHours} jam sebelum jam operasional hari kunjungan (${visitYmd} 06:00 WIB). Sisa waktu saat ini: ${Math.max(0, Math.floor(diffHours))} jam.`,
      reasonEn: `Refund requests must be submitted at least ${minHours} hours prior to the visit date opening (${visitYmd} 06:00 WIB). Current remaining: ${Math.max(0, Math.floor(diffHours))} hours.`,
    };
  }

  return {
    canRefund: true,
    minHoursBeforeVisit: minHours,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      visitDateYmd: visitYmd,
      totalAmount: order.totalAmount,
      ticketCount: order.tickets.length,
    },
  };
}

export async function requestOrderRefund(
  userId: string,
  orderId: string,
  reason: string,
  context?: { ip?: string; userAgent?: string }
) {
  const trimmedReason = reason?.trim() ?? "";
  if (trimmedReason.length < 10 || trimmedReason.length > 1000) {
    throw new RefundServiceError(
      "Alasan pengajuan refund wajib diisi antara 10 sampai 1.000 karakter.",
      "INVALID_REASON"
    );
  }

  const eligibility = await checkRefundEligibility(userId, orderId);
  if (!eligibility.canRefund || !eligibility.order) {
    throw new RefundServiceError(
      eligibility.reasonId || "Pesanan tidak memenuhi syarat refund.",
      (eligibility.code as RefundServiceError["code"]) || "CUTOFF_EXCEEDED"
    );
  }

  const refundRequest = await db.$transaction(async (tx) => {
    // 1. Create RefundRequest
    const created = await tx.refundRequest.create({
      data: {
        orderId,
        requestedById: userId,
        reason: trimmedReason,
        amount: eligibility.order!.totalAmount,
        status: RefundStatus.PENDING,
      },
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
    });

    // 2. Update Order status to REFUND_REQUESTED
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.REFUND_REQUESTED },
    });

    // 3. Create AuditLog
    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: "MEMBER",
        action: "REFUND_REQUESTED",
        entity: "RefundRequest",
        entityId: created.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          orderId,
          orderNumber: created.order.orderNumber,
          amount: created.amount,
          reason: trimmedReason,
        },
      },
    });

    // 4. Notify Admins & Super Admins
    await tx.notification.create({
      data: {
        recipientRole: Role.ADMIN,
        type: "REFUND_REQUESTED",
        titleKey: "Notifications.refundRequestedTitle",
        bodyKey: "Notifications.refundRequestedBody",
        params: {
          orderNumber: created.order.orderNumber,
          amount: created.amount,
        },
        linkPath: `/dashboard/admin?tab=refunds&request=${created.id}`,
      },
    });

    return created;
  });

  return refundRequest;
}

export interface DecideRefundInput {
  decision: "APPROVE" | "REJECT";
  note?: string;
  refundChannel?: RefundChannel;
}

export async function decideRefundRequest(
  adminUserId: string,
  refundRequestId: string,
  input: DecideRefundInput,
  context?: { ip?: string; userAgent?: string }
) {
  const request = await db.refundRequest.findUnique({
    where: { id: refundRequestId },
    include: {
      order: {
        include: {
          tickets: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    throw new RefundServiceError(
      "Permintaan refund tidak ditemukan.",
      "REQUEST_NOT_FOUND"
    );
  }

  if (request.status !== RefundStatus.PENDING) {
    throw new RefundServiceError(
      "Permintaan refund ini sudah diputuskan sebelumnya.",
      "REQUEST_NOT_PENDING"
    );
  }

  const order = request.order;

  if (input.decision === "REJECT") {
    const updated = await db.$transaction(async (tx) => {
      const rejected = await tx.refundRequest.update({
        where: { id: request.id },
        data: {
          status: RefundStatus.REJECTED,
          decidedById: adminUserId,
          decidedAt: new Date(),
          note: input.note?.trim() || "Pengajuan refund ditolak oleh pengelola.",
        },
      });

      // Restore order status to PAID
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: "ADMIN",
          action: "REFUND_REJECTED",
          entity: "RefundRequest",
          entityId: rejected.id,
          ip: context?.ip,
          userAgent: context?.userAgent,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            note: rejected.note,
          },
        },
      });

      // Notify Member
      await tx.notification.create({
        data: {
          recipientUserId: request.requestedById,
          type: "REFUND_REJECTED",
          titleKey: "Notifications.refundRejectedTitle",
          bodyKey: "Notifications.refundRejectedBody",
          params: {
            orderNumber: order.orderNumber,
            note: rejected.note || "",
          },
          linkPath: `/dashboard?tab=orders&order=${order.id}`,
        },
      });

      return rejected;
    });

    return updated;
  }

  // Decision === APPROVE
  const updated = await db.$transaction(async (tx) => {
    // 1. Invalidate all tickets belonging to this order (sets status to REFUNDED)
    // This immediately releases the consumed capacity in the dynamic quota calculator.
    await tx.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: TicketStatus.REFUNDED },
    });

    // 3. Mark RefundRequest as APPROVED
    const refundChannel = input.refundChannel ?? RefundChannel.MANUAL;
    const providerRef =
      refundChannel === RefundChannel.PROVIDER_API && order.providerRef
        ? `REF-SNAP-${order.providerRef}`
        : `REF-MANUAL-${Date.now()}`;

    const approved = await tx.refundRequest.update({
      where: { id: request.id },
      data: {
        status: RefundStatus.APPROVED,
        decidedById: adminUserId,
        decidedAt: new Date(),
        refundChannel,
        providerRefundRef: providerRef,
        note: input.note?.trim() || "Refund disetujui oleh pengelola.",
      },
    });

    // 4. Update Order status to REFUNDED
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.REFUNDED },
    });

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: "ADMIN",
        action: "REFUND_APPROVED",
        entity: "RefundRequest",
        entityId: approved.id,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: approved.amount,
          refundChannel,
          providerRefundRef: providerRef,
          releasedTicketsCount: order.tickets.length,
          note: approved.note,
        },
      },
    });

    // 6. Notify Member
    await tx.notification.create({
      data: {
        recipientUserId: request.requestedById,
        type: "REFUND_APPROVED",
        titleKey: "Notifications.refundApprovedTitle",
        bodyKey: "Notifications.refundApprovedBody",
        params: {
          orderNumber: order.orderNumber,
          amount: approved.amount,
        },
        linkPath: `/dashboard?tab=orders&order=${order.id}`,
      },
    });

    return approved;
  });

  return updated;
}

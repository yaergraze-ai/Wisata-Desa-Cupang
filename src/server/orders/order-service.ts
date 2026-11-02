import "server-only";
import crypto from "node:crypto";
import {
  GateType,
  Locale,
  OrderStatus,
  Prisma,
  RefundStatus,
  Role,
  ScanResult,
  TicketStatus,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { getEnv, getIntegrationFlags } from "@/server/env";
import type { SupportedLocale } from "@/lib/currency";
import {
  formatUtcDateToYmd,
  getTodayWibDateString,
  getWibClockParts,
  normalizeIndonesianWhatsapp,
  parseVisitDateToUtcDate,
} from "@/lib/datetime-wib";
import {
  generateReadableOrderNumber,
  generateReadableTicketCode,
} from "@/lib/qr-crypto";
import {
  issueServerQrCredentials,
  revealServerQrPayload,
} from "@/server/tickets/qr-crypto";
import {
  generateTicketQrDataUrl,
} from "@/server/tickets/ticket-documents";
import { deliverOrderTicketsNotification } from "@/server/tickets/ticket-delivery";
import { evaluateDateAndCutoffRules } from "@/server/pricing/quote-service";
import {
  getPaymentProvider,
  verifyMidtransWebhookSignature,
  type PaymentClientConfig,
  type PaymentItemLine,
} from "@/server/integrations/payment/payment-provider";
import { writeAuditLog } from "@/server/audit/audit";

export type OrderErrorCode =
  | "INVALID_INPUT"
  | "INVALID_WHATSAPP"
  | "WHATSAPP_OTP_REQUIRED"
  | "INVALID_DATE_FORMAT"
  | "PAST_DATE"
  | "OUTSIDE_BOOKING_WINDOW"
  | "SAME_DAY_CUTOFF"
  | "ZERO_QTY"
  | "EXCEEDS_MAX_TICKETS"
  | "INSUFFICIENT_QUOTA"
  | "ORDER_NOT_FOUND"
  | "FORBIDDEN"
  | "ORDER_NOT_CANCELLABLE"
  | "PAYMENT_PROVIDER_ERROR"
  | "INVALID_SIGNATURE"
  | "GROSS_AMOUNT_MISMATCH";

export class OrderDomainError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OrderDomainError";
  }
}

export interface SerializedTicketGateScan {
  id: string;
  gate: GateType;
  scannedAtIso: string;
}

export interface SerializedWalletTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  publicCode: string;
  productCode: string;
  productName: string;
  visitorName: string;
  visitorWhatsapp: string;
  visitDateYmd: string;
  admitCount: number;
  unitBase: number;
  unitParking: number;
  unitTotal: number;
  subtotal: number;
  status: TicketStatus;
  displayUsed: boolean;
  allowedGates: GateType[];
  acceptedScans: SerializedTicketGateScan[];
  qrDataUrl: string;
  hasReview: boolean;
  issuedAtIso: string;
}

export interface SerializedOrderItem {
  id: string;
  productCode: string;
  productName: string;
  qty: number;
  unitBase: number;
  unitParking: number;
  unitTotal: number;
  subtotal: number;
  ticketId: string | null;
  ticketPublicCode: string | null;
}

export interface SerializedOrderSummary {
  id: string;
  orderNumber: string;
  visitDateYmd: string;
  status: OrderStatus;
  effectiveExpired: boolean;
  totalAmount: number;
  expiresAtIso: string;
  provider: string;
  snapToken: string | null;
  snapRedirectUrl: string | null;
  visitorName: string;
  visitorWhatsapp: string;
  paidAtIso: string | null;
  cancelledAtIso: string | null;
  createdAtIso: string;
  latestRefundStatus: RefundStatus | null;
  items: SerializedOrderItem[];
  tickets: SerializedWalletTicket[];
}

export interface MemberDashboardSnapshot {
  orders: SerializedOrderSummary[];
  walletTickets: SerializedWalletTicket[];
  paymentConfig: PaymentClientConfig;
  whatsappIntegrationActive: boolean;
  refundMinHoursBeforeVisit: number;
}

export const checkoutInputSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  putihQty: z.number().int().min(0).max(50),
  regulerQty: z.number().int().min(0).max(50),
  visitorName: z.string().trim().min(2).max(100),
  visitorWhatsapp: z.string().trim().min(8).max(24),
  locale: z.enum(["id", "en"]).default("id"),
});

export interface CreateCheckoutOrderInput {
  userId: string;
  userEmail: string;
  userRole: Role;
  userSavedWhatsapp: string | null;
  userWhatsappVerifiedAt: Date | null;
  visitDate: string;
  putihQty: number;
  regulerQty: number;
  visitorName: string;
  visitorWhatsapp: string;
  locale: SupportedLocale;
  headers?: Headers;
  now?: Date;
  skipExternalPaymentSession?: boolean;
}

const midtransWebhookSchema = z
  .object({
    order_id: z.string().min(1),
    status_code: z.string().min(1),
    gross_amount: z.string().min(1),
    signature_key: z.string().min(1),
    transaction_status: z.string().min(1),
    transaction_id: z.string().optional(),
    fraud_status: z.string().optional(),
    payment_type: z.string().optional(),
  })
  .passthrough();

type OrderWithFullRelations = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: true;
        ticket: {
          include: {
            gateScans: true;
            review: { select: { id: true } };
          };
        };
      };
    };
    refundRequests: {
      orderBy: { createdAt: "desc" };
      take: 1;
    };
  };
}>;

async function serializeOrderRecord(
  order: OrderWithFullRelations,
  locale: SupportedLocale,
  now: Date = new Date()
): Promise<SerializedOrderSummary> {
  const isEn = locale === "en";
  const visitDateYmd = formatUtcDateToYmd(order.visitDate);
  const tickets: SerializedWalletTicket[] = [];
  const items: SerializedOrderItem[] = [];

  for (const item of order.items) {
    const productName = isEn ? item.product.nameEn : item.product.nameId;
    items.push({
      id: item.id,
      productCode: item.product.code,
      productName,
      qty: item.qty,
      unitBase: item.unitBase,
      unitParking: item.unitParking,
      unitTotal: item.unitTotal,
      subtotal: item.subtotal,
      ticketId: item.ticket?.id ?? null,
      ticketPublicCode: item.ticket?.publicCode ?? null,
    });

    if (item.ticket) {
      const qrPayload = revealServerQrPayload(item.ticket.qrTokenCipher);
      const qrDataUrl = await generateTicketQrDataUrl(qrPayload);
      const acceptedScans = item.ticket.gateScans
        .filter((s) => s.result === ScanResult.ACCEPTED)
        .sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime())
        .map((s) => ({
          id: s.id,
          gate: s.gate,
          scannedAtIso: s.scannedAt.toISOString(),
        }));

      tickets.push({
        id: item.ticket.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        publicCode: item.ticket.publicCode,
        productCode: item.product.code,
        productName,
        visitorName: item.ticket.visitorName,
        visitorWhatsapp: item.ticket.visitorWhatsapp,
        visitDateYmd: formatUtcDateToYmd(item.ticket.visitDate),
        admitCount: item.ticket.admitCount,
        unitBase: item.unitBase,
        unitParking: item.unitParking,
        unitTotal: item.unitTotal,
        subtotal: item.subtotal,
        status: item.ticket.status,
        displayUsed: acceptedScans.length > 0,
        allowedGates: item.product.allowedGates,
        acceptedScans,
        qrDataUrl,
        hasReview: Boolean(item.ticket.review),
        issuedAtIso: item.ticket.issuedAt.toISOString(),
      });
    }
  }

  const effectiveExpired =
    order.status === OrderStatus.EXPIRED ||
    (order.status === OrderStatus.PENDING && order.expiresAt <= now);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    visitDateYmd,
    status: effectiveExpired && order.status === OrderStatus.PENDING
      ? OrderStatus.EXPIRED
      : order.status,
    effectiveExpired,
    totalAmount: order.totalAmount,
    expiresAtIso: order.expiresAt.toISOString(),
    provider: order.provider,
    snapToken: order.providerRef,
    snapRedirectUrl: order.snapRedirectUrl,
    visitorName: order.visitorName,
    visitorWhatsapp: order.visitorWhatsapp,
    paidAtIso: order.paidAt ? order.paidAt.toISOString() : null,
    cancelledAtIso: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    createdAtIso: order.createdAt.toISOString(),
    latestRefundStatus: order.refundRequests[0]?.status ?? null,
    items,
    tickets,
  };
}

/**
 * Checkout atomik dengan SELECT ... FOR UPDATE pada baris DailyQuota berurutan
 * berdasarkan destinationId ASC agar anti-deadlock dan anti-oversell (§5.2).
 */
export async function createCheckoutOrderAtomic(
  input: CreateCheckoutOrderInput
): Promise<SerializedOrderSummary> {
  const parsed = checkoutInputSchema.safeParse({
    visitDate: input.visitDate,
    putihQty: input.putihQty,
    regulerQty: input.regulerQty,
    visitorName: input.visitorName,
    visitorWhatsapp: input.visitorWhatsapp,
    locale: input.locale,
  });

  if (!parsed.success) {
    throw new OrderDomainError(
      "INVALID_INPUT",
      400,
      parsed.error.issues[0]?.message ?? "Input pemesanan tiket tidak valid."
    );
  }

  const normalizedWhatsapp = normalizeIndonesianWhatsapp(
    parsed.data.visitorWhatsapp
  );
  if (!normalizedWhatsapp) {
    throw new OrderDomainError(
      "INVALID_WHATSAPP",
      400,
      input.locale === "en"
        ? "Enter a valid Indonesian WhatsApp number (08... or +628...)."
        : "Masukkan nomor WhatsApp Indonesia yang sah (08... atau +628...)."
    );
  }

  const flags = getIntegrationFlags();
  if (flags.whatsapp) {
    const savedNorm = input.userSavedWhatsapp
      ? normalizeIndonesianWhatsapp(input.userSavedWhatsapp)
      : null;
    if (!input.userWhatsappVerifiedAt || savedNorm !== normalizedWhatsapp) {
      throw new OrderDomainError(
        "WHATSAPP_OTP_REQUIRED",
        403,
        input.locale === "en"
          ? "Verify your WhatsApp number via OTP before completing ticket purchase."
          : "Verifikasi nomor WhatsApp Anda melalui OTP terlebih dahulu sebelum membeli tiket."
      );
    }
  }

  const now = input.now ?? new Date();
  const clock = getWibClockParts(now);
  const todayWib = clock.dateStr;

  const [destinationsRaw, productsRaw, settingsRaw] = await Promise.all([
    db.destination.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    }),
    db.ticketProduct.findMany({
      where: { isActive: true },
      include: {
        tariffs: {
          where: { effectiveFrom: { lte: now } },
          orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
          take: 1,
        },
      },
      orderBy: { code: "asc" },
    }),
    db.siteSetting.findMany(),
  ]);

  const settingMap = new Map(settingsRaw.map((s) => [s.key, s.value]));
  const maxTicketsPerOrder = Math.max(
    1,
    Number.parseInt(settingMap.get("maxTicketsPerOrder") ?? "10", 10) || 10
  );
  const bookingWindowDays = Math.max(
    1,
    Number.parseInt(settingMap.get("bookingWindowDays") ?? "60", 10) || 60
  );
  const paymentWindowMinutes = Math.max(
    5,
    Number.parseInt(settingMap.get("paymentWindowMinutes") ?? "15", 10) || 15
  );
  const sameDayCloseBufferMinutes = Math.max(
    0,
    Number.parseInt(settingMap.get("sameDayCloseBufferMinutes") ?? "60", 10) ||
      60
  );

  const totalVisitors = parsed.data.putihQty + parsed.data.regulerQty;
  if (totalVisitors <= 0) {
    throw new OrderDomainError(
      "ZERO_QTY",
      400,
      input.locale === "en"
        ? "Select at least 1 ticket."
        : "Pilih minimal 1 tiket."
    );
  }

  if (totalVisitors > maxTicketsPerOrder) {
    throw new OrderDomainError(
      "EXCEEDS_MAX_TICKETS",
      400,
      input.locale === "en"
        ? `Maximum ${maxTicketsPerOrder} tickets per order.`
        : `Maksimal ${maxTicketsPerOrder} tiket per pesanan.`,
      { maxTicketsPerOrder }
    );
  }

  // Susun item pesanan dari tarif berversi di server
  const requestedBySlug = new Map<string, number>();
  const preparedItems: Array<{
    productId: string;
    productCode: string;
    productName: string;
    tariffId: string;
    qty: number;
    unitBase: number;
    unitParking: number;
    unitTotal: number;
    subtotal: number;
    consumesDestinations: string[];
  }> = [];

  for (const prod of productsRaw) {
    const qty =
      prod.code === "TIKET_PUTIH"
        ? parsed.data.putihQty
        : prod.code === "REGULER_BL"
          ? parsed.data.regulerQty
          : 0;

    if (qty <= 0) continue;

    const tariff = prod.tariffs[0];
    if (!tariff) {
      throw new OrderDomainError(
        "INVALID_INPUT",
        500,
        `Tarif aktif untuk produk ${prod.code} tidak ditemukan.`
      );
    }

    const unitBase = tariff.basePrice;
    const unitParking = tariff.parkingFee;
    const unitTotal = unitBase + unitParking;
    const subtotal = unitTotal * qty;

    preparedItems.push({
      productId: prod.id,
      productCode: prod.code,
      productName: input.locale === "en" ? prod.nameEn : prod.nameId,
      tariffId: tariff.id,
      qty,
      unitBase,
      unitParking,
      unitTotal,
      subtotal,
      consumesDestinations: prod.consumesDestinations,
    });

    for (const slug of prod.consumesDestinations) {
      requestedBySlug.set(slug, (requestedBySlug.get(slug) ?? 0) + qty);
    }
  }

  if (preparedItems.length === 0) {
    throw new OrderDomainError(
      "ZERO_QTY",
      400,
      input.locale === "en"
        ? "No active ticket packages selected."
        : "Tidak ada paket tiket aktif yang dipilih."
    );
  }

  const consumedDestinations = destinationsRaw
    .filter((d) => (requestedBySlug.get(d.slug) ?? 0) > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const dateCheck = evaluateDateAndCutoffRules({
    visitDate: parsed.data.visitDate,
    todayWib,
    bookingWindowDays,
    sameDayCloseBufferMinutes,
    currentWibMinutes: clock.minutesSinceMidnight,
    consumedDestinations: consumedDestinations.map((d) => ({
      slug: d.slug,
      name: input.locale === "en" ? d.nameEn : d.nameId,
      closeTime: d.closeTime,
    })),
  });

  if (dateCheck.blockingCode) {
    const code = dateCheck.blockingCode as OrderErrorCode;
    throw new OrderDomainError(
      code,
      400,
      input.locale === "en"
        ? `Visit date ${parsed.data.visitDate} is unavailable (${code}).`
        : `Tanggal kunjungan ${parsed.data.visitDate} tidak tersedia (${code}).`,
      {
        cutoffDestinationName: dateCheck.cutoffDestinationName,
        cutoffTimeWib: dateCheck.cutoffTimeWib,
      }
    );
  }

  const visitDateYmd = parsed.data.visitDate;
  const targetUtcDate = parseVisitDateToUtcDate(visitDateYmd);
  const grandTotal = preparedItems.reduce((sum, i) => sum + i.subtotal, 0);
  const expiresAt = new Date(now.getTime() + paymentWindowMinutes * 60_000);
  const sortedDestIds = consumedDestinations.map((d) => d.id);

  // Transaksi penguncian baris DailyQuota berurutan untuk mencegah deadlock & oversell
  const createdOrder = await db.$transaction(
    async (tx) => {
      for (const dest of consumedDestinations) {
        const newQuotaId = crypto.randomUUID();
        await tx.$executeRaw`
          INSERT INTO "DailyQuota" ("id", "date", "destinationId", "capacity", "isCustom", "updatedAt")
          VALUES (${newQuotaId}, ${visitDateYmd}::date, ${dest.id}, ${dest.defaultCapacity}, false, NOW())
          ON CONFLICT ("date", "destinationId") DO NOTHING
        `;
      }

      const lockedRows = await tx.$queryRaw<
        Array<{ id: string; destinationId: string; capacity: number }>
      >(Prisma.sql`
        SELECT "id", "destinationId", "capacity"
        FROM "DailyQuota"
        WHERE "date" = ${visitDateYmd}::date
          AND "destinationId" IN (${Prisma.join(sortedDestIds)})
        ORDER BY "destinationId" ASC
        FOR UPDATE
      `);

      const capacityByDestId = new Map(
        lockedRows.map((r) => [r.destinationId, r.capacity])
      );

      const activeOrders = await tx.order.findMany({
        where: {
          visitDate: targetUtcDate,
          OR: [
            {
              status: {
                in: [OrderStatus.PAID, OrderStatus.REFUND_REQUESTED],
              },
            },
            {
              status: OrderStatus.PENDING,
              expiresAt: { gt: now },
            },
          ],
        },
        select: {
          status: true,
          items: {
            select: {
              qty: true,
              product: { select: { consumesDestinations: true } },
              ticket: { select: { status: true } },
            },
          },
        },
      });

      const usedBySlug = new Map<string, number>();
      for (const ord of activeOrders) {
        for (const item of ord.items) {
          if (
            ord.status !== OrderStatus.PENDING &&
            item.ticket &&
            item.ticket.status !== TicketStatus.ACTIVE
          ) {
            continue;
          }
          for (const slug of item.product.consumesDestinations) {
            usedBySlug.set(slug, (usedBySlug.get(slug) ?? 0) + item.qty);
          }
        }
      }

      for (const dest of consumedDestinations) {
        const capacity =
          capacityByDestId.get(dest.id) ?? dest.defaultCapacity;
        const used = usedBySlug.get(dest.slug) ?? 0;
        const remaining = Math.max(0, capacity - used);
        const requested = requestedBySlug.get(dest.slug) ?? 0;

        if (requested > remaining) {
          const destName = input.locale === "en" ? dest.nameEn : dest.nameId;
          throw new OrderDomainError(
            "INSUFFICIENT_QUOTA",
            409,
            input.locale === "en"
              ? `${destName} remaining quota for this date: ${remaining}`
              : `Sisa kuota ${destName} tanggal ini: ${remaining}`,
            {
              destinationSlug: dest.slug,
              destinationName: destName,
              remaining,
              requested,
            }
          );
        }
      }

      // Buat nomor pesanan unik (coba ulang bila terjadi tabrakan acak langka)
      let orderNumber = generateReadableOrderNumber(todayWib);
      for (let attempt = 0; attempt < 4; attempt++) {
        const collision = await tx.order.findUnique({
          where: { orderNumber },
          select: { id: true },
        });
        if (!collision) break;
        orderNumber = generateReadableOrderNumber(todayWib);
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: input.userId,
          locale: input.locale === "en" ? Locale.en : Locale.id,
          visitDate: targetUtcDate,
          status: OrderStatus.PENDING,
          totalAmount: grandTotal,
          expiresAt,
          provider: "midtrans",
          visitorName: parsed.data.visitorName,
          visitorWhatsapp: normalizedWhatsapp,
          items: {
            create: preparedItems.map((item) => ({
              productId: item.productId,
              tariffId: item.tariffId,
              qty: item.qty,
              unitBase: item.unitBase,
              unitParking: item.unitParking,
              unitTotal: item.unitTotal,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              ticket: {
                include: {
                  gateScans: true,
                  review: { select: { id: true } },
                },
              },
            },
          },
          refundRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
    },
    {
      maxWait: 25_000,
      timeout: 30_000,
    }
  );

  // Simpan nomor WhatsApp ke profil pengguna bila sebelumnya masih kosong
  if (!input.userSavedWhatsapp) {
    await db.user
      .update({
        where: { id: input.userId },
        data: { whatsapp: normalizedWhatsapp },
      })
      .catch(() => undefined);
  }

  let finalOrder: OrderWithFullRelations = createdOrder;
  const paymentProvider = getPaymentProvider();

  if (paymentProvider.isConfigured() && !input.skipExternalPaymentSession) {
    const appUrl = getEnv().APP_URL.replace(/\/$/, "");
    const finishUrl =
      input.locale === "en"
        ? `${appUrl}/en/dashboard?tab=wallet&order=${encodeURIComponent(createdOrder.id)}`
        : `${appUrl}/dashboard?tab=wallet&order=${encodeURIComponent(createdOrder.id)}`;

    const midtransItems: PaymentItemLine[] = [];
    for (const item of preparedItems) {
      midtransItems.push({
        id: `${item.productCode}-BASE`,
        name:
          input.locale === "en"
            ? `${item.productName} (Ticket)`
            : `${item.productName} (Tiket)`,
        price: item.unitBase,
        quantity: item.qty,
      });
      if (item.unitParking > 0) {
        midtransItems.push({
          id: `${item.productCode}-PARK`,
          name:
            input.locale === "en"
              ? `${item.productName} (Parking)`
              : `${item.productName} (Parkir)`,
          price: item.unitParking,
          quantity: item.qty,
        });
      }
    }

    try {
      const snap = await paymentProvider.createSnapTransaction({
        orderNumber: createdOrder.orderNumber,
        grossAmount: createdOrder.totalAmount,
        expiryMinutes: paymentWindowMinutes,
        customerName: createdOrder.visitorName,
        customerEmail: input.userEmail,
        customerPhone: createdOrder.visitorWhatsapp,
        finishUrl,
        items: midtransItems,
      });

      finalOrder = await db.order.update({
        where: { id: createdOrder.id },
        data: {
          providerRef: snap.token,
          snapRedirectUrl: snap.redirectUrl,
        },
        include: {
          items: {
            include: {
              product: true,
              ticket: {
                include: {
                  gateScans: true,
                  review: { select: { id: true } },
                },
              },
            },
          },
          refundRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
    } catch (err) {
      // Batalkan pesanan PENDING jika pembuatan sesi Snap Midtrans gagal agar kuota langsung dilepas kembali
      await db.order
        .update({
          where: { id: createdOrder.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        })
        .catch(() => undefined);

      const message =
        err instanceof Error
          ? err.message
          : "Gagal membuat sesi pembayaran Midtrans Snap.";

      await writeAuditLog({
        actorId: input.userId,
        actorRole: input.userRole,
        action: "ORDER_PAYMENT_SESSION_FAILED",
        entity: "Order",
        entityId: createdOrder.id,
        headers: input.headers,
        metadata: {
          orderNumber: createdOrder.orderNumber,
          error: message,
        },
      }).catch(() => undefined);

      throw new OrderDomainError("PAYMENT_PROVIDER_ERROR", 502, message);
    }
  }

  await writeAuditLog({
    actorId: input.userId,
    actorRole: input.userRole,
    action: "ORDER_CREATED_PENDING",
    entity: "Order",
    entityId: finalOrder.id,
    headers: input.headers,
    metadata: {
      orderNumber: finalOrder.orderNumber,
      visitDate: visitDateYmd,
      totalAmount: finalOrder.totalAmount,
      putihQty: parsed.data.putihQty,
      regulerQty: parsed.data.regulerQty,
      snapConfigured: paymentProvider.isConfigured(),
    },
  }).catch(() => undefined);

  return serializeOrderRecord(finalOrder, input.locale, now);
}

/**
 * Membatalkan pesanan PENDING dan otomatis melepas kembali kuota tanggal tersebut (§5.2 & §6.C.2).
 */
export async function cancelPendingOrder(params: {
  orderId: string;
  actorId: string;
  actorRole: Role;
  locale: SupportedLocale;
  headers?: Headers;
}): Promise<SerializedOrderSummary> {
  const now = new Date();
  const isAdmin =
    params.actorRole === Role.ADMIN || params.actorRole === Role.SUPER_ADMIN;

  const updated = await db.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "Order" WHERE "id" = ${params.orderId} FOR UPDATE
    `;

    const existing = await tx.order.findUnique({
      where: { id: params.orderId },
    });

    if (!existing) {
      throw new OrderDomainError(
        "ORDER_NOT_FOUND",
        404,
        params.locale === "en"
          ? "Order not found."
          : "Pesanan tidak ditemukan."
      );
    }

    if (existing.userId !== params.actorId && !isAdmin) {
      throw new OrderDomainError(
        "FORBIDDEN",
        403,
        params.locale === "en"
          ? "You are not allowed to cancel this order."
          : "Anda tidak memiliki izin untuk membatalkan pesanan ini."
      );
    }

    if (existing.status !== OrderStatus.PENDING) {
      throw new OrderDomainError(
        "ORDER_NOT_CANCELLABLE",
        409,
        params.locale === "en"
          ? `Order in status ${existing.status} cannot be cancelled.`
          : `Pesanan berstatus ${existing.status} tidak dapat dibatalkan.`
      );
    }

    return tx.order.update({
      where: { id: existing.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
      },
      include: {
        items: {
          include: {
            product: true,
            ticket: {
              include: {
                gateScans: true,
                review: { select: { id: true } },
              },
            },
          },
        },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  });

  await writeAuditLog({
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: "ORDER_CANCELLED",
    entity: "Order",
    entityId: updated.id,
    headers: params.headers,
    metadata: {
      orderNumber: updated.orderNumber,
      cancelledByAdmin: isAdmin && updated.userId !== params.actorId,
    },
  }).catch(() => undefined);

  return serializeOrderRecord(updated, params.locale, now);
}

/**
 * Merapikan status pesanan PENDING yang sudah lewat expiresAt menjadi EXPIRED
 * serta tiket ACTIVE yang lewat tanggal kunjungan WIB tanpa scan menjadi EXPIRED (§5.2 & §5.4).
 */
/**
 * Membersihkan arsip tiket terpakai/kedaluwarsa yang sudah berumur lebih dari 30 hari dari database (§5.4).
 * Tiket yang dihapus mencakup yang telah digunakan di gerbang atau berstatus EXPIRED / CANCELLED / REFUNDED.
 */
export async function cleanupArchivedTickets(
  retentionDays = 30,
  now: Date = new Date()
): Promise<number> {
  const cutoffTime = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffYmd = getTodayWibDateString(cutoffTime);
  const cutoffDate = parseVisitDateToUtcDate(cutoffYmd);

  const deleted = await db.ticket.deleteMany({
    where: {
      visitDate: { lt: cutoffDate },
      OR: [
        { gateScans: { some: { result: ScanResult.ACCEPTED } } },
        {
          status: {
            in: [
              TicketStatus.EXPIRED,
              TicketStatus.CANCELLED,
              TicketStatus.REFUNDED,
            ],
          },
        },
      ],
    },
  });

  return deleted.count;
}

export async function expireStaleOrders(now: Date = new Date()): Promise<{
  expiredOrdersCount: number;
  expiredTicketsCount: number;
  cleanedArchivedTicketsCount: number;
}> {
  const todayWib = getTodayWibDateString(now);
  const todayUtcDate = parseVisitDateToUtcDate(todayWib);

  const [ordersRes, ticketsRes, cleanedTicketsCount] = await Promise.all([
    db.order.updateMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: OrderStatus.EXPIRED,
      },
    }),
    db.ticket.updateMany({
      where: {
        status: TicketStatus.ACTIVE,
        visitDate: { lt: todayUtcDate },
        gateScans: {
          none: {
            result: ScanResult.ACCEPTED,
          },
        },
      },
      data: {
        status: TicketStatus.EXPIRED,
      },
    }),
    cleanupArchivedTickets(30, now).catch(() => 0),
  ]);

  return {
    expiredOrdersCount: ordersRes.count,
    expiredTicketsCount: ticketsRes.count,
    cleanedArchivedTicketsCount: cleanedTicketsCount,
  };
}

export interface ProcessMidtransWebhookResult {
  ok: true;
  duplicate: boolean;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  ticketsIssued: number;
}

/**
 * Memproses webhook resmi Midtrans dengan verifikasi SHA-512, pencocokan gross_amount,
 * idempotensi PaymentEvent.eventKey, dan penerbitan Ticket + QR (§5.3 & §5.4).
 */
export async function processMidtransWebhook(
  rawBody: unknown,
  options?: {
    explicitServerKey?: string;
    headers?: Headers;
    now?: Date;
    skipDelivery?: boolean;
    skipSignatureVerify?: boolean;
  }
): Promise<ProcessMidtransWebhookResult> {
  const parsed = midtransWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new OrderDomainError(
      "INVALID_INPUT",
      400,
      "Payload notifikasi Midtrans tidak lengkap."
    );
  }

  const payload = parsed.data;
  const signatureValid =
    options?.skipSignatureVerify === true ||
    verifyMidtransWebhookSignature(
      {
        orderId: payload.order_id,
        statusCode: payload.status_code,
        grossAmount: payload.gross_amount,
        signatureKey: payload.signature_key,
      },
      options?.explicitServerKey
    );

  if (!signatureValid) {
    await writeAuditLog({
      action: "PAYMENT_WEBHOOK_INVALID_SIGNATURE",
      entity: "PaymentEvent",
      entityId: payload.order_id,
      headers: options?.headers,
      metadata: {
        orderId: payload.order_id,
        statusCode: payload.status_code,
        transactionStatus: payload.transaction_status,
      },
    }).catch(() => undefined);

    throw new OrderDomainError(
      "INVALID_SIGNATURE",
      401,
      "Tanda tangan webhook Midtrans tidak sah."
    );
  }

  const order = await db.order.findUnique({
    where: { orderNumber: payload.order_id },
    select: { id: true, orderNumber: true, totalAmount: true, status: true },
  });

  if (!order) {
    throw new OrderDomainError(
      "ORDER_NOT_FOUND",
      404,
      `Pesanan ${payload.order_id} tidak ditemukan.`
    );
  }

  const parsedGross = Number(payload.gross_amount);
  if (
    !Number.isFinite(parsedGross) ||
    Math.round(parsedGross) !== order.totalAmount ||
    Math.abs(parsedGross - order.totalAmount) >= 0.01
  ) {
    await writeAuditLog({
      action: "PAYMENT_WEBHOOK_AMOUNT_MISMATCH",
      entity: "Order",
      entityId: order.id,
      headers: options?.headers,
      metadata: {
        orderNumber: order.orderNumber,
        expectedTotal: order.totalAmount,
        receivedGrossAmount: payload.gross_amount,
      },
    }).catch(() => undefined);

    throw new OrderDomainError(
      "GROSS_AMOUNT_MISMATCH",
      400,
      "Jumlah pembayaran gross_amount tidak cocok dengan total pesanan."
    );
  }

  const eventKey = `midtrans:${payload.order_id}:${payload.transaction_id ?? "tx"}:${payload.transaction_status}:${payload.status_code}:${payload.fraud_status ?? "none"}`;
  const now = options?.now ?? new Date();

  let txOutcome: {
    duplicate: boolean;
    status: OrderStatus;
    ticketsIssued: number;
    newlyPaid: boolean;
  };

  try {
    txOutcome = await db.$transaction(async (tx) => {
      const existingEvent = await tx.paymentEvent.findUnique({
        where: { eventKey },
        select: { id: true },
      });

      if (existingEvent) {
        const latest = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { status: true },
        });
        return {
          duplicate: true,
          status: latest.status,
          ticketsIssued: 0,
          newlyPaid: false,
        };
      }

      await tx.paymentEvent.create({
        data: {
          orderId: order.id,
          provider: "midtrans",
          eventKey,
          signatureValid: true,
          payload: rawBody as Prisma.InputJsonObject,
        },
      });

      await tx.$queryRaw`
        SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE
      `;

      const lockedOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true,
              ticket: true,
            },
          },
        },
      });

      const txStatus = payload.transaction_status.toLowerCase();
      const fraudStatus = (payload.fraud_status ?? "accept").toLowerCase();

      const isSettlement =
        txStatus === "settlement" ||
        (txStatus === "capture" && fraudStatus === "accept");
      const isExpired = txStatus === "expire";
      const isCancelledOrDenied =
        txStatus === "cancel" ||
        txStatus === "deny" ||
        (txStatus === "capture" && fraudStatus === "deny");

      if (isSettlement) {
        let issuedCount = 0;
        const wasAlreadyPaid = lockedOrder.status === OrderStatus.PAID;

        if (!wasAlreadyPaid) {
          await tx.order.update({
            where: { id: lockedOrder.id },
            data: {
              status: OrderStatus.PAID,
              paidAt: lockedOrder.paidAt ?? now,
              providerRef: payload.transaction_id ?? lockedOrder.providerRef,
            },
          });
        }

        for (const item of lockedOrder.items) {
          if (item.ticket) continue;

          const qrCreds = issueServerQrCredentials();
          let publicCode = generateReadableTicketCode(item.product.code);
          for (let attempt = 0; attempt < 5; attempt++) {
            const codeCollision = await tx.ticket.findUnique({
              where: { publicCode },
              select: { id: true },
            });
            if (!codeCollision) break;
            publicCode = generateReadableTicketCode(item.product.code);
          }

          await tx.ticket.create({
            data: {
              orderId: lockedOrder.id,
              orderItemId: item.id,
              productId: item.productId,
              publicCode,
              qrTokenHash: qrCreds.qrTokenHash,
              qrTokenCipher: qrCreds.qrTokenCipher,
              visitorName: lockedOrder.visitorName,
              visitorWhatsapp: lockedOrder.visitorWhatsapp,
              visitDate: lockedOrder.visitDate,
              admitCount: item.qty,
              status: TicketStatus.ACTIVE,
              issuedAt: now,
            },
          });
          issuedCount += 1;
        }

        return {
          duplicate: false,
          status: OrderStatus.PAID,
          ticketsIssued: issuedCount,
          newlyPaid: !wasAlreadyPaid || issuedCount > 0,
        };
      }

      if (isExpired && lockedOrder.status === OrderStatus.PENDING) {
        await tx.order.update({
          where: { id: lockedOrder.id },
          data: { status: OrderStatus.EXPIRED },
        });
        return {
          duplicate: false,
          status: OrderStatus.EXPIRED,
          ticketsIssued: 0,
          newlyPaid: false,
        };
      }

      if (isCancelledOrDenied && lockedOrder.status === OrderStatus.PENDING) {
        await tx.order.update({
          where: { id: lockedOrder.id },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: now,
          },
        });
        return {
          duplicate: false,
          status: OrderStatus.CANCELLED,
          ticketsIssued: 0,
          newlyPaid: false,
        };
      }

      return {
        duplicate: false,
        status: lockedOrder.status,
        ticketsIssued: 0,
        newlyPaid: false,
      };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const latest = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });
      return {
        ok: true,
        duplicate: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: latest.status,
        ticketsIssued: 0,
      };
    }
    throw err;
  }

  if (txOutcome.newlyPaid) {
    await writeAuditLog({
      action: "ORDER_PAID_WEBHOOK",
      entity: "Order",
      entityId: order.id,
      headers: options?.headers,
      metadata: {
        orderNumber: order.orderNumber,
        transactionId: payload.transaction_id ?? null,
        paymentType: payload.payment_type ?? null,
        ticketsIssued: txOutcome.ticketsIssued,
      },
    }).catch(() => undefined);

    if (!options?.skipDelivery) {
      await deliverOrderTicketsNotification(order.id).catch(() => undefined);
    }
  }

  return {
    ok: true,
    duplicate: txOutcome.duplicate,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: txOutcome.status,
    ticketsIssued: txOutcome.ticketsIssued,
  };
}

export async function simulateSettleOrder(params: {
  orderId: string;
  actorUserId: string;
  locale?: SupportedLocale;
}): Promise<SerializedOrderSummary> {
  const order = await db.order.findFirst({
    where: {
      OR: [{ id: params.orderId }, { orderNumber: params.orderId }],
    },
    include: { user: true },
  });

  if (!order) {
    throw new OrderDomainError("ORDER_NOT_FOUND", 404, "Pesanan tidak ditemukan.");
  }

  const actor = await db.user.findUnique({
    where: { id: params.actorUserId },
    select: { id: true, role: true },
  });

  if (
    order.userId !== params.actorUserId &&
    actor?.role !== Role.ADMIN &&
    actor?.role !== Role.SUPER_ADMIN
  ) {
    throw new OrderDomainError("FORBIDDEN", 403, "Akses ditolak untuk pesanan ini.");
  }

  if (order.status !== OrderStatus.PAID) {
    const txId = `sim_tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fakePayload = {
      order_id: order.orderNumber,
      transaction_status: "settlement",
      status_code: "200",
      gross_amount: `${order.totalAmount}.00`,
      signature_key: "simulated_signature",
      transaction_id: txId,
      fraud_status: "accept",
      payment_type: "qris_sandbox_simulation",
    };

    await processMidtransWebhook(fakePayload, {
      skipSignatureVerify: true,
    });
  }

  return getSerializedOrderForViewer({
    orderId: order.id,
    viewerId: params.actorUserId,
    viewerRole: actor?.role ?? Role.MEMBER,
    locale: params.locale ?? "id",
  });
}

export async function getSerializedOrderForViewer(params: {
  orderId: string;
  viewerId: string;
  viewerRole: Role;
  locale: SupportedLocale;
}): Promise<SerializedOrderSummary> {
  const order = await db.order.findFirst({
    where: {
      OR: [{ id: params.orderId }, { orderNumber: params.orderId }],
    },
    include: {
      items: {
        include: {
          product: true,
          ticket: {
            include: {
              gateScans: true,
              review: { select: { id: true } },
            },
          },
        },
      },
      refundRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new OrderDomainError(
      "ORDER_NOT_FOUND",
      404,
      params.locale === "en" ? "Order not found." : "Pesanan tidak ditemukan."
    );
  }

  const isAdmin =
    params.viewerRole === Role.ADMIN ||
    params.viewerRole === Role.SUPER_ADMIN;

  if (order.userId !== params.viewerId && !isAdmin) {
    throw new OrderDomainError(
      "FORBIDDEN",
      403,
      params.locale === "en"
        ? "You do not have permission to view this order."
        : "Anda tidak memiliki izin melihat pesanan ini."
    );
  }

  return serializeOrderRecord(order, params.locale);
}

export async function getMemberDashboardSnapshot(params: {
  userId: string;
  locale: SupportedLocale;
}): Promise<MemberDashboardSnapshot> {
  // Membersihkan arsip tiket terpakai/kedaluwarsa > 30 hari secara otomatis di latar belakang
  void cleanupArchivedTickets(30).catch(() => 0);

  const [ordersRaw, refundSetting] = await Promise.all([
    db.order.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: true,
            ticket: {
              include: {
                gateScans: true,
                review: { select: { id: true } },
              },
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
    }),
  ]);

  const now = new Date();
  const orders = await Promise.all(
    ordersRaw.map((o) => serializeOrderRecord(o, params.locale, now))
  );

  const walletTickets = orders
    .flatMap((o) => o.tickets)
    .sort((a, b) => {
      if (a.visitDateYmd !== b.visitDateYmd) {
        return b.visitDateYmd.localeCompare(a.visitDateYmd);
      }
      return b.issuedAtIso.localeCompare(a.issuedAtIso);
    });

  const refundMinHoursBeforeVisit = Math.max(
    0,
    Number.parseInt(refundSetting?.value ?? "24", 10) || 24
  );

  return {
    orders,
    walletTickets,
    paymentConfig: getPaymentProvider().getClientConfig(),
    whatsappIntegrationActive: getIntegrationFlags().whatsapp,
    refundMinHoursBeforeVisit,
  };
}

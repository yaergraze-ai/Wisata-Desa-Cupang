import { OrderStatus, TicketStatus } from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import {
  addDaysToYmd,
  getWibClockParts,
  parseTimeHhMmToMinutes,
  parseVisitDateToUtcDate,
} from "@/lib/datetime-wib";

export type QuoteBlockingCode =
  | "INVALID_DATE_FORMAT"
  | "PAST_DATE"
  | "OUTSIDE_BOOKING_WINDOW"
  | "ZERO_QTY"
  | "EXCEEDS_MAX_TICKETS"
  | "SAME_DAY_CUTOFF"
  | "INSUFFICIENT_QUOTA";

export interface QuoteDestinationQuota {
  id: string;
  slug: string;
  name: string;
  openTime: string;
  closeTime: string;
  capacity: number;
  used: number;
  remaining: number;
  requested: number;
  sufficient: boolean;
}

export interface QuoteLineItem {
  productId: string;
  code: string;
  name: string;
  tariffId: string;
  tariffVersion: number;
  qty: number;
  unitBase: number;
  unitParking: number;
  unitTotal: number;
  subtotal: number;
  consumesDestinations: string[];
}

export interface ServerOrderQuoteResult {
  visitDate: string;
  minVisitDate: string;
  maxVisitDate: string;
  maxTicketsPerOrder: number;
  bookingWindowDays: number;
  paymentWindowMinutes: number;
  sameDayCloseBufferMinutes: number;
  totalVisitors: number;
  baseSubtotal: number;
  parkingSubtotal: number;
  grandTotal: number;
  canCheckout: boolean;
  blockingCode: QuoteBlockingCode | null;
  cutoffDestinationName: string | null;
  cutoffTimeWib: string | null;
  insufficientDestination: {
    slug: string;
    name: string;
    remaining: number;
    requested: number;
  } | null;
  destinations: QuoteDestinationQuota[];
  lines: QuoteLineItem[];
}

function formatMinutesToHhMm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function evaluateDateAndCutoffRules(params: {
  visitDate: string;
  todayWib: string;
  bookingWindowDays: number;
  sameDayCloseBufferMinutes: number;
  currentWibMinutes: number;
  consumedDestinations: Array<{
    slug: string;
    name: string;
    closeTime: string;
  }>;
}): {
  blockingCode: QuoteBlockingCode | null;
  cutoffDestinationName: string | null;
  cutoffTimeWib: string | null;
  maxVisitDate: string;
} {
  const maxVisitDate = addDaysToYmd(params.todayWib, params.bookingWindowDays);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.visitDate)) {
    return {
      blockingCode: "INVALID_DATE_FORMAT",
      cutoffDestinationName: null,
      cutoffTimeWib: null,
      maxVisitDate,
    };
  }

  if (params.visitDate < params.todayWib) {
    return {
      blockingCode: "PAST_DATE",
      cutoffDestinationName: null,
      cutoffTimeWib: null,
      maxVisitDate,
    };
  }

  if (params.visitDate > maxVisitDate) {
    return {
      blockingCode: "OUTSIDE_BOOKING_WINDOW",
      cutoffDestinationName: null,
      cutoffTimeWib: null,
      maxVisitDate,
    };
  }

  if (params.visitDate === params.todayWib) {
    for (const dest of params.consumedDestinations) {
      const closeMin = parseTimeHhMmToMinutes(dest.closeTime);
      const cutoffMin = closeMin - params.sameDayCloseBufferMinutes;
      if (params.currentWibMinutes >= cutoffMin) {
        return {
          blockingCode: "SAME_DAY_CUTOFF",
          cutoffDestinationName: dest.name,
          cutoffTimeWib: formatMinutesToHhMm(cutoffMin),
          maxVisitDate,
        };
      }
    }
  }

  return {
    blockingCode: null,
    cutoffDestinationName: null,
    cutoffTimeWib: null,
    maxVisitDate,
  };
}

/**
 * Menghitung harga paket tiket, rincian retribusi parkir, batas pemesanan, dan sisa kuota tanggal terpilih di server (§5.1 & §5.2).
 */
export async function calculateServerOrderQuote(params: {
  visitDate: string;
  regulerQty: number;
  putihQty: number;
  locale: SupportedLocale;
  now?: Date;
}): Promise<ServerOrderQuoteResult> {
  const now = params.now ?? new Date();
  const clock = getWibClockParts(now);
  const todayWib = clock.dateStr;

  const safeRegulerQty = Math.max(0, Math.floor(params.regulerQty));
  const safePutihQty = Math.max(0, Math.floor(params.putihQty));

  const [destinationsRaw, productsRaw, settingsRaw] = await Promise.all([
    db.destination.findMany({
      where: { isActive: true },
      orderBy: { slug: "asc" },
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
    Number.parseInt(settingMap.get("sameDayCloseBufferMinutes") ?? "60", 10) || 60
  );

  const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(params.visitDate);
  const normalizedVisitDate = validFormat ? params.visitDate : todayWib;
  const targetUtcDate = parseVisitDateToUtcDate(normalizedVisitDate);

  const [dailyQuotas, activeOrders] = await Promise.all([
    db.dailyQuota.findMany({
      where: { date: targetUtcDate },
    }),
    db.order.findMany({
      where: {
        visitDate: targetUtcDate,
        OR: [
          {
            status: { in: [OrderStatus.PAID, OrderStatus.REFUND_REQUESTED] },
          },
          {
            status: OrderStatus.PENDING,
            expiresAt: { gt: now },
          },
        ],
      },
      include: {
        items: {
          include: {
            product: true,
            ticket: true,
          },
        },
      },
    }),
  ]);

  const usedBySlug = new Map<string, number>();
  for (const order of activeOrders) {
    for (const item of order.items) {
      if (
        order.status !== OrderStatus.PENDING &&
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

  const lines: QuoteLineItem[] = [];
  const requestedBySlug = new Map<string, number>();

  for (const prod of productsRaw) {
    const tariff = prod.tariffs[0];
    if (!tariff) continue;

    const qty =
      prod.code === "TIKET_PUTIH"
        ? safePutihQty
        : prod.code === "REGULER_BL"
          ? safeRegulerQty
          : 0;

    const unitBase = tariff.basePrice;
    const unitParking = tariff.parkingFee;
    const unitTotal = unitBase + unitParking;
    const subtotal = unitTotal * qty;

    lines.push({
      productId: prod.id,
      code: prod.code,
      name: params.locale === "en" ? prod.nameEn : prod.nameId,
      tariffId: tariff.id,
      tariffVersion: tariff.version,
      qty,
      unitBase,
      unitParking,
      unitTotal,
      subtotal,
      consumesDestinations: prod.consumesDestinations,
    });

    if (qty > 0) {
      for (const slug of prod.consumesDestinations) {
        requestedBySlug.set(slug, (requestedBySlug.get(slug) ?? 0) + qty);
      }
    }
  }

  const quotaByDestId = new Map(dailyQuotas.map((q) => [q.destinationId, q.capacity]));

  const destinations: QuoteDestinationQuota[] = destinationsRaw.map((dest) => {
    const capacity = quotaByDestId.get(dest.id) ?? dest.defaultCapacity;
    const used = usedBySlug.get(dest.slug) ?? 0;
    const remaining = Math.max(0, capacity - used);
    const requested = requestedBySlug.get(dest.slug) ?? 0;
    return {
      id: dest.id,
      slug: dest.slug,
      name: params.locale === "en" ? dest.nameEn : dest.nameId,
      openTime: dest.openTime,
      closeTime: dest.closeTime,
      capacity,
      used,
      remaining,
      requested,
      sufficient: requested <= remaining,
    };
  });

  const totalVisitors = lines.reduce((sum, l) => sum + l.qty, 0);
  const baseSubtotal = lines.reduce((sum, l) => sum + l.unitBase * l.qty, 0);
  const parkingSubtotal = lines.reduce((sum, l) => sum + l.unitParking * l.qty, 0);
  const grandTotal = lines.reduce((sum, l) => sum + l.subtotal, 0);

  const consumedDestinationsForCheck =
    totalVisitors > 0
      ? destinations.filter((d) => d.requested > 0)
      : destinations;

  const dateRule = evaluateDateAndCutoffRules({
    visitDate: params.visitDate,
    todayWib,
    bookingWindowDays,
    sameDayCloseBufferMinutes,
    currentWibMinutes: clock.minutesSinceMidnight,
    consumedDestinations: consumedDestinationsForCheck,
  });

  let blockingCode: QuoteBlockingCode | null = dateRule.blockingCode;
  let insufficientDestination: ServerOrderQuoteResult["insufficientDestination"] = null;

  if (!blockingCode) {
    if (totalVisitors === 0) {
      blockingCode = "ZERO_QTY";
    } else if (totalVisitors > maxTicketsPerOrder) {
      blockingCode = "EXCEEDS_MAX_TICKETS";
    } else {
      const shortage = destinations.find((d) => d.requested > d.remaining);
      if (shortage) {
        blockingCode = "INSUFFICIENT_QUOTA";
        insufficientDestination = {
          slug: shortage.slug,
          name: shortage.name,
          remaining: shortage.remaining,
          requested: shortage.requested,
        };
      }
    }
  }

  return {
    visitDate: normalizedVisitDate,
    minVisitDate: todayWib,
    maxVisitDate: dateRule.maxVisitDate,
    maxTicketsPerOrder,
    bookingWindowDays,
    paymentWindowMinutes,
    sameDayCloseBufferMinutes,
    totalVisitors,
    baseSubtotal,
    parkingSubtotal,
    grandTotal,
    canCheckout: blockingCode === null,
    blockingCode,
    cutoffDestinationName: dateRule.cutoffDestinationName,
    cutoffTimeWib: dateRule.cutoffTimeWib,
    insufficientDestination,
    destinations,
    lines,
  };
}

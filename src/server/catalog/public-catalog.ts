import "server-only";
import { OrderStatus, TicketStatus, type GateType } from "@prisma/client";
import { db } from "@/server/db";
import type { SupportedLocale } from "@/lib/currency";
import {
  getTodayWibDateString,
  parseVisitDateToUtcDate,
} from "@/lib/datetime-wib";

export interface PublicDestinationSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  elevationM: number;
  openTime: string;
  closeTime: string;
  capacityToday: number;
  remainingToday: number;
}

export interface PublicProductSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  tariffId: string;
  tariffVersion: number;
  basePrice: number;
  parkingFee: number;
  totalPrice: number;
  allowedGates: GateType[];
  consumesDestinations: string[];
}

export interface PublicTrailPointSummary {
  id: string;
  order: number;
  code: string;
  name: string;
  note: string;
  lat: number;
  lng: number;
  elevationM: number;
  distFromPrevM: number;
  minsFromPrev: number;
}

export interface PublicSlotMedia {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export async function getPublicCatalogData(locale: SupportedLocale) {
  const now = new Date();
  const todayYmd = getTodayWibDateString(now);
  const todayUtcDate = parseVisitDateToUtcDate(todayYmd);

  const [
    destinationsRaw,
    productsRaw,
    trailPointsRaw,
    mediaSlotsRaw,
    settingsRaw,
    dailyQuotasToday,
    activeOrdersToday,
  ] = await Promise.all([
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
    db.trailPoint.findMany({
      orderBy: { order: "asc" },
    }),
    db.mediaSlot.findMany({
      include: { asset: true },
    }),
    db.siteSetting.findMany(),
    db.dailyQuota.findMany({
      where: { date: todayUtcDate },
    }),
    db.order.findMany({
      where: {
        visitDate: todayUtcDate,
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

  // Hitung pemakaian kuota hari ini per slug destinasi sesuai rumus §5.2
  const usedByDestinationSlug = new Map<string, number>();
  for (const order of activeOrdersToday) {
    for (const item of order.items) {
      if (
        order.status !== OrderStatus.PENDING &&
        item.ticket &&
        item.ticket.status !== TicketStatus.ACTIVE
      ) {
        continue;
      }
      for (const destSlug of item.product.consumesDestinations) {
        usedByDestinationSlug.set(
          destSlug,
          (usedByDestinationSlug.get(destSlug) ?? 0) + item.qty
        );
      }
    }
  }

  const quotaByDestId = new Map(
    dailyQuotasToday.map((q) => [q.destinationId, q.capacity])
  );

  const destinations: PublicDestinationSummary[] = destinationsRaw.map((d) => {
    const capacityToday = quotaByDestId.get(d.id) ?? d.defaultCapacity;
    const used = usedByDestinationSlug.get(d.slug) ?? 0;
    return {
      id: d.id,
      slug: d.slug,
      name: locale === "en" ? d.nameEn : d.nameId,
      description: locale === "en" ? d.descriptionEn : d.descriptionId,
      lat: d.lat,
      lng: d.lng,
      elevationM: d.elevationM,
      openTime: d.openTime,
      closeTime: d.closeTime,
      capacityToday,
      remainingToday: Math.max(0, capacityToday - used),
    };
  });

  const products: PublicProductSummary[] = productsRaw
    .filter((p) => p.tariffs.length > 0)
    .map((p) => {
      const tariff = p.tariffs[0]!;
      return {
        id: p.id,
        code: p.code,
        name: locale === "en" ? p.nameEn : p.nameId,
        description: locale === "en" ? p.descriptionEn : p.descriptionId,
        tariffId: tariff.id,
        tariffVersion: tariff.version,
        basePrice: tariff.basePrice,
        parkingFee: tariff.parkingFee,
        totalPrice: tariff.basePrice + tariff.parkingFee,
        allowedGates: p.allowedGates,
        consumesDestinations: p.consumesDestinations,
      };
    });

  const trailPoints: PublicTrailPointSummary[] = trailPointsRaw.map((pt) => ({
    id: pt.id,
    order: pt.order,
    code: pt.code,
    name: locale === "en" ? pt.nameEn : pt.nameId,
    note: locale === "en" ? pt.noteEn : pt.noteId,
    lat: pt.lat,
    lng: pt.lng,
    elevationM: pt.elevationM,
    distFromPrevM: pt.distFromPrevM,
    minsFromPrev: pt.minsFromPrev,
  }));

  const mediaSlots: Record<string, PublicSlotMedia> = {};
  for (const ms of mediaSlotsRaw) {
    mediaSlots[ms.slot] = {
      url: ms.asset.storageKey.startsWith("/")
        ? ms.asset.storageKey
        : `/api/media/${ms.asset.id}`,
      alt: locale === "en" ? ms.asset.altEn : ms.asset.altId,
      width: ms.asset.width,
      height: ms.asset.height,
    };
  }

  const settings = Object.fromEntries(settingsRaw.map((s) => [s.key, s.value]));

  return {
    todayYmd,
    destinations,
    products,
    trailPoints,
    mediaSlots,
    settings,
  };
}

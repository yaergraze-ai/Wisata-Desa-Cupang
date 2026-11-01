import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";

export interface MonthlyQuotaItem {
  date: string;
  maxQuota: number;
  usedQuota: number;
  availableQuota: number;
}

export async function getMonthlyQuotaData(year: number, month: number): Promise<MonthlyQuotaItem[]> {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const daysInMonth = endDate.getUTCDate();
  const dateStrings: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dateStrings.push(dayStr);
  }

  // Ambil kuota override dari DB
  const dbQuotas = await db.dailyQuota.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const quotaMap = new Map<string, number>();
  for (const q of dbQuotas) {
    quotaMap.set(q.date.toISOString().slice(0, 10), q.capacity);
  }

  // Hitung tiket terjual (PAID & REFUND_REQUESTED) per hari
  const paidOrders = await db.order.findMany({
    where: {
      visitDate: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ["PAID", "REFUND_REQUESTED"] },
    },
    select: {
      visitDate: true,
      items: { select: { qty: true } },
    },
  });

  const usedMap = new Map<string, number>();
  for (const o of paidOrders) {
    const k = o.visitDate.toISOString().slice(0, 10);
    const sumQty = o.items.reduce((s, it) => s + it.qty, 0);
    usedMap.set(k, (usedMap.get(k) ?? 0) + sumQty);
  }

  return dateStrings.map((dayStr) => {
    const maxQuota = quotaMap.get(dayStr) ?? 1000; // default 1000 tiket per hari
    const usedQuota = usedMap.get(dayStr) ?? 0;
    const availableQuota = Math.max(0, maxQuota - usedQuota);
    return {
      date: dayStr,
      maxQuota,
      usedQuota,
      availableQuota,
    };
  });
}

export async function upsertDailyQuota(
  dateYmd: string,
  maxQuota: number,
  actorId: string
): Promise<void> {
  if (maxQuota < 10 || maxQuota > 50000) {
    throw new Error("Kapasitas kuota harian harus antara 10 hingga 50.000 tiket.");
  }

  const dest = await db.destination.findFirst();
  if (!dest) {
    throw new Error("Destinasi belum dikonfigurasi.");
  }

  const targetDate = new Date(`${dateYmd}T00:00:00.000Z`);

  await db.dailyQuota.upsert({
    where: {
      date_destinationId: {
        date: targetDate,
        destinationId: dest.id,
      },
    },
    create: {
      date: targetDate,
      destinationId: dest.id,
      capacity: maxQuota,
      isCustom: true,
    },
    update: {
      capacity: maxQuota,
      isCustom: true,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "DAILY_QUOTA_UPDATED",
    entity: "DailyQuota",
    entityId: dateYmd,
    metadata: {
      date: dateYmd,
      maxQuota,
    },
  });
}

export interface ProductTariffDto {
  productId: string;
  productCode: string;
  productName: string;
  tariffs: {
    id: string;
    version: number;
    basePrice: number;
    parkingFee: number;
    totalPrice: number;
    validFrom: string;
    createdAt: string;
  }[];
}

export async function getVersionedTariffsList(): Promise<ProductTariffDto[]> {
  const products = await db.ticketProduct.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      tariffs: {
        orderBy: { version: "desc" },
      },
    },
  });

  return products.map((p) => ({
    productId: p.id,
    productCode: p.code,
    productName: p.nameId,
    tariffs: p.tariffs.map((t) => ({
      id: t.id,
      version: t.version,
      basePrice: t.basePrice,
      parkingFee: t.parkingFee,
      totalPrice: t.basePrice + t.parkingFee,
      validFrom: t.effectiveFrom.toISOString().slice(0, 10),
      createdAt: t.createdAt.toISOString(),
    })),
  }));
}

export async function createNewTariffVersion(
  productId: string,
  basePrice: number,
  parkingFee: number,
  validFromYmd: string,
  actorId: string
): Promise<void> {
  const product = await db.ticketProduct.findUnique({
    where: { id: productId },
    include: {
      tariffs: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!product) {
    throw new Error("Produk tiket tidak ditemukan.");
  }

  const latestVersion = product.tariffs[0]?.version ?? 0;
  const nextVersion = latestVersion + 1;

  const validFrom = new Date(`${validFromYmd}T00:00:00.000Z`);

  await db.ticketTariff.create({
    data: {
      productId,
      version: nextVersion,
      basePrice,
      parkingFee,
      effectiveFrom: validFrom,
      createdById: actorId,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "TARIFF_VERSION_CREATED",
    entity: "TicketTariff",
    entityId: productId,
    metadata: {
      productCode: product.code,
      version: nextVersion,
      basePrice,
      parkingFee,
      validFrom: validFromYmd,
    },
  });
}

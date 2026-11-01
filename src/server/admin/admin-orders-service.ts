import { OrderStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";

export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SerializedAdminOrder {
  id: string;
  orderNumber: string;
  userId: string;
  visitorName: string;
  visitorWhatsapp: string;
  visitDate: string;
  status: OrderStatus;
  totalAmount: number;
  provider: string;
  paymentRef: string | null;
  paidAt: string | null;
  createdAt: string;
  ticketsCount: number;
  tickets: {
    id: string;
    publicCode: string;
    productName: string;
    productCode: string;
    status: string;
    admitCount: number;
    scansCount: number;
  }[];
}

export async function getAdminOrdersList(query: AdminOrdersQuery): Promise<{
  orders: SerializedAdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 15));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};

  if (query.status) {
    whereClause.status = query.status;
  }

  if (query.search?.trim()) {
    const s = query.search.trim();
    whereClause.OR = [
      { orderNumber: { contains: s, mode: "insensitive" } },
      { visitorName: { contains: s, mode: "insensitive" } },
      { visitorWhatsapp: { contains: s, mode: "insensitive" } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    const visitDateFilter: Record<string, Date> = {};
    if (query.dateFrom) visitDateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) visitDateFilter.lte = new Date(query.dateTo);
    whereClause.visitDate = visitDateFilter;
  }

  const [total, rawOrders] = await Promise.all([
    db.order.count({ where: whereClause }),
    db.order.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        tickets: {
          include: {
            product: { select: { nameId: true, code: true } },
            gateScans: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  const orders: SerializedAdminOrder[] = rawOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    userId: o.userId,
    visitorName: o.visitorName,
    visitorWhatsapp: o.visitorWhatsapp,
    visitDate: o.visitDate.toISOString().slice(0, 10),
    status: o.status,
    totalAmount: o.totalAmount,
    provider: o.provider,
    paymentRef: o.providerRef ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    ticketsCount: o.tickets.length,
    tickets: o.tickets.map((t) => ({
      id: t.id,
      publicCode: t.publicCode,
      productName: t.product.nameId,
      productCode: t.product.code,
      status: t.status,
      admitCount: t.admitCount,
      scansCount: t.gateScans.length,
    })),
  }));

  return {
    orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function exportOrdersToCsv(query: AdminOrdersQuery): Promise<string> {
  const whereClause: Record<string, unknown> = {};
  if (query.status) whereClause.status = query.status;
  if (query.search?.trim()) {
    const s = query.search.trim();
    whereClause.OR = [
      { orderNumber: { contains: s, mode: "insensitive" } },
      { visitorName: { contains: s, mode: "insensitive" } },
      { visitorWhatsapp: { contains: s, mode: "insensitive" } },
    ];
  }

  const orders = await db.order.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      tickets: true,
    },
  });

  const header = [
    "No. Pesanan",
    "Tanggal Kunjungan",
    "Nama Pengunjung",
    "WhatsApp",
    "Status",
    "Total (Rp)",
    "Metode Pembayaran",
    "Tanggal Bayar",
    "Jumlah Tiket",
    "Tanggal Dibuat",
  ];

  const rows = orders.map((o) => [
    `"${o.orderNumber}"`,
    `"${o.visitDate.toISOString().slice(0, 10)}"`,
    `"${o.visitorName.replace(/"/g, '""')}"`,
    `"${o.visitorWhatsapp}"`,
    `"${o.status}"`,
    o.totalAmount,
    `"${o.provider}"`,
    o.paidAt ? `"${o.paidAt.toISOString()}"` : `""`,
    o.tickets.length,
    `"${o.createdAt.toISOString()}"`,
  ]);

  // BOM UTF-8 (\uFEFF) untuk kompatibilitas Microsoft Excel bahasa Indonesia
  return "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export async function cancelPendingOrder(
  orderId: string,
  actorId: string,
  reason: string
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Pesanan tidak ditemukan.");
  }
  if (order.status !== OrderStatus.PENDING) {
    throw new Error("Hanya pesanan berstatus PENDING yang dapat dibatalkan manual.");
  }

  await db.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.ADMIN,
    action: "ORDER_CANCELLED_MANUAL",
    entity: "Order",
    entityId: orderId,
    metadata: {
      orderNumber: order.orderNumber,
      reason,
    },
  });
}

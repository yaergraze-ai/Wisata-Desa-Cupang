import { GateType, OrderStatus, RefundStatus, ReviewStatus, ScanResult, TicketStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getTodayWibDateString } from "@/lib/datetime-wib";

export interface SalesDayMetric {
  date: string;
  revenue: number;
  ticketsCount: number;
}

export interface AdminMetricsSnapshot {
  totalRevenue: number;
  paidOrdersCount: number;
  validTicketsCount: number;
  scansTodayCount: number;
  scansByGate: Record<GateType, number>;
  pendingRefundsCount: number;
  pendingReviewsCount: number;
  sales7Days: SalesDayMetric[];
  recentOrders: {
    id: string;
    orderNumber: string;
    visitorName: string;
    visitorWhatsapp: string;
    totalAmount: number;
    status: OrderStatus;
    visitDate: string;
    createdAt: string;
  }[];
}

export async function getAdminDashboardMetrics(): Promise<AdminMetricsSnapshot> {
  const todayYmd = getTodayWibDateString();
  const startOfTodayUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);

  const [
    revenueAgg,
    paidOrdersCount,
    validTicketsCount,
    scansToday,
    pendingRefundsCount,
    pendingReviewsCount,
    recentOrdersDb,
  ] = await Promise.all([
    db.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: OrderStatus.PAID },
    }),
    db.order.count({
      where: { status: OrderStatus.PAID },
    }),
    db.ticket.count({
      where: { status: TicketStatus.ACTIVE },
    }),
    db.gateScan.findMany({
      where: {
        result: ScanResult.ACCEPTED,
        scannedAt: { gte: startOfTodayUtc },
      },
      select: { gate: true },
    }),
    db.refundRequest.count({
      where: { status: RefundStatus.PENDING },
    }),
    db.review.count({
      where: { status: ReviewStatus.HIDDEN },
    }),
    db.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        visitorName: true,
        visitorWhatsapp: true,
        totalAmount: true,
        status: true,
        visitDate: true,
        createdAt: true,
      },
    }),
  ]);

  const scansByGate: Record<GateType, number> = {
    GERBANG_BATU_LAWANG: 0,
    PINTU_GUNUNG_BENDERA: 0,
  };
  for (const s of scansToday) {
    if (s.gate in scansByGate) {
      scansByGate[s.gate]++;
    }
  }

  // Hitung tren penjualan 7 hari terakhir
  const sales7Days: SalesDayMetric[] = [];
  const baseDate = new Date(`${todayYmd}T00:00:00.000Z`);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayStart = new Date(`${dayStr}T00:00:00.000+07:00`);
    const dayEnd = new Date(`${dayStr}T23:59:59.999+07:00`);

    const dayOrders = await db.order.findMany({
      where: {
        status: OrderStatus.PAID,
        paidAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        totalAmount: true,
        items: { select: { qty: true } },
      },
    });

    const dayRev = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const dayTickets = dayOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0),
      0
    );

    sales7Days.push({
      date: dayStr,
      revenue: dayRev,
      ticketsCount: dayTickets,
    });
  }

  return {
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    paidOrdersCount,
    validTicketsCount,
    scansTodayCount: scansToday.length,
    scansByGate,
    pendingRefundsCount,
    pendingReviewsCount,
    sales7Days,
    recentOrders: recentOrdersDb.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      visitorName: o.visitorName,
      visitorWhatsapp: o.visitorWhatsapp,
      totalAmount: o.totalAmount,
      status: o.status,
      visitDate: o.visitDate.toISOString().slice(0, 10),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

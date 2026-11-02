import { GateType, OrderStatus, RefundStatus, ReviewStatus, ScanResult, TicketStatus } from "@prisma/client";
import { db } from "@/server/db";
import { getTodayWibDateString } from "@/lib/datetime-wib";

export interface SalesDayMetric {
  date: string;
  revenue: number;
  ticketsCount: number;
}

export interface SalesPeriodMetric {
  periodKey: string;
  label: string;
  revenue: number;
  ticketsCount: number;
  scansCount: number;
}

export interface AdminAnalyticsData {
  daily: SalesPeriodMetric[];
  weekly: SalesPeriodMetric[];
  monthly: SalesPeriodMetric[];
  yearly: SalesPeriodMetric[];
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
  analytics: AdminAnalyticsData;
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

const MONTH_NAMES_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export async function getAdminDashboardMetrics(): Promise<AdminMetricsSnapshot> {
  const todayYmd = getTodayWibDateString();
  const startOfTodayUtc = new Date(`${todayYmd}T00:00:00.000+07:00`);
  const fourYearsAgoUtc = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);

  const [
    revenueAgg,
    paidOrdersCount,
    validTicketsCount,
    scansToday,
    pendingRefundsCount,
    pendingReviewsCount,
    recentOrdersDb,
    paidOrdersHistory,
    gateScansHistory,
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
    db.order.findMany({
      where: {
        status: OrderStatus.PAID,
        paidAt: { gte: fourYearsAgoUtc },
      },
      select: {
        id: true,
        totalAmount: true,
        paidAt: true,
        items: { select: { qty: true } },
      },
    }),
    db.gateScan.findMany({
      where: {
        result: ScanResult.ACCEPTED,
        scannedAt: { gte: fourYearsAgoUtc },
      },
      select: {
        scannedAt: true,
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

  // Siapkan data transaksi ternormalisasi dalam WIB
  const normalizedOrders = paidOrdersHistory.map((o) => {
    const paidDate = o.paidAt ?? new Date();
    // Konversi timestamp ke WIB string YYYY-MM-DD
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(paidDate);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    const ymd = `${y}-${m}-${d}`;
    const tickets = o.items.reduce((sum, it) => sum + it.qty, 0);
    return {
      ymd,
      year: Number(y),
      month: Number(m),
      day: Number(d),
      timestamp: paidDate.getTime(),
      amount: o.totalAmount,
      tickets,
    };
  });

  const normalizedScans = gateScansHistory.map((s) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(s.scannedAt);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return {
      ymd: `${y}-${m}-${d}`,
      year: Number(y),
      month: Number(m),
      timestamp: s.scannedAt.getTime(),
    };
  });

  const nowWib = new Date();
  const baseDate = new Date(`${todayYmd}T00:00:00.000Z`);

  // 1. HARIAN (14 Hari Terakhir)
  const daily: SalesPeriodMetric[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    const day = d.getUTCDate();
    const month = MONTH_NAMES_ID[d.getUTCMonth()] ?? "";
    const label = `${String(day).padStart(2, "0")} ${month}`;

    const matchOrders = normalizedOrders.filter((o) => o.ymd === ymd);
    const matchScans = normalizedScans.filter((s) => s.ymd === ymd);

    const rev = matchOrders.reduce((sum, o) => sum + o.amount, 0);
    const tix = matchOrders.reduce((sum, o) => sum + o.tickets, 0);

    daily.push({
      periodKey: ymd,
      label,
      revenue: rev,
      ticketsCount: tix,
      scansCount: matchScans.length,
    });
  }

  // 2. MINGGUAN (8 Minggu Terakhir)
  const weekly: SalesPeriodMetric[] = [];
  for (let w = 7; w >= 0; w--) {
    const endOffset = w * 7;
    const startOffset = endOffset + 6;

    const startD = new Date(baseDate);
    startD.setUTCDate(startD.getUTCDate() - startOffset);
    const endD = new Date(baseDate);
    endD.setUTCDate(endD.getUTCDate() - endOffset);

    const startYmd = startD.toISOString().slice(0, 10);
    const endYmd = endD.toISOString().slice(0, 10);

    const startLabel = `${startD.getUTCDate()} ${MONTH_NAMES_ID[startD.getUTCMonth()]}`;
    const endLabel = `${endD.getUTCDate()} ${MONTH_NAMES_ID[endD.getUTCMonth()]}`;
    const label = `${startLabel} - ${endLabel}`;

    const matchOrders = normalizedOrders.filter(
      (o) => o.ymd >= startYmd && o.ymd <= endYmd
    );
    const matchScans = normalizedScans.filter(
      (s) => s.ymd >= startYmd && s.ymd <= endYmd
    );

    const rev = matchOrders.reduce((sum, o) => sum + o.amount, 0);
    const tix = matchOrders.reduce((sum, o) => sum + o.tickets, 0);

    weekly.push({
      periodKey: `W${7 - w + 1}-${startYmd}`,
      label: w === 0 ? `Minggu Ini (${label})` : label,
      revenue: rev,
      ticketsCount: tix,
      scansCount: matchScans.length,
    });
  }

  // 3. BULANAN (12 Bulan Terakhir)
  const monthly: SalesPeriodMetric[] = [];
  const curYear = nowWib.getFullYear();
  const curMonthIndex = nowWib.getMonth(); // 0..11

  for (let m = 11; m >= 0; m--) {
    const targetDate = new Date(curYear, curMonthIndex - m, 1);
    const y = targetDate.getFullYear();
    const mo = targetDate.getMonth() + 1;
    const periodKey = `${y}-${String(mo).padStart(2, "0")}`;
    const label = `${MONTH_NAMES_ID[targetDate.getMonth()]} ${y}`;

    const matchOrders = normalizedOrders.filter(
      (o) => o.year === y && o.month === mo
    );
    const matchScans = normalizedScans.filter(
      (s) => s.year === y && s.month === mo
    );

    const rev = matchOrders.reduce((sum, o) => sum + o.amount, 0);
    const tix = matchOrders.reduce((sum, o) => sum + o.tickets, 0);

    monthly.push({
      periodKey,
      label,
      revenue: rev,
      ticketsCount: tix,
      scansCount: matchScans.length,
    });
  }

  // 4. TAHUNAN (4 Tahun Terakhir)
  const yearly: SalesPeriodMetric[] = [];
  for (let yOffset = 3; yOffset >= 0; yOffset--) {
    const yr = curYear - yOffset;
    const periodKey = String(yr);
    const label = `Tahun ${yr}`;

    const matchOrders = normalizedOrders.filter((o) => o.year === yr);
    const matchScans = normalizedScans.filter((s) => s.year === yr);

    const rev = matchOrders.reduce((sum, o) => sum + o.amount, 0);
    const tix = matchOrders.reduce((sum, o) => sum + o.tickets, 0);

    yearly.push({
      periodKey,
      label,
      revenue: rev,
      ticketsCount: tix,
      scansCount: matchScans.length,
    });
  }

  // Untuk kompatibilitas mundur
  const sales7Days = daily.slice(-7).map((d) => ({
    date: d.periodKey,
    revenue: d.revenue,
    ticketsCount: d.ticketsCount,
  }));

  return {
    totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    paidOrdersCount,
    validTicketsCount,
    scansTodayCount: scansToday.length,
    scansByGate,
    pendingRefundsCount,
    pendingReviewsCount,
    sales7Days,
    analytics: {
      daily,
      weekly,
      monthly,
      yearly,
    },
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

import { NextRequest, NextResponse } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  exportOrdersToCsv,
  getAdminOrdersList,
} from "@/server/admin/admin-orders-service";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "15");
    const status = sp.get("status") as OrderStatus | undefined;
    const search = sp.get("search") ?? undefined;
    const dateFrom = sp.get("dateFrom") ?? undefined;
    const dateTo = sp.get("dateTo") ?? undefined;

    const data = await getAdminOrdersList({
      page,
      limit,
      status,
      search,
      dateFrom,
      dateTo,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat daftar pesanan.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json().catch(() => ({}))) as {
      status?: OrderStatus;
      search?: string;
    };

    const csvData = await exportOrdersToCsv({
      status: body.status,
      search: body.search,
    });

    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pesanan-wisata-cirebon-${Date.now()}.csv"`,
      },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal mengekspor pesanan ke CSV.";
    return NextResponse.json({ error: message }, { status });
  }
}

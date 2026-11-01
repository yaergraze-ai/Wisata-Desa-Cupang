import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  exportAuditLogsCsv,
  getAuditLogsList,
} from "@/server/super-admin/audit-log-service";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "20");
    const action = sp.get("action") ?? undefined;
    const actorId = sp.get("actorId") ?? undefined;
    const dateFrom = sp.get("dateFrom") ?? undefined;
    const dateTo = sp.get("dateTo") ?? undefined;

    const data = await getAuditLogsList({
      page,
      limit,
      action,
      actorId,
      dateFrom,
      dateTo,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat log audit.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      actorId?: string;
    };

    const csvData = await exportAuditLogsCsv({
      action: body.action,
      actorId: body.actorId,
    });

    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-wisata-cirebon-${Date.now()}.csv"`,
      },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal mengekspor log audit ke CSV.";
    return NextResponse.json({ error: message }, { status });
  }
}

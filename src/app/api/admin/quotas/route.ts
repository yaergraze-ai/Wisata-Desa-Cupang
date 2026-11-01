import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getMonthlyQuotaData,
  upsertDailyQuota,
} from "@/server/admin/admin-quota-tariffs-service";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const sp = req.nextUrl.searchParams;
    const now = new Date();
    const year = Number(sp.get("year") ?? now.getUTCFullYear());
    const month = Number(sp.get("month") ?? now.getUTCMonth() + 1);

    const quotas = await getMonthlyQuotaData(year, month);
    return NextResponse.json({ quotas });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat kalender kuota.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { date: string; maxQuota: number };
    if (!body.date || typeof body.maxQuota !== "number") {
      return NextResponse.json(
        { error: "Tanggal dan kapasitas kuota wajib diisi." },
        { status: 400 }
      );
    }

    await upsertDailyQuota(body.date, body.maxQuota, authCtx.user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal menyimpan kuota harian.";
    return NextResponse.json({ error: message }, { status });
  }
}

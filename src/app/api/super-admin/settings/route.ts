import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getAllSiteSettingsList,
  updateSiteSettingByKey,
} from "@/server/super-admin/site-settings-service";

export async function GET() {
  try {
    await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const settings = await getAllSiteSettingsList();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat pengaturan sistem.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { key: string; value: string };
    if (!body.key?.trim() || body.value === undefined) {
      return NextResponse.json(
        { error: "Kunci dan nilai pengaturan wajib disertakan." },
        { status: 400 }
      );
    }

    await updateSiteSettingByKey(body.key, String(body.value), authCtx.user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui pengaturan sistem.";
    return NextResponse.json({ error: message }, { status });
  }
}

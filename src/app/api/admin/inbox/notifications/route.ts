import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getAdminNotificationsList,
  markNotificationAsRead,
} from "@/server/admin/admin-inbox-service";

export async function GET() {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const notifications = await getAdminNotificationsList(authCtx.user.id);
    return NextResponse.json({ notifications });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat notifikasi.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { notificationId: string };
    if (!body.notificationId) {
      return NextResponse.json(
        { error: "notificationId wajib disertakan." },
        { status: 400 }
      );
    }

    await markNotificationAsRead(body.notificationId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui notifikasi.";
    return NextResponse.json({ error: message }, { status });
  }
}

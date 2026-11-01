import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getContactMessagesList,
  markContactMessageAsRead,
  replyToContactMessage,
} from "@/server/admin/admin-inbox-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const messages = await getContactMessagesList();
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat pesan kontak.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { messageId: string };
    if (!body.messageId) {
      return NextResponse.json(
        { error: "messageId wajib disertakan." },
        { status: 400 }
      );
    }

    await markContactMessageAsRead(body.messageId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui status pesan.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { messageId: string; replyText: string };
    if (!body.messageId || !body.replyText?.trim()) {
      return NextResponse.json(
        { error: "messageId dan replyText wajib disertakan." },
        { status: 400 }
      );
    }

    await replyToContactMessage(body.messageId, body.replyText, authCtx.user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal membalas pesan kontak.";
    return NextResponse.json({ error: message }, { status });
  }
}

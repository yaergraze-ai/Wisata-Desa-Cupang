import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  decideLeaveRequest,
  getLeaveRequestsList,
} from "@/server/admin/admin-staff-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const requests = await getLeaveRequestsList();
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat pengajuan libur.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      leaveRequestId: string;
      status: "APPROVED" | "REJECTED";
    };

    if (!body.leaveRequestId || !body.status) {
      return NextResponse.json(
        { error: "leaveRequestId dan status wajib disertakan." },
        { status: 400 }
      );
    }

    await decideLeaveRequest(body.leaveRequestId, body.status, authCtx.user.id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memproses pengajuan libur.";
    return NextResponse.json({ error: message }, { status });
  }
}

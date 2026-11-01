import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  exportUserDataJson,
  ProfileServiceError,
} from "@/server/user/profile-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const data = await exportUserDataJson(auth.user.id);
    const filename = `wisata-cirebon-data-pribadi-${auth.user.id.slice(-6)}-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    if (err instanceof ProfileServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Gagal mengekspor data pribadi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

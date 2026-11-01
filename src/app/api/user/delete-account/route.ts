import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  anonymizeAndDeleteUserAccount,
  ProfileServiceError,
} from "@/server/user/profile-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const body = (await req.json()) as { currentPassword?: string };
    if (!body.currentPassword || typeof body.currentPassword !== "string") {
      return NextResponse.json(
        { error: "Kata sandi wajib diisi untuk mengonfirmasi penghapusan akun." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    await anonymizeAndDeleteUserAccount(auth.user.id, body.currentPassword, {
      ip,
      userAgent,
    });

    const res = NextResponse.json({
      success: true,
      message:
        "Akun Anda telah dianonimisasi dan dihapus sesuai ketentuan UU PDP.",
    });

    // Clear session cookies
    res.cookies.set("better-auth.session_token", "", {
      maxAge: 0,
      path: "/",
    });

    return res;
  } catch (err: unknown) {
    if (err instanceof ProfileServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Gagal menghapus akun.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

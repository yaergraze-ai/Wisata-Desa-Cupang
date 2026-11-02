import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  updateMemberProfile,
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

    const body = (await req.json()) as {
      name?: string;
      whatsapp?: string;
      bio?: string;
      nik?: string;
      address?: string;
      province?: string;
      city?: string;
      district?: string;
      postalCode?: string;
      emergencyContact?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await updateMemberProfile(auth.user.id, body, {
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Profil Anda berhasil diperbarui.",
      user: result,
    });
  } catch (err: unknown) {
    if (err instanceof ProfileServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui profil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

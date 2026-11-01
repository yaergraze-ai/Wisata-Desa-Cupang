import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  forceRevokeUserSessions,
  getSuperAdminUsersList,
  updateUserRoleWithLastAdminGuard,
  superAdminDeleteUser,
  superAdminUpdateUserProfile,
} from "@/server/super-admin/user-roles-service";

export async function GET(req: NextRequest) {
  try {
    await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "15");
    const role = (sp.get("role") as Role) || undefined;
    const search = sp.get("search") ?? undefined;

    const data = await getSuperAdminUsersList({
      page,
      limit,
      role,
      search,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat pengguna.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { targetUserId: string; newRole: Role };
    if (!body.targetUserId || !body.newRole) {
      return NextResponse.json(
        { error: "targetUserId dan newRole wajib disertakan." },
        { status: 400 }
      );
    }

    await updateUserRoleWithLastAdminGuard(
      body.targetUserId,
      body.newRole,
      authCtx.user.id
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui peran pengguna.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      targetUserId: string;
      name?: string;
      email?: string;
      whatsapp?: string;
      role?: Role;
    };

    if (!body.targetUserId) {
      return NextResponse.json(
        { error: "targetUserId wajib disertakan." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const updated = await superAdminUpdateUserProfile(
      body.targetUserId,
      {
        name: body.name,
        email: body.email,
        whatsapp: body.whatsapp,
        role: body.role,
      },
      authCtx.user.id,
      { ip, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: "Profil pengguna berhasil diperbarui.",
      user: updated,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui profil pengguna.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { targetUserId: string };
    if (!body.targetUserId) {
      return NextResponse.json(
        { error: "targetUserId wajib disertakan." },
        { status: 400 }
      );
    }

    const res = await forceRevokeUserSessions(body.targetUserId, authCtx.user.id);
    return NextResponse.json({ success: true, ...res });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal mencabut sesi pengguna.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as { targetUserId: string };
    if (!body.targetUserId) {
      return NextResponse.json(
        { error: "targetUserId wajib disertakan." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const res = await superAdminDeleteUser(body.targetUserId, authCtx.user.id, {
      ip,
      userAgent,
    });

    return NextResponse.json(res);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal menghapus akun pengguna.";
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GateType, Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  createStaffAccount,
  getStaffList,
  updateStaffProfile,
  deleteStaffMember,
} from "@/server/admin/admin-staff-service";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });
    const staff = await getStaffList();
    return NextResponse.json({ staff });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memuat daftar staf.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      name: string;
      email: string;
      whatsapp: string;
      password: string;
      assignedGates: GateType[];
      isMinor: boolean;
      emergencyNotes?: string;
    };

    if (
      !body.name?.trim() ||
      !body.email?.trim() ||
      !body.whatsapp?.trim() ||
      !body.password ||
      !Array.isArray(body.assignedGates)
    ) {
      return NextResponse.json(
        { error: "Data pendaftaran petugas tidak lengkap." },
        { status: 400 }
      );
    }

    const created = await createStaffAccount(body, authCtx.user.id);
    return NextResponse.json({ success: true, ...created });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal mendaftarkan staf baru.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json()) as {
      staffProfileId: string;
      name?: string;
      whatsapp?: string;
      assignedGates?: GateType[];
      isMinor?: boolean;
      isActive?: boolean;
    };

    if (!body.staffProfileId) {
      return NextResponse.json(
        { error: "staffProfileId wajib disertakan." },
        { status: 400 }
      );
    }

    await updateStaffProfile(
      body.staffProfileId,
      {
        name: body.name,
        whatsapp: body.whatsapp,
        assignedGates: body.assignedGates,
        isMinor: body.isMinor,
        isActive: body.isActive,
      },
      authCtx.user.id
    );

    return NextResponse.json({ success: true, message: "Profil staf berhasil diperbarui." });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal memperbarui profil staf.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const authCtx = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN], {
      requireTwoFactor: false,
    });

    const body = (await req.json().catch(() => ({}))) as { staffProfileId?: string };
    const urlStaffId = req.nextUrl.searchParams.get("staffProfileId");
    const staffProfileId = body.staffProfileId || urlStaffId;

    if (!staffProfileId) {
      return NextResponse.json(
        { error: "staffProfileId wajib disertakan." },
        { status: 400 }
      );
    }

    await deleteStaffMember(staffProfileId, authCtx.user.id);
    return NextResponse.json({ success: true, message: "Akun staf berhasil dihapus." });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Gagal menghapus akun staf.";
    return NextResponse.json({ error: message }, { status });
  }
}

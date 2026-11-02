import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const companions = await db.companionProfile.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, companions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat profil rekan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

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
      identityNumber?: string;
      phone?: string;
      relation?: string;
      age?: number;
      notes?: string;
    };

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json(
        { error: "Nama profil pendamping minimal 2 karakter." },
        { status: 400 }
      );
    }

    const companion = await db.companionProfile.create({
      data: {
        userId: auth.user.id,
        name: body.name.trim(),
        identityNumber: body.identityNumber?.trim() || null,
        phone: body.phone?.trim() || null,
        relation: body.relation?.trim() || "Keluarga / Rekan",
        age: body.age ? Number(body.age) : null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profil pendamping berhasil ditambahkan.",
      companion,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan profil pendamping.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID profil wajib disertakan." },
        { status: 400 }
      );
    }

    await db.companionProfile.deleteMany({
      where: { id, userId: auth.user.id },
    });

    return NextResponse.json({
      success: true,
      message: "Profil pendamping berhasil dihapus.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus profil pendamping.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

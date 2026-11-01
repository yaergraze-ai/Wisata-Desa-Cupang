import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getAllMediaSlots,
  updateMediaSlotAsset,
  restoreMediaSlotDefault,
  MediaServiceError,
} from "@/server/media/media-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const slots = await getAllMediaSlots();
    return NextResponse.json({ slots });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat slot media.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const formData = await req.formData();
    const slot = formData.get("slot");
    const file = formData.get("file");
    const altId = formData.get("altId");
    const altEn = formData.get("altEn");

    if (typeof slot !== "string" || !slot.trim()) {
      return NextResponse.json(
        { error: "Slot media wajib ditentukan." },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Berkas gambar wajib diunggah." },
        { status: 400 }
      );
    }

    if (typeof altId !== "string" || typeof altEn !== "string") {
      return NextResponse.json(
        { error: "Teks alternatif aksesibilitas (altId & altEn) wajib diisi." },
        { status: 400 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await updateMediaSlotAsset(
      auth.user.id,
      {
        slot: slot.trim(),
        fileBuffer,
        altId,
        altEn,
      },
      { ip, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: `Aset media untuk slot '${slot}' berhasil diperbarui.`,
      slot: result,
    });
  } catch (err: unknown) {
    if (err instanceof MediaServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    const message =
      err instanceof Error ? err.message : "Gagal memperbarui slot media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const body = (await req.json()) as { slot?: string };

    if (!body.slot || typeof body.slot !== "string") {
      return NextResponse.json(
        { error: "Parameter slot wajib diisi." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await restoreMediaSlotDefault(
      auth.user.id,
      body.slot.trim(),
      { ip, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: `Slot '${body.slot}' berhasil dikembalikan ke aset bawaan.`,
      slot: result,
    });
  } catch (err: unknown) {
    if (err instanceof MediaServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    const message =
      err instanceof Error ? err.message : "Gagal mengembalikan slot media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

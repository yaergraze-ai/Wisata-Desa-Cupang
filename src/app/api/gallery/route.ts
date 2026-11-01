import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import {
  getGalleryItems,
  addGalleryItem,
  deleteGalleryItem,
} from "@/server/gallery/gallery-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getGalleryItems();
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat galeri.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const formData = await req.formData();
    const file = formData.get("file");
    const title = formData.get("title");
    const category = formData.get("category");
    const caption = formData.get("caption");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Berkas foto wajib diunggah." },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Judul spot foto wajib diisi." },
        { status: 400 }
      );
    }

    const validCategories = [
      "spot-foto",
      "pemandangan",
      "pengunjung",
      "aktivitas",
    ] as const;
    const cat = validCategories.includes(
      category as (typeof validCategories)[number]
    )
      ? (category as (typeof validCategories)[number])
      : "spot-foto";

    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    const item = await addGalleryItem({
      fileBuffer,
      mimeType: file.type || "image/jpeg",
      originalFileName: file.name,
      title: title.trim(),
      category: cat,
      caption: typeof caption === "string" ? caption.trim() : "",
      uploaderId: auth.user.id,
      uploaderName: auth.user.name,
      uploaderRole: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: "Foto spot wisata berhasil diunggah.",
      item,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengunggah foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const body = (await req.json()) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json(
        { error: "Parameter ID foto wajib disertakan." },
        { status: 400 }
      );
    }

    const res = await deleteGalleryItem({
      id: body.id,
      actorId: auth.user.id,
      actorRole: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus foto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

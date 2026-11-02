import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { Role } from "@prisma/client";
import { requireApiRole } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getStorageProvider } from "@/server/integrations/storage";
import { detectImageMagicBytes } from "@/server/media/image-processor";

export const dynamic = "force-dynamic";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    const formData = await req.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Berkas foto profil wajib dipilih." },
        { status: 400 }
      );
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran berkas foto maksimal 5 MB." },
        { status: 400 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuf);

    // Validasi magic bytes (JPEG, PNG, WebP)
    const detectedMime = detectImageMagicBytes(inputBuffer);
    if (!detectedMime) {
      return NextResponse.json(
        { error: "Format berkas tidak valid. Gunakan format JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    // Kompresi & Pemotongan Proporsional 400x400 WebP
    const processedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(400, 400, { fit: "cover", position: "centre" })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const storageKey = `avatars/${auth.user.id}-${Date.now()}.webp`;
    const storage = getStorageProvider();

    const putResult = await storage.put(storageKey, processedBuffer, {
      contentType: "image/webp",
      isPublic: true,
    });

    const avatarUrl = putResult.publicUrl || `/uploads/${storageKey}`;

    // Simpan ke database User
    await db.user.update({
      where: { id: auth.user.id },
      data: { image: avatarUrl },
    });

    return NextResponse.json({
      success: true,
      message: "Foto profil berhasil diperbarui.",
      avatarUrl,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal mengunggah foto profil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const auth = await requireApiRole([
      Role.MEMBER,
      Role.STAFF,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ]);

    await db.user.update({
      where: { id: auth.user.id },
      data: { image: null },
    });

    return NextResponse.json({
      success: true,
      message: "Foto profil berhasil dihapus.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menghapus foto profil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

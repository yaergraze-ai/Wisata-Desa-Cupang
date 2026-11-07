import { db } from "@/server/db";
import { getStorageProvider } from "@/server/integrations/storage";
import {
  processAndStripImage,
  ImageValidationError,
} from "@/server/media/image-processor";

export class MediaServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SLOT_NOT_FOUND"
      | "ALT_TEXT_REQUIRED"
      | "IMAGE_INVALID"
      | "DEFAULT_ASSET_NOT_FOUND"
  ) {
    super(message);
    this.name = "MediaServiceError";
  }
}

export interface MediaSlotItemDto {
  id: string;
  slot: string;
  labelId: string;
  labelEn: string;
  updatedAt: string;
  asset: {
    id: string;
    storageKey: string;
    url: string;
    mimeType: string;
    width: number;
    height: number;
    sizeBytes: number;
    altId: string;
    altEn: string;
    isDefault: boolean;
  };
}

const DEFAULT_MEDIA_SLOTS_DATA = [
  {
    slot: "hero",
    filename: "hero.webp",
    width: 1920,
    height: 1080,
    sizeBytes: 232200,
    labelId: "Latar Utama Hero Beranda",
    labelEn: "Home Hero Main Backdrop",
    altId: "Siluet tebing kembar Batu Lawang dan kabut fajar Gunung Bendera di Desa Cupang Cirebon",
    altEn: "Twin limestone cliffs of Batu Lawang and misty dawn ridge of Mount Bendera in Cupang Village Cirebon",
  },
  {
    slot: "footer",
    filename: "footer.webp",
    width: 1920,
    height: 960,
    sizeBytes: 306620,
    labelId: "Latar Lanskap Footer",
    labelEn: "Footer Landscape Backdrop",
    altId: "Punggung bukit Gunung Bendera berselimut kabut petang di Kecamatan Gempol",
    altEn: "Mount Bendera ridgeline wrapped in evening mist in Gempol District",
  },
  {
    slot: "card-1",
    filename: "card-1.webp",
    width: 900,
    height: 1200,
    sizeBytes: 91774,
    labelId: "Galeri Beranda — Gerbang Tebing Batu Lawang",
    labelEn: "Hero Gallery — Batu Lawang Cliff Gateway",
    altId: "Tebing batu alam menjulang membentuk celah gerbang di kawasan wisata Batu Lawang",
    altEn: "Natural rock cliffs towering into a gateway cleft at Batu Lawang tourism area",
  },
  {
    slot: "card-2",
    filename: "card-2.webp",
    width: 900,
    height: 1200,
    sizeBytes: 66462,
    labelId: "Galeri Beranda — Tiket Putih (Batu Lawang + Gunung Bendera)",
    labelEn: "Hero Gallery — Tiket Putih (Combined 2-Site Pass)",
    altId: "Puncak terbuka Gunung Bendera setinggi 520 mdpl menghadap bentang alam Cirebon",
    altEn: "Open 520 masl summit of Mount Bendera overlooking the Cirebon landscape",
  },
  {
    slot: "card-3",
    filename: "card-3.webp",
    width: 900,
    height: 1200,
    sizeBytes: 79186,
    labelId: "Galeri Beranda — Gardu Pandang Tebing Desa Cupang",
    labelEn: "Hero Gallery — Cupang Twin Cliff Lookout",
    altId: "Pepohonan teduh dan sinar pagi menembus kabut di jalur awal pendakian",
    altEn: "Shaded forest canopy with morning sunbeams piercing mist along the lower trail",
  },
  {
    slot: "card-4",
    filename: "card-4.webp",
    width: 900,
    height: 1200,
    sizeBytes: 106530,
    labelId: "Galeri Beranda — Navigator Peta & Koridor Jalur GPS",
    labelEn: "Hero Gallery — GPS Trail Corridor Navigator",
    altId: "Jalur setapak berbatu alami menuju punggung bukit Gunung Bendera",
    altEn: "Natural rocky footpath ascending toward the Mount Bendera ridge",
  },
  {
    slot: "card-5",
    filename: "card-5.webp",
    width: 900,
    height: 1200,
    sizeBytes: 42306,
    labelId: "Galeri Beranda — Puncak Gunung Bendera 520 mdpl",
    labelEn: "Hero Gallery — Mount Bendera 520 masl Summit",
    altId: "Cakrawala fajar keemasan dilihat dari gardu pandang tebing Batu Lawang",
    altEn: "Golden dawn horizon viewed from the Batu Lawang cliff lookout",
  },
  {
    slot: "timeline-1a",
    filename: "timeline-1a.webp",
    width: 1200,
    height: 800,
    sizeBytes: 182270,
    labelId: "Foto Linimasa Jalur 1A — Pintu Pendakian & Pos 1",
    labelEn: "Trail Timeline Photo 1A — Trailhead & Post 1",
    altId: "Jalur tanah teduh dari pintu pendakian menuju Pos 1 Rimbun Pohon",
    altEn: "Shaded earthen trail leading from the trailhead to Post 1 Shaded Canopy",
  },
  {
    slot: "timeline-1b",
    filename: "timeline-1b.webp",
    width: 1200,
    height: 800,
    sizeBytes: 127650,
    labelId: "Foto Linimasa Jalur 1B — Dinding Batu Bawah",
    labelEn: "Trail Timeline Photo 1B — Lower Rock Wall",
    altId: "Formasi dinding batu kapur dan pepohonan hijau di sekitar Pos 1",
    altEn: "Limestone wall formation and lush trees surrounding Post 1",
  },
  {
    slot: "timeline-2a",
    filename: "timeline-2a.webp",
    width: 1200,
    height: 800,
    sizeBytes: 148108,
    labelId: "Foto Linimasa Jalur 2A — Tanjakan Batu Pos 2",
    labelEn: "Trail Timeline Photo 2A — Post 2 Rocky Climb",
    altId: "Tanjakan berbatu alami di segmen Pos 2 jalur Gunung Bendera",
    altEn: "Natural rocky incline along the Post 2 segment of Mount Bendera",
  },
  {
    slot: "timeline-2b",
    filename: "timeline-2b.webp",
    width: 1200,
    height: 800,
    sizeBytes: 138108,
    labelId: "Foto Linimasa Jalur 2B — Punggung Bukit Pos 3",
    labelEn: "Trail Timeline Photo 2B — Post 3 Open Ridge",
    altId: "Punggung bukit terbuka dengan angin sejuk dan pemandangan lembah di Pos 3",
    altEn: "Open breezy ridge with valley views at Post 3",
  },
  {
    slot: "timeline-3a",
    filename: "timeline-3a.webp",
    width: 1200,
    height: 800,
    sizeBytes: 112612,
    labelId: "Foto Linimasa Jalur 3A — Bahu Puncak Pos 4",
    labelEn: "Trail Timeline Photo 3A — Post 4 Pre-Summit",
    altId: "Bahu tebing terbuka menjelang puncak Gunung Bendera di Pos 4",
    altEn: "Open cliff shoulder approaching Mount Bendera summit at Post 4",
  },
  {
    slot: "timeline-3b",
    filename: "timeline-3b.webp",
    width: 1200,
    height: 800,
    sizeBytes: 98814,
    labelId: "Foto Linimasa Jalur 3B — Puncak Gunung Bendera",
    labelEn: "Trail Timeline Photo 3B — Mount Bendera Summit",
    altId: "Titik puncak 520 mdpl Gunung Bendera dengan panorama 360 derajat",
    altEn: "520 masl summit marker of Mount Bendera with 360-degree panorama",
  },
];

async function autoSeedDefaultMediaSlots() {
  for (const item of DEFAULT_MEDIA_SLOTS_DATA) {
    const storageKey = `/media/defaults/${item.filename}`;
    const asset = await db.mediaAsset.upsert({
      where: { storageKey },
      update: {
        mimeType: "image/webp",
        width: item.width,
        height: item.height,
        sizeBytes: item.sizeBytes,
        altId: item.altId,
        altEn: item.altEn,
        isDefault: true,
      },
      create: {
        storageKey,
        mimeType: "image/webp",
        width: item.width,
        height: item.height,
        sizeBytes: item.sizeBytes,
        altId: item.altId,
        altEn: item.altEn,
        isDefault: true,
      },
    });

    const existingSlot = await db.mediaSlot.findUnique({
      where: { slot: item.slot },
    });

    if (!existingSlot) {
      await db.mediaSlot.create({
        data: {
          slot: item.slot,
          assetId: asset.id,
          labelId: item.labelId,
          labelEn: item.labelEn,
        },
      });
    }
  }
}

export async function getAllMediaSlots(): Promise<MediaSlotItemDto[]> {
  try {
    let slots = await db.mediaSlot.findMany({
      include: {
        asset: true,
      },
      orderBy: { slot: "asc" },
    });

    if (slots.length === 0) {
      try {
        await autoSeedDefaultMediaSlots();
        slots = await db.mediaSlot.findMany({
          include: {
            asset: true,
          },
          orderBy: { slot: "asc" },
        });
      } catch (e) {
        console.error("Gagal auto-seed media slots:", e);
      }
    }

    if (slots.length === 0) {
      // Fallback statis jika database belum ter-seed agar UI tidak kosong / error
      return DEFAULT_MEDIA_SLOTS_DATA.map((item) => ({
        id: `default-${item.slot}`,
        slot: item.slot,
        labelId: item.labelId,
        labelEn: item.labelEn,
        updatedAt: new Date().toISOString(),
        asset: {
          id: `asset-${item.slot}`,
          storageKey: `/media/defaults/${item.filename}`,
          url: `/images/gallery/${item.filename}`,
          mimeType: "image/webp",
          width: item.width,
          height: item.height,
          sizeBytes: item.sizeBytes,
          altId: item.altId,
          altEn: item.altEn,
          isDefault: true,
        },
      }));
    }

    const storage = getStorageProvider();

    return slots.map((s) => ({
      id: s.id,
      slot: s.slot,
      labelId: s.labelId,
      labelEn: s.labelEn,
      updatedAt: s.updatedAt ? s.updatedAt.toISOString() : new Date().toISOString(),
      asset: {
        id: s.asset?.id ?? `asset-${s.slot}`,
        storageKey: s.asset?.storageKey ?? `/media/defaults/${s.slot}.webp`,
        url: s.asset?.storageKey?.startsWith("/")
          ? s.asset.storageKey
          : storage.getUrl(s.asset?.storageKey ?? ""),
        mimeType: s.asset?.mimeType ?? "image/webp",
        width: s.asset?.width ?? 1200,
        height: s.asset?.height ?? 800,
        sizeBytes: s.asset?.sizeBytes ?? 0,
        altId: s.asset?.altId ?? s.labelId,
        altEn: s.asset?.altEn ?? s.labelEn,
        isDefault: s.asset?.isDefault ?? true,
      },
    }));
  } catch (err) {
    console.error("Error in getAllMediaSlots:", err);
    return DEFAULT_MEDIA_SLOTS_DATA.map((item) => ({
      id: `default-${item.slot}`,
      slot: item.slot,
      labelId: item.labelId,
      labelEn: item.labelEn,
      updatedAt: new Date().toISOString(),
      asset: {
        id: `asset-${item.slot}`,
        storageKey: `/media/defaults/${item.filename}`,
        url: `/images/gallery/${item.filename}`,
        mimeType: "image/webp",
        width: item.width,
        height: item.height,
        sizeBytes: item.sizeBytes,
        altId: item.altId,
        altEn: item.altEn,
        isDefault: true,
      },
    }));
  }
}

export async function updateMediaSlotAsset(
  adminUserId: string,
  input: {
    slot: string;
    fileBuffer: Buffer;
    altId: string;
    altEn: string;
  },
  context?: { ip?: string; userAgent?: string }
) {
  const slot = await db.mediaSlot.findUnique({
    where: { slot: input.slot },
    include: { asset: true },
  });

  if (!slot) {
    throw new MediaServiceError(
      `Slot media '${input.slot}' tidak ditemukan.`,
      "SLOT_NOT_FOUND"
    );
  }

  const trimmedAltId = input.altId?.trim() ?? "";
  const trimmedAltEn = input.altEn?.trim() ?? "";

  if (trimmedAltId.length < 5 || trimmedAltEn.length < 5) {
    throw new MediaServiceError(
      "Teks alternatif aksesibilitas (altId dan altEn) wajib diisi minimal 5 karakter.",
      "ALT_TEXT_REQUIRED"
    );
  }

  // Process through sharp WebP + EXIF-stripping pipeline
  let processed;
  try {
    processed = await processAndStripImage(input.fileBuffer, {
      maxWidth: 2560,
      maxHeight: 2560,
      quality: 85,
    });
  } catch (err: unknown) {
    if (err instanceof ImageValidationError) {
      throw new MediaServiceError(err.message, "IMAGE_INVALID");
    }
    throw new MediaServiceError(
      "Gagal memproses berkas gambar.",
      "IMAGE_INVALID"
    );
  }

  const storage = getStorageProvider();
  const uniqueKey = `media/custom-${input.slot}-${Date.now()}.webp`;

  await storage.put(uniqueKey, processed.buffer, {
    contentType: "image/webp",
    isPublic: true,
  });

  const updatedSlot = await db.$transaction(async (tx) => {
    // 1. Create MediaAsset
    const asset = await tx.mediaAsset.create({
      data: {
        storageKey: uniqueKey,
        mimeType: "image/webp",
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        altId: trimmedAltId,
        altEn: trimmedAltEn,
        isDefault: false,
        uploadedById: adminUserId,
      },
    });

    // 2. Link to slot
    const updated = await tx.mediaSlot.update({
      where: { id: slot.id },
      data: {
        assetId: asset.id,
        updatedById: adminUserId,
      },
      include: { asset: true },
    });

    // 3. Audit log
    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: "ADMIN",
        action: "MEDIA_SLOT_UPDATED",
        entity: "MediaSlot",
        entityId: slot.slot,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          slot: slot.slot,
          previousAssetId: slot.assetId,
          newAssetId: asset.id,
          storageKey: uniqueKey,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.sizeBytes,
        },
      },
    });

    return updated;
  });

  return {
    id: updatedSlot.id,
    slot: updatedSlot.slot,
    labelId: updatedSlot.labelId,
    labelEn: updatedSlot.labelEn,
    updatedAt: updatedSlot.updatedAt.toISOString(),
    asset: {
      id: updatedSlot.asset.id,
      storageKey: updatedSlot.asset.storageKey,
      url: storage.getUrl(updatedSlot.asset.storageKey),
      mimeType: updatedSlot.asset.mimeType,
      width: updatedSlot.asset.width,
      height: updatedSlot.asset.height,
      sizeBytes: updatedSlot.asset.sizeBytes,
      altId: updatedSlot.asset.altId,
      altEn: updatedSlot.asset.altEn,
      isDefault: updatedSlot.asset.isDefault,
    },
  };
}

export async function restoreMediaSlotDefault(
  adminUserId: string,
  slotKey: string,
  context?: { ip?: string; userAgent?: string }
) {
  const slot = await db.mediaSlot.findUnique({
    where: { slot: slotKey },
    include: { asset: true },
  });

  if (!slot) {
    throw new MediaServiceError(
      `Slot media '${slotKey}' tidak ditemukan.`,
      "SLOT_NOT_FOUND"
    );
  }

  // Find default seeded asset matching this slot
  // Storage key pattern in seed: "/media/defaults/${filename}"
  const defaultAsset = await db.mediaAsset.findFirst({
    where: {
      isDefault: true,
      storageKey: {
        contains: slotKey === "hero" ? "hero.webp" : slotKey === "footer" ? "footer.webp" : `${slotKey}.webp`,
      },
    },
  });

  if (!defaultAsset) {
    throw new MediaServiceError(
      `Aset bawaan untuk slot '${slotKey}' tidak ditemukan.`,
      "DEFAULT_ASSET_NOT_FOUND"
    );
  }

  const updatedSlot = await db.$transaction(async (tx) => {
    const updated = await tx.mediaSlot.update({
      where: { id: slot.id },
      data: {
        assetId: defaultAsset.id,
        updatedById: adminUserId,
      },
      include: { asset: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: "ADMIN",
        action: "MEDIA_SLOT_RESTORED",
        entity: "MediaSlot",
        entityId: slot.slot,
        ip: context?.ip,
        userAgent: context?.userAgent,
        metadata: {
          slot: slot.slot,
          restoredAssetId: defaultAsset.id,
          storageKey: defaultAsset.storageKey,
        },
      },
    });

    return updated;
  });

  const storage = getStorageProvider();

  return {
    id: updatedSlot.id,
    slot: updatedSlot.slot,
    labelId: updatedSlot.labelId,
    labelEn: updatedSlot.labelEn,
    updatedAt: updatedSlot.updatedAt.toISOString(),
    asset: {
      id: updatedSlot.asset.id,
      storageKey: updatedSlot.asset.storageKey,
      url: updatedSlot.asset.storageKey.startsWith("/")
        ? updatedSlot.asset.storageKey
        : storage.getUrl(updatedSlot.asset.storageKey),
      mimeType: updatedSlot.asset.mimeType,
      width: updatedSlot.asset.width,
      height: updatedSlot.asset.height,
      sizeBytes: updatedSlot.asset.sizeBytes,
      altId: updatedSlot.asset.altId,
      altEn: updatedSlot.asset.altEn,
      isDefault: updatedSlot.asset.isDefault,
    },
  };
}

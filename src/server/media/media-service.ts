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

export async function getAllMediaSlots(): Promise<MediaSlotItemDto[]> {
  const slots = await db.mediaSlot.findMany({
    include: {
      asset: true,
    },
    orderBy: { slot: "asc" },
  });

  const storage = getStorageProvider();

  return slots.map((s) => ({
    id: s.id,
    slot: s.slot,
    labelId: s.labelId,
    labelEn: s.labelEn,
    updatedAt: s.updatedAt.toISOString(),
    asset: {
      id: s.asset.id,
      storageKey: s.asset.storageKey,
      url: s.asset.storageKey.startsWith("/")
        ? s.asset.storageKey
        : storage.getUrl(s.asset.storageKey),
      mimeType: s.asset.mimeType,
      width: s.asset.width,
      height: s.asset.height,
      sizeBytes: s.asset.sizeBytes,
      altId: s.asset.altId,
      altEn: s.asset.altEn,
      isDefault: s.asset.isDefault,
    },
  }));
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

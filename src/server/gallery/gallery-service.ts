import { db } from "@/server/db";
import { getStorageProvider } from "@/server/integrations/storage";
import { writeAuditLog } from "@/server/audit/audit";
import { Role } from "@prisma/client";

export interface GallerySpotItem {
  id: string;
  title: string;
  category: "spot-foto" | "pemandangan" | "pengunjung" | "aktivitas";
  caption: string;
  imageUrl: string;
  storageKey?: string;
  uploadedByName: string;
  uploadedByRole: string;
  createdAt: string;
}

const GALLERY_SETTING_KEY = "visitor_gallery_items";

export const DEFAULT_GALLERY_SPOTS: GallerySpotItem[] = [
  {
    id: "spot-1",
    title: "Tebing Purba Vertikal Batu Lawang",
    category: "spot-foto",
    caption: "Spot swafoto ikonik di hadapan dinding batu kapur purba berusia jutaan tahun.",
    imageUrl: "/media/defaults/card-1.webp",
    uploadedByName: "Pengelola Wisata",
    uploadedByRole: "ADMIN",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "spot-2",
    title: "Samudera Awan Puncak 520 mdpl",
    category: "pemandangan",
    caption: "Panorama matahari terbit menembus kabut lembah di Puncak Gunung Bendera.",
    imageUrl: "/media/defaults/card-5.webp",
    uploadedByName: "Ranger Pos Puncak",
    uploadedByRole: "STAFF",
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: "spot-3",
    title: "Rombongan Komunitas di Pos 2",
    category: "pengunjung",
    caption: "Momen seru pendaki rombongan istirahat di bawah naungan pohon rindang Desa Cupang.",
    imageUrl: "/media/defaults/timeline-2a.webp",
    uploadedByName: "Petugas Lapangan",
    uploadedByRole: "STAFF",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "spot-4",
    title: "Koridor Teduh Jalur Kanopi Pinus",
    category: "pemandangan",
    caption: "Jalur pendakian asri dengan udara sejuk dan sinar matahari pagi menembus pepohonan.",
    imageUrl: "/media/defaults/card-4.webp",
    uploadedByName: "Pengelola Wisata",
    uploadedByRole: "ADMIN",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "spot-5",
    title: "Sunset Keemasan di Lembah Batu Lawang",
    category: "spot-foto",
    caption: "Pemandangan senja dengan cahaya jingga memantul di tebing kembar Batu Lawang.",
    imageUrl: "/media/defaults/card-2.webp",
    uploadedByName: "Tim Dokumentasi",
    uploadedByRole: "STAFF",
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "spot-6",
    title: "Punggung Bukit Pos 3 Menuju Puncak",
    category: "aktivitas",
    caption: "Tantangan medan batuan terbuka dengan panorama 360 derajat sebelum tanjakan puncak.",
    imageUrl: "/media/defaults/timeline-3a.webp",
    uploadedByName: "Pengelola Wisata",
    uploadedByRole: "ADMIN",
    createdAt: new Date().toISOString(),
  },
];

export async function getGalleryItems(): Promise<GallerySpotItem[]> {
  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: GALLERY_SETTING_KEY },
    });

    if (!setting || !setting.value) {
      return DEFAULT_GALLERY_SPOTS;
    }

    const parsed = JSON.parse(setting.value) as GallerySpotItem[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_GALLERY_SPOTS;
  } catch {
    return DEFAULT_GALLERY_SPOTS;
  }
}

export async function addGalleryItem(params: {
  fileBuffer: Buffer;
  mimeType: string;
  originalFileName: string;
  title: string;
  category: "spot-foto" | "pemandangan" | "pengunjung" | "aktivitas";
  caption: string;
  uploaderId: string;
  uploaderName: string;
  uploaderRole: string;
}): Promise<GallerySpotItem> {
  const storage = getStorageProvider();
  const ext = params.mimeType === "image/png" ? "png" : params.mimeType === "image/webp" ? "webp" : "jpg";
  const storageKey = `gallery/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const putRes = await storage.put(storageKey, params.fileBuffer);

  const newItem: GallerySpotItem = {
    id: `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: params.title.trim(),
    category: params.category,
    caption: params.caption.trim(),
    imageUrl: putRes.publicUrl,
    storageKey,
    uploadedByName: params.uploaderName,
    uploadedByRole: params.uploaderRole,
    createdAt: new Date().toISOString(),
  };

  const currentItems = await getGalleryItems();
  const updatedItems = [newItem, ...currentItems];

  await db.siteSetting.upsert({
    where: { key: GALLERY_SETTING_KEY },
    create: {
      key: GALLERY_SETTING_KEY,
      valueType: "JSON",
      value: JSON.stringify(updatedItems),
      descriptionId: "Koleksi spot foto dan gambar pengunjung",
      descriptionEn: "Visitor gallery photo spots",
      updatedById: params.uploaderId,
    },
    update: {
      value: JSON.stringify(updatedItems),
      updatedById: params.uploaderId,
    },
  });

  await writeAuditLog({
    actorId: params.uploaderId,
    actorRole: (params.uploaderRole as Role) || Role.STAFF,
    action: "GALLERY_PHOTO_UPLOADED",
    entity: "GallerySpot",
    entityId: newItem.id,
    metadata: {
      title: newItem.title,
      category: newItem.category,
      storageKey,
    },
  });

  return newItem;
}

export async function deleteGalleryItem(params: {
  id: string;
  actorId: string;
  actorRole: string;
}): Promise<{ success: boolean; message: string }> {
  const currentItems = await getGalleryItems();
  const targetIndex = currentItems.findIndex((item) => item.id === params.id);

  if (targetIndex === -1) {
    throw new Error("Foto galeri tidak ditemukan.");
  }

  const targetItem = currentItems[targetIndex];
  if (!targetItem) {
    throw new Error("Foto galeri tidak ditemukan.");
  }

  // Hapus berkas dari storage provider jika diunggah via storageKey
  if (targetItem.storageKey) {
    try {
      const storage = getStorageProvider();
      await storage.delete(targetItem.storageKey);
    } catch (err: unknown) {
      console.warn("Gagal menghapus berkas storage:", err);
    }
  }

  const updatedItems = currentItems.filter((item) => item.id !== params.id);

  await db.siteSetting.upsert({
    where: { key: GALLERY_SETTING_KEY },
    create: {
      key: GALLERY_SETTING_KEY,
      valueType: "JSON",
      value: JSON.stringify(updatedItems),
      descriptionId: "Koleksi spot foto dan gambar pengunjung",
      descriptionEn: "Visitor gallery photo spots",
      updatedById: params.actorId,
    },
    update: {
      value: JSON.stringify(updatedItems),
      updatedById: params.actorId,
    },
  });

  await writeAuditLog({
    actorId: params.actorId,
    actorRole: (params.actorRole as Role) || Role.STAFF,
    action: "GALLERY_PHOTO_DELETED",
    entity: "GallerySpot",
    entityId: params.id,
    metadata: {
      title: targetItem.title,
      imageUrl: targetItem.imageUrl,
    },
  });

  return {
    success: true,
    message: `Foto '${targetItem.title}' berhasil dihapus dari galeri wisata.`,
  };
}

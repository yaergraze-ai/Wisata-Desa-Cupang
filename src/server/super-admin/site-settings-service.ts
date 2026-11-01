import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/audit/audit";

export interface SiteSettingItemDto {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
  updatedByName: string | null;
}

export async function getAllSiteSettingsList(): Promise<SiteSettingItemDto[]> {
  const settings = await db.siteSetting.findMany({
    orderBy: { key: "asc" },
  });

  return settings.map((s) => ({
    id: s.key,
    key: s.key,
    value: s.value,
    description: s.descriptionId || s.descriptionEn,
    updatedAt: s.updatedAt.toISOString(),
    updatedByName: s.updatedById ? "Super Admin" : "Sistem Bawaan",
  }));
}

export async function updateSiteSettingByKey(
  key: string,
  value: string,
  actorId: string
): Promise<void> {
  const existing = await db.siteSetting.findUnique({
    where: { key },
  });

  await db.siteSetting.upsert({
    where: { key },
    create: {
      key,
      valueType: "STRING",
      value: value.trim(),
      descriptionId: key,
      descriptionEn: key,
      updatedById: actorId,
    },
    update: {
      value: value.trim(),
      updatedById: actorId,
    },
  });

  await writeAuditLog({
    actorId,
    actorRole: Role.SUPER_ADMIN,
    action: "SITE_SETTING_UPDATED",
    entity: "SiteSetting",
    entityId: key,
    metadata: {
      key,
      oldValue: existing?.value ?? null,
      newValue: value.trim(),
    },
  });
}

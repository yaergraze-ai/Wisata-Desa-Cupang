import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

export interface WriteAuditLogInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  headers?: Headers;
  metadata?: Record<string, unknown>;
}

export function extractRequestNetworkMeta(headers?: Headers): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!headers) {
    return { ip: null, userAgent: null };
  }
  const forwarded = headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim() || null;
  const realIp = headers.get("x-real-ip")?.trim() || null;
  const userAgent = headers.get("user-agent")?.slice(0, 500) || null;
  return {
    ip: firstForwarded || realIp,
    userAgent,
  };
}

/**
 * Mencatat peristiwa keamanan atau aksi sensitif secara append-only ke tabel AuditLog.
 * Tidak ada endpoint atau fungsi untuk mengubah maupun menghapus baris AuditLog (§4 & §7).
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const fromHeaders = extractRequestNetworkMeta(input.headers);
  const ip = input.ip ?? fromHeaders.ip;
  const userAgent = input.userAgent ?? fromHeaders.userAgent;

  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ip,
      userAgent,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
    },
  });
}

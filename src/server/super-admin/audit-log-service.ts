import { Role } from "@prisma/client";
import { db } from "@/server/db";

export interface AuditLogItemDto {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: Role | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function getAuditLogsList(params: {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  logs: AuditLogItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {};
  if (params.action?.trim()) {
    whereClause.action = { contains: params.action.trim(), mode: "insensitive" };
  }
  if (params.actorId?.trim()) {
    whereClause.actorId = params.actorId.trim();
  }
  if (params.dateFrom || params.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (params.dateFrom) dateFilter.gte = new Date(params.dateFrom);
    if (params.dateTo) dateFilter.lte = new Date(params.dateTo);
    whereClause.createdAt = dateFilter;
  }

  const [total, rawLogs] = await Promise.all([
    db.auditLog.count({ where: whereClause }),
    db.auditLog.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  const logs: AuditLogItemDto[] = rawLogs.map((l) => ({
    id: l.id,
    actorId: l.actorId,
    actorName: l.actor?.name ?? (l.actorId ? "User" : "Sistem"),
    actorRole: l.actorRole as Role | null,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    metadata: (l.metadata as Record<string, unknown>) ?? null,
    ipAddress: l.ip,
    userAgent: l.userAgent,
    createdAt: l.createdAt.toISOString(),
  }));

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function exportAuditLogsCsv(params: {
  action?: string;
  actorId?: string;
}): Promise<string> {
  const whereClause: Record<string, unknown> = {};
  if (params.action?.trim()) {
    whereClause.action = { contains: params.action.trim(), mode: "insensitive" };
  }
  if (params.actorId?.trim()) {
    whereClause.actorId = params.actorId.trim();
  }

  const logs = await db.auditLog.findMany({
    where: whereClause,
    take: 1000,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  const header = [
    "ID",
    "Waktu (UTC)",
    "Aktor",
    "Peran",
    "Aksi",
    "Entitas",
    "ID Entitas",
    "IP Address",
    "Detail Metadata",
  ];

  const rows = logs.map((l) => [
    `"${l.id}"`,
    `"${l.createdAt.toISOString()}"`,
    `"${(l.actor?.name ?? l.actorId ?? "Sistem").replace(/"/g, '""')}"`,
    `"${l.actorRole ?? "SYSTEM"}"`,
    `"${l.action}"`,
    `"${l.entity}"`,
    `"${l.entityId ?? ""}"`,
    `"${l.ip ?? ""}"`,
    `"${JSON.stringify(l.metadata ?? {}).replace(/"/g, '""')}"`,
  ]);

  return "\uFEFF" + [header.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

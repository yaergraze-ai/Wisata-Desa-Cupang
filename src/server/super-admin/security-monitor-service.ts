import { db } from "@/server/db";

export interface SecurityOverviewDto {
  failedLoginsLast24h: number;
  rateLimitEventsLast24h: number;
  activeSessionsCount: number;
  twoFactorAdoptionRate: {
    enabledCount: number;
    totalUsersCount: number;
    percentage: number;
  };
  recentSuspiciousEvents: {
    id: string;
    action: string;
    ipAddress: string | null;
    createdAt: string;
    details: string;
  }[];
}

export async function getSecurityOverview(): Promise<SecurityOverviewDto> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    failedLoginsCount,
    rateLimitCount,
    activeSessionsCount,
    twoFactorEnabledCount,
    totalUsersCount,
    suspiciousLogs,
  ] = await Promise.all([
    db.auditLog.count({
      where: {
        action: { in: ["AUTH_LOGIN_FAILED", "AUTH_FORBIDDEN_ACCESS", "AUTH_FORBIDDEN_PAGE"] },
        createdAt: { gte: yesterday },
      },
    }),
    db.rateLimit.count({
      where: {
        expiresAt: { gte: yesterday },
      },
    }),
    db.session.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    }),
    db.user.count({
      where: { twoFactorEnabled: true },
    }),
    db.user.count(),
    db.auditLog.findMany({
      where: {
        action: {
          in: [
            "AUTH_LOGIN_FAILED",
            "AUTH_FORBIDDEN_ACCESS",
            "AUTH_FORBIDDEN_PAGE",
            "SCAN_REJECTED",
            "USER_ROLE_CHANGED",
            "USER_SESSIONS_REVOKED",
          ],
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const percentage =
    totalUsersCount > 0
      ? Math.round((twoFactorEnabledCount / totalUsersCount) * 100)
      : 0;

  return {
    failedLoginsLast24h: failedLoginsCount,
    rateLimitEventsLast24h: rateLimitCount,
    activeSessionsCount,
    twoFactorAdoptionRate: {
      enabledCount: twoFactorEnabledCount,
      totalUsersCount,
      percentage,
    },
    recentSuspiciousEvents: suspiciousLogs.map((l) => ({
      id: l.id,
      action: l.action,
      ipAddress: l.ip,
      createdAt: l.createdAt.toISOString(),
      details: `${l.entity} ${l.entityId ?? ""} - ${JSON.stringify(l.metadata ?? {})}`,
    })),
  };
}

import "server-only";
import crypto from "node:crypto";
import { db } from "@/server/db";
import { extractRequestNetworkMeta, writeAuditLog } from "@/server/audit/audit";

export interface RateLimitConfig {
  bucket: string;
  identifier: string;
  maxRequests: number;
  windowSeconds: number;
  headers?: Headers;
  actorId?: string | null;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  count: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

export function computeWindowBounds(
  nowMs: number,
  windowSeconds: number
): { windowStart: Date; expiresAt: Date; retryAfterSeconds: number } {
  const windowMs = windowSeconds * 1000;
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  const endMs = startMs + windowMs;
  return {
    windowStart: new Date(startMs),
    expiresAt: new Date(endMs),
    retryAfterSeconds: Math.max(1, Math.ceil((endMs - nowMs) / 1000)),
  };
}

export function hashRateIdentifier(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Rate limiter berbasis PostgreSQL dengan operasi UPSERT atomik.
 * Bila batas terlampaui, mencatat pemicu ke AuditLog untuk dipantau di Super Admin → Keamanan.
 */
export async function checkRateLimit(
  cfg: RateLimitConfig
): Promise<RateLimitDecision> {
  const nowMs = Date.now();
  const { windowStart, expiresAt, retryAfterSeconds } = computeWindowBounds(
    nowMs,
    cfg.windowSeconds
  );
  const key = `${cfg.bucket}:${hashRateIdentifier(cfg.identifier)}`;
  const newId = crypto.randomUUID();

  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimit" ("id", "key", "windowStart", "count", "expiresAt")
    VALUES (${newId}, ${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"
  `;

  const count = Number(rows[0]?.count ?? 1);
  const allowed = count <= cfg.maxRequests;
  const remaining = Math.max(0, cfg.maxRequests - count);

  // Catat satu kali tepat ketika ambang batas pertama kali ditembus pada jendela ini
  if (count === cfg.maxRequests + 1) {
    const net = extractRequestNetworkMeta(cfg.headers);
    await writeAuditLog({
      actorId: cfg.actorId ?? null,
      action: "RATE_LIMIT_TRIGGERED",
      entity: "RateLimit",
      entityId: cfg.bucket,
      ip: net.ip,
      userAgent: net.userAgent,
      metadata: {
        bucket: cfg.bucket,
        maxRequests: cfg.maxRequests,
        windowSeconds: cfg.windowSeconds,
      },
    }).catch(() => undefined);
  }

  return {
    allowed,
    remaining,
    count,
    retryAfterSeconds,
    resetAt: expiresAt,
  };
}

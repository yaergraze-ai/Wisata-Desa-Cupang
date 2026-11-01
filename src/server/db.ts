import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  pgPool?: Pool;
  prisma?: PrismaClient;
};

function getOptimizedConnectionString(): string {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur di environment.");
  }

  // Jika menggunakan Supabase Pooler pada mode session port 5432,
  // alihkan otomatis ke transaction mode port 6543 untuk mencegah EMAXCONNSESSION (pool exhaustion).
  try {
    const u = new URL(connectionString);
    if (u.hostname.includes("pooler.supabase.com") && (u.port === "5432" || !u.port)) {
      u.port = "6543";
      if (!u.searchParams.has("pgbouncer")) {
        u.searchParams.set("pgbouncer", "true");
      }
      connectionString = u.toString();
    }
  } catch {
    // Abaikan jika format non-URL
  }

  return connectionString;
}

function createPrismaClient(): PrismaClient {
  const connectionString = getOptimizedConnectionString();

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 2 : 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

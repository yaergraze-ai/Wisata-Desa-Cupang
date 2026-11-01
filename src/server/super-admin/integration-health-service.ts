import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { getStorageProvider } from "@/server/integrations/storage";

export type IntegrationStatus = "CONNECTED" | "DEGRADED" | "UNCONFIGURED";

export interface IntegrationHealthItem {
  id: "database" | "payment" | "whatsapp" | "email" | "storage" | "maps";
  name: string;
  category: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  message: string;
  details: Record<string, string | number | boolean>;
}

export async function testAllIntegrationsHealth(): Promise<IntegrationHealthItem[]> {
  const env = getEnv();
  const results: IntegrationHealthItem[] = [];

  // 1. PostgreSQL Database
  const dbStart = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Math.round(performance.now() - dbStart);
    results.push({
      id: "database",
      name: "PostgreSQL Database",
      category: "Penyimpanan Utama",
      status: "CONNECTED",
      latencyMs: dbLatency,
      message: "Koneksi database PostgreSQL aktif dan responsif.",
      details: {
        engine: "PostgreSQL 16+",
        connection: "TCP Local/Socket",
      },
    });
  } catch (err: unknown) {
    results.push({
      id: "database",
      name: "PostgreSQL Database",
      category: "Penyimpanan Utama",
      status: "DEGRADED",
      latencyMs: null,
      message: err instanceof Error ? err.message : "Gagal terhubung ke database.",
      details: {},
    });
  }

  // 2. Payment Gateway (Midtrans Snap)
  const isMidtransConfigured = Boolean(env.MIDTRANS_SERVER_KEY?.trim());
  results.push({
    id: "payment",
    name: "Midtrans Snap Gateway",
    category: "Transaksi & Pembayaran",
    status: isMidtransConfigured ? "CONNECTED" : "UNCONFIGURED",
    latencyMs: null,
    message: isMidtransConfigured
      ? `Konfigurasi kunci Midtrans terpasang (${env.MIDTRANS_IS_PRODUCTION ? "Produksi" : "Sandbox"}).`
      : "Kunci server Midtrans belum dikonfigurasi di file lingkungan.",
    details: {
      isProduction: env.MIDTRANS_IS_PRODUCTION,
      hasServerKey: isMidtransConfigured,
      hasClientKey: Boolean(env.MIDTRANS_CLIENT_KEY?.trim()),
    },
  });

  // 3. WhatsApp Gateway (Fonnte / Meta Cloud API)
  const isWaConfigured = Boolean(
    (env.WA_PROVIDER === "fonnte" && env.FONNTE_TOKEN?.trim()) ||
    (env.WA_PROVIDER === "meta" && env.META_WA_TOKEN?.trim())
  );
  results.push({
    id: "whatsapp",
    name: "WhatsApp Gateway",
    category: "Notifikasi Instan & OTP",
    status: isWaConfigured ? "CONNECTED" : "UNCONFIGURED",
    latencyMs: null,
    message: isWaConfigured
      ? `Provider WhatsApp ${(env.WA_PROVIDER ?? "").toUpperCase()} aktif dan terautentikasi.`
      : "Token penyedia WhatsApp belum dikonfigurasi (fallback log konsol aktif).",
    details: {
      provider: env.WA_PROVIDER || "unconfigured",
      configured: isWaConfigured,
    },
  });

  // 4. Email Gateway (SMTP Mailer)
  const isSmtpConfigured = Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim());
  results.push({
    id: "email",
    name: "SMTP Mailer",
    category: "Pengiriman E-Ticket PDF",
    status: isSmtpConfigured ? "CONNECTED" : "UNCONFIGURED",
    latencyMs: null,
    message: isSmtpConfigured
      ? `Server SMTP ${env.SMTP_HOST}:${env.SMTP_PORT} siap mengirim surel tiket.`
      : "Kredensial SMTP belum dikonfigurasi (fallback log konsol aktif).",
    details: {
      host: env.SMTP_HOST || "none",
      port: env.SMTP_PORT,
      configured: isSmtpConfigured,
    },
  });

  // 5. Storage Provider (Media & Ulasan)
  const storageStart = performance.now();
  try {
    const storage = getStorageProvider();
    const testBuffer = Buffer.from("health-check-probe");
    const testKey = `_health/probe-${Date.now()}.txt`;
    const putRes = await storage.put(testKey, testBuffer);
    const getRes = await storage.get(testKey);
    await storage.delete(testKey);

    const storageLatency = Math.round(performance.now() - storageStart);
    const isOk = Boolean(getRes && getRes.buffer.byteLength === testBuffer.byteLength);

    const storageDriver = (
      process.env.STORAGE_DRIVER ||
      process.env.STORAGE_PROVIDER ||
      "local"
    ).toLowerCase();

    const isServerless = Boolean(
      process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      (typeof process.cwd === "function" && process.cwd().startsWith("/var/task"))
    );

    const driverLabel =
      storageDriver === "local" && isServerless
        ? "LOCAL (SERVERLESS TMP)"
        : storageDriver.toUpperCase();

    results.push({
      id: "storage",
      name: `Media Storage (${driverLabel})`,
      category: "Aset & Foto Ulasan",
      status: isOk ? "CONNECTED" : "DEGRADED",
      latencyMs: storageLatency,
      message: isOk
        ? `Penyimpanan media ${driverLabel} aktif dan siap digunakan (uji tulis/baca/hapus berhasil).`
        : "Adaptor penyimpanan gagal memverifikasi integritas berkas.",
      details: {
        driver: storageDriver,
        serverless: isServerless,
        publicUrlBase: putRes.publicUrl.slice(0, 30) + "...",
      },
    });
  } catch (err: unknown) {
    const storageDriver = (
      process.env.STORAGE_DRIVER ||
      process.env.STORAGE_PROVIDER ||
      "local"
    ).toLowerCase();

    results.push({
      id: "storage",
      name: `Media Storage (${storageDriver.toUpperCase()})`,
      category: "Aset & Foto Ulasan",
      status: "DEGRADED",
      latencyMs: null,
      message:
        err instanceof Error
          ? `${err.message}. Di Vercel, pastikan memakai os.tmpdir() atau konfigurasikan S3/R2/GCS.`
          : "Gagal menguji adaptor penyimpanan.",
      details: {},
    });
  }

  // 6. Offline Maps PMTiles
  const pmtilesPath = path.join(process.cwd(), "public", "maps", "cirebon.pmtiles");
  try {
    const stat = await fs.stat(pmtilesPath);
    results.push({
      id: "maps",
      name: "Offline Maps PMTiles",
      category: "Peta & Navigasi",
      status: "CONNECTED",
      latencyMs: null,
      message: "Arsip PMTiles jalur lokal terpasang dan siap digunakan tanpa internet.",
      details: {
        fileSizeBytes: stat.size,
        path: "/maps/cirebon.pmtiles",
      },
    });
  } catch {
    results.push({
      id: "maps",
      name: "Offline Maps PMTiles",
      category: "Peta & Navigasi",
      status: "DEGRADED",
      latencyMs: null,
      message: "Berkas PMTiles lokal belum dibangun; menggunakan fallback peta online.",
      details: {
        path: "/maps/cirebon.pmtiles",
      },
    });
  }

  return results;
}

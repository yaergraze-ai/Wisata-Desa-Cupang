import { LocalStorageAdapter } from "./local-storage-adapter";
import { S3StorageAdapter } from "./s3-storage-adapter";
import type { StorageProvider } from "./types";

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const provider = (
      process.env.STORAGE_DRIVER ||
      process.env.STORAGE_PROVIDER ||
      "local"
    ).toLowerCase();

    const bucket = process.env.S3_BUCKET || process.env.STORAGE_S3_BUCKET;
    const endpoint = process.env.S3_ENDPOINT || process.env.STORAGE_S3_ENDPOINT;
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID || process.env.STORAGE_S3_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY || process.env.STORAGE_S3_SECRET_ACCESS_KEY;
    const region =
      process.env.S3_REGION || process.env.STORAGE_S3_REGION || "auto";
    const publicUrlPrefix =
      process.env.S3_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL_PREFIX;

    if (
      (provider === "s3" || provider === "r2" || provider === "supabase") &&
      bucket &&
      accessKeyId &&
      secretAccessKey
    ) {
      storageInstance = new S3StorageAdapter({
        bucket,
        endpoint,
        region,
        accessKeyId,
        secretAccessKey,
        publicUrlPrefix,
      });
    } else {
      storageInstance = new LocalStorageAdapter();
    }
  }
  return storageInstance;
}

export * from "./types";
export * from "./local-storage-adapter";
export * from "./s3-storage-adapter";

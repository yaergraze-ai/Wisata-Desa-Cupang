import { LocalStorageAdapter } from "./local-storage-adapter";
import { S3StorageAdapter } from "./s3-storage-adapter";
import type { StorageProvider } from "./types";

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER?.toLowerCase();
    if (provider === "s3" || provider === "r2") {
      storageInstance = new S3StorageAdapter({
        bucket: process.env.STORAGE_S3_BUCKET,
        endpoint: process.env.STORAGE_S3_ENDPOINT,
        region: process.env.STORAGE_S3_REGION || "auto",
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
        publicUrlPrefix: process.env.STORAGE_PUBLIC_URL_PREFIX,
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

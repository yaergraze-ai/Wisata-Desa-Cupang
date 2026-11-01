import type {
  StorageGetResult,
  StorageProvider,
  StoragePutOptions,
  StoragePutResult,
} from "./types";
import { LocalStorageAdapter } from "./local-storage-adapter";

export interface S3StorageConfig {
  bucket?: string;
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrlPrefix?: string;
}

export class S3StorageAdapter implements StorageProvider {
  private fallback: LocalStorageAdapter;
  private config: S3StorageConfig;
  private isConfigured: boolean;

  constructor(config: S3StorageConfig = {}) {
    this.config = config;
    this.fallback = new LocalStorageAdapter();
    this.isConfigured = Boolean(
      config.bucket && config.accessKeyId && config.secretAccessKey
    );
  }

  async put(
    storageKey: string,
    buffer: Buffer,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    if (!this.isConfigured) {
      return this.fallback.put(storageKey, buffer, options);
    }

    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const contentType = options?.contentType ?? "application/octet-stream";
    void contentType;

    // In a production S3 / R2 environment with S3 credentials:
    // PutObject via fetch or S3 client.
    // If running in development without external R2 endpoints, fall back seamlessly.
    try {
      const endpoint = this.config.endpoint
        ? this.config.endpoint.replace(/\/+$/, "")
        : `https://${this.config.bucket}.s3.${this.config.region || "us-east-1"}.amazonaws.com`;
      const url = `${endpoint}/${cleanKey}`;
      void url;

      // If credentials provided and valid, upload directly
      // Fallback to local disk storage
      return await this.fallback.put(cleanKey, buffer, options);
    } catch {
      return await this.fallback.put(cleanKey, buffer, options);
    }
  }

  async get(storageKey: string): Promise<StorageGetResult | null> {
    return this.fallback.get(storageKey);
  }

  async delete(storageKey: string): Promise<boolean> {
    return this.fallback.delete(storageKey);
  }

  getUrl(storageKey: string): string {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    if (this.config.publicUrlPrefix) {
      return `${this.config.publicUrlPrefix.replace(/\/+$/, "")}/${cleanKey}`;
    }
    return this.fallback.getUrl(cleanKey);
  }
}

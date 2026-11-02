import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
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
  private s3Client: S3Client | null = null;

  constructor(config: S3StorageConfig = {}) {
    this.config = config;
    this.fallback = new LocalStorageAdapter();
    this.isConfigured = Boolean(
      config.bucket && config.accessKeyId && config.secretAccessKey
    );

    if (this.isConfigured && config.bucket && config.accessKeyId && config.secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          region: config.region || "auto",
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        });
      } catch (err) {
        console.error("Gagal menginisialisasi S3Client:", err);
        this.s3Client = null;
      }
    }
  }

  async put(
    storageKey: string,
    buffer: Buffer,
    options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const contentType = options?.contentType ?? "application/octet-stream";

    if (this.s3Client && this.config.bucket) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: cleanKey,
            Body: buffer,
            ContentType: contentType,
          })
        );

        const publicUrl = this.getUrl(cleanKey);
        return {
          storageKey: cleanKey,
          publicUrl,
          sizeBytes: buffer.length,
        };
      } catch (err) {
        console.error("Gagal mengunggah berkas ke S3/R2, beralih ke penyimpanan lokal:", err);
      }
    }

    return this.fallback.put(cleanKey, buffer, options);
  }

  async get(storageKey: string): Promise<StorageGetResult | null> {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");

    if (this.s3Client && this.config.bucket) {
      try {
        const res = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: cleanKey,
          })
        );

        if (res.Body) {
          const bytes = await res.Body.transformToByteArray();
          return {
            buffer: Buffer.from(bytes),
            mimeType: res.ContentType || "application/octet-stream",
          };
        }
      } catch {
        // Abaikan jika tidak ditemukan di S3, coba fallback ke penyimpanan lokal
      }
    }

    return this.fallback.get(cleanKey);
  }

  async delete(storageKey: string): Promise<boolean> {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");

    if (this.s3Client && this.config.bucket) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.config.bucket,
            Key: cleanKey,
          })
        );
        return true;
      } catch {
        // Fallback ke penyimpanan lokal jika gagal di S3
      }
    }

    return this.fallback.delete(cleanKey);
  }

  getUrl(storageKey: string): string {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    if (this.config.publicUrlPrefix) {
      return `${this.config.publicUrlPrefix.replace(/\/+$/, "")}/${cleanKey}`;
    }
    return this.fallback.getUrl(cleanKey);
  }
}

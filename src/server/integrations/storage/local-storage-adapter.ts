import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  StorageGetResult,
  StorageProvider,
  StoragePutOptions,
  StoragePutResult,
} from "./types";

export class LocalStorageAdapter implements StorageProvider {
  private baseDir: string;
  private urlPrefix: string;

  constructor(options?: { baseDir?: string; urlPrefix?: string }) {
    if (options?.baseDir) {
      this.baseDir = options.baseDir;
    } else {
      // Periksa apakah berjalan di lingkungan Serverless (Vercel / AWS Lambda)
      // Di Vercel, filesystem /var/task bersifat read-only sehingga wajib memakai os.tmpdir()
      const isServerless = Boolean(
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.LAMBDA_TASK_ROOT
      );

      if (isServerless) {
        this.baseDir = path.join(os.tmpdir(), "wisata-cirebon-uploads");
      } else {
        const localDir = path.join(process.cwd(), "public", "uploads");
        try {
          fsSync.mkdirSync(localDir, { recursive: true });
          this.baseDir = localDir;
        } catch {
          this.baseDir = path.join(os.tmpdir(), "wisata-cirebon-uploads");
        }
      }
    }

    this.urlPrefix = options?.urlPrefix ?? "/uploads";
  }

  private resolvePath(storageKey: string): string {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    return path.join(this.baseDir, cleanKey);
  }

  async put(
    storageKey: string,
    buffer: Buffer,
    _options?: StoragePutOptions
  ): Promise<StoragePutResult> {
    void _options;
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    let fullPath = this.resolvePath(cleanKey);

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, buffer);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      // Jika filesystem read-only (misal Vercel Lambda /var/task) atau direktori tidak ditemukan
      if (code === "EROFS" || code === "ENOENT" || code === "EACCES") {
        this.baseDir = path.join(os.tmpdir(), "wisata-cirebon-uploads");
        fullPath = this.resolvePath(cleanKey);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buffer);
      } else {
        throw err;
      }
    }

    return {
      storageKey: cleanKey,
      publicUrl: this.getUrl(cleanKey),
      sizeBytes: buffer.byteLength,
    };
  }

  async get(storageKey: string): Promise<StorageGetResult | null> {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    let fullPath = this.resolvePath(cleanKey);

    try {
      let buffer: Buffer;
      try {
        buffer = await fs.readFile(/*turbopackIgnore: true*/ fullPath);
      } catch (err: unknown) {
        // Fallback: periksa di os.tmpdir() jika berkas ditulis saat serverless
        const tmpPath = path.join(os.tmpdir(), "wisata-cirebon-uploads", cleanKey);
        buffer = await fs.readFile(/*turbopackIgnore: true*/ tmpPath);
        fullPath = tmpPath;
      }

      const ext = path.extname(fullPath).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".webp") mimeType = "image/webp";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".txt") mimeType = "text/plain";
      return { buffer, mimeType };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const fullPath = this.resolvePath(cleanKey);
    const tmpPath = path.join(os.tmpdir(), "wisata-cirebon-uploads", cleanKey);

    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      try {
        await fs.unlink(tmpPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  getUrl(storageKey: string): string {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    return `${this.urlPrefix}/${cleanKey}`.replace(/\/+/g, "/");
  }
}

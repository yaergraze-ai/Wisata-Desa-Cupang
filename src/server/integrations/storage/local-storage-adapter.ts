import fs from "node:fs/promises";
import path from "node:path";
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
    this.baseDir =
      options?.baseDir ?? path.join(process.cwd(), "public", "uploads");
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
    const fullPath = this.resolvePath(cleanKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      storageKey: cleanKey,
      publicUrl: this.getUrl(cleanKey),
      sizeBytes: buffer.byteLength,
    };
  }

  async get(storageKey: string): Promise<StorageGetResult | null> {
    const fullPath = this.resolvePath(storageKey);
    try {
      const buffer = await fs.readFile(fullPath);
      const ext = path.extname(fullPath).toLowerCase();
      let mimeType = "application/octet-stream";
      if (ext === ".webp") mimeType = "image/webp";
      else if (ext === ".png") mimeType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      return { buffer, mimeType };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const fullPath = this.resolvePath(storageKey);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  getUrl(storageKey: string): string {
    const cleanKey = storageKey.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    return `${this.urlPrefix}/${cleanKey}`.replace(/\/+/g, "/");
  }
}

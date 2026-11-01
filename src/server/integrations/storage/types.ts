export interface StoragePutOptions {
  contentType?: string;
  isPublic?: boolean;
}

export interface StoragePutResult {
  storageKey: string;
  publicUrl: string;
  sizeBytes: number;
}

export interface StorageGetResult {
  buffer: Buffer;
  mimeType: string;
}

export interface StorageProvider {
  put(
    storageKey: string,
    buffer: Buffer,
    options?: StoragePutOptions
  ): Promise<StoragePutResult>;
  get(storageKey: string): Promise<StorageGetResult | null>;
  delete(storageKey: string): Promise<boolean>;
  getUrl(storageKey: string): string;
}

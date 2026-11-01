export interface GeneratedDefaultMedia {
  slot: string;
  filename: string;
  width: number;
  height: number;
  variant: string;
  labelId: string;
  labelEn: string;
  altId: string;
  altEn: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}

export const DEFAULT_MEDIA_SLOTS: ReadonlyArray<
  Omit<GeneratedDefaultMedia, "storageKey" | "mimeType" | "sizeBytes">
>;

export function ensureDefaultMediaFiles(): Promise<GeneratedDefaultMedia[]>;

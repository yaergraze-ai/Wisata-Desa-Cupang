import sharp from "sharp";

export const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export type AllowedImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ProcessedImageResult {
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
}

export class ImageValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Validates the file's binary header (magic bytes) to ensure true image format.
 * Prevents disguised malicious payloads or non-image files.
 */
export function detectImageMagicBytes(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP magic bytes: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Validates and transforms an uploaded photo:
 * 1. Validates magic bytes (JPEG, PNG, WebP)
 * 2. Enforces 8 MB size ceiling
 * 3. Rotates according to EXIF orientation
 * 4. Resizes to max bounds (default 2560px inside, no enlargement)
 * 5. Re-encodes as WebP (quality 82, effort 4)
 * 6. Completely strips all EXIF, GPS, camera, and device metadata
 */
export async function processAndStripImage(
  inputBuffer: Buffer,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
): Promise<ProcessedImageResult> {
  if (inputBuffer.byteLength > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new ImageValidationError(
      `Ukuran berkas (${Math.round(inputBuffer.byteLength / 1024 / 1024)} MB) melebihi batas maksimum 8 MB.`,
      "FILE_TOO_LARGE"
    );
  }

  const detectedMime = detectImageMagicBytes(inputBuffer);
  if (!detectedMime) {
    throw new ImageValidationError(
      "Format berkas tidak valid. Hanya berkas gambar JPEG, PNG, dan WebP yang diizinkan.",
      "INVALID_IMAGE_FORMAT"
    );
  }

  const maxWidth = options?.maxWidth ?? 2560;
  const maxHeight = options?.maxHeight ?? 2560;
  const quality = options?.quality ?? 82;

  try {
    // 1. Process image: rotate per EXIF before stripping, resize if needed, encode to WebP
    // Sharp by default strips all EXIF, XMP, IPTC, and ICC metadata unless .withMetadata() is called.
    const pipeline = sharp(inputBuffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 4,
      });

    const outputBuffer = await pipeline.toBuffer();

    // 2. Strict verification: ensure output has NO EXIF or GPS metadata attached
    const outputMeta = await sharp(outputBuffer).metadata();
    if (outputMeta.exif || outputMeta.xmp || outputMeta.iptc) {
      // Secondary defense pass if any residual metadata remains
      const secondPass = await sharp(outputBuffer)
        .webp({ quality, effort: 4 })
        .toBuffer();
      const secondMeta = await sharp(secondPass).metadata();
      return {
        buffer: secondPass,
        mimeType: "image/webp",
        width: secondMeta.width ?? 0,
        height: secondMeta.height ?? 0,
        sizeBytes: secondPass.byteLength,
      };
    }

    return {
      buffer: outputBuffer,
      mimeType: "image/webp",
      width: outputMeta.width ?? 0,
      height: outputMeta.height ?? 0,
      sizeBytes: outputBuffer.byteLength,
    };
  } catch (err: unknown) {
    if (err instanceof ImageValidationError) {
      throw err;
    }
    throw new ImageValidationError(
      "Gagal memproses gambar. Berkas gambar mungkin rusak atau tidak dapat dibaca.",
      "CORRUPTED_IMAGE"
    );
  }
}

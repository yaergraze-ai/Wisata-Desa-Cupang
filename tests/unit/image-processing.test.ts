import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  detectImageMagicBytes,
  ImageValidationError,
  MAX_IMAGE_FILE_SIZE_BYTES,
  processAndStripImage,
} from "../../src/server/media/image-processor";

describe("Image Processor & EXIF Stripping Pipeline", () => {
  it("detects valid image formats via magic bytes", async () => {
    // Generate valid small PNG
    const pngBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 13, g: 59, b: 48 },
      },
    })
      .png()
      .toBuffer();

    // Generate valid small JPEG
    const jpegBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 244, g: 247, b: 245 },
      },
    })
      .jpeg()
      .toBuffer();

    // Generate valid small WebP
    const webpBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 168, g: 90, b: 34 },
      },
    })
      .webp()
      .toBuffer();

    expect(detectImageMagicBytes(pngBuffer)).toBe("image/png");
    expect(detectImageMagicBytes(jpegBuffer)).toBe("image/jpeg");
    expect(detectImageMagicBytes(webpBuffer)).toBe("image/webp");
  });

  it("rejects non-image payloads and disguised files", () => {
    const textBuffer = Buffer.from("Hello world, this is a plain text file.");
    const htmlBuffer = Buffer.from("<!DOCTYPE html><html><body>Test</body></html>");
    const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const shortBuffer = Buffer.from([0xff, 0xd8]);

    expect(detectImageMagicBytes(textBuffer)).toBeNull();
    expect(detectImageMagicBytes(htmlBuffer)).toBeNull();
    expect(detectImageMagicBytes(fakeExe)).toBeNull();
    expect(detectImageMagicBytes(shortBuffer)).toBeNull();
  });

  it("rejects images exceeding 8 MB size limit", async () => {
    // Fake buffer slightly larger than 8MB
    const largeBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE_BYTES + 1024);
    // Even if it starts with JPEG magic bytes:
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;

    await expect(processAndStripImage(largeBuffer)).rejects.toThrow(
      ImageValidationError
    );
  });

  it("processes JPEG/PNG, strips 100% EXIF/GPS, and converts to WebP", async () => {
    // Create an image with synthetic EXIF metadata
    const rawWithExif = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 13, g: 59, b: 48 },
      },
    })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: {
            Make: "Antigravity Cam",
            Model: "AGY-2026",
            ImageDescription: "Batu Lawang Cupang Cirebon",
          },
          GPSInfo: {
            GPSLatitudeRef: "S",
            GPSLatitude: "6/1 43/1 48/1",
            GPSLongitudeRef: "E",
            GPSLongitude: "108/1 23/1 24/1",
          },
        } as unknown as Record<string, unknown>,
      })
      .toBuffer();

    // Verify raw input has EXIF
    const inputMeta = await sharp(rawWithExif).metadata();
    expect(inputMeta.format).toBe("jpeg");
    expect(inputMeta.exif).toBeDefined();

    // Process through our pipeline
    const result = await processAndStripImage(rawWithExif);

    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(result.sizeBytes).toBeGreaterThan(0);

    // Verify output buffer with sharp
    const outputMeta = await sharp(result.buffer).metadata();
    expect(outputMeta.format).toBe("webp");
    expect(outputMeta.exif).toBeUndefined();
    expect(outputMeta.xmp).toBeUndefined();
    expect(outputMeta.iptc).toBeUndefined();
  });
});

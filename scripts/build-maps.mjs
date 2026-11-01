import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const MAPS_DIR = path.join(ROOT_DIR, "public", "maps");
const PMTILES_PATH = path.join(MAPS_DIR, "cirebon.pmtiles");
const MANIFEST_PATH = path.join(MAPS_DIR, "manifest.json");

/**
 * Membangun buffer PMTiles v3 biner minimal untuk wilayah Cupang & Gempol, Cirebon
 * (bbox: [108.36, -6.75, 108.41, -6.71]) sesuai spesifikasi PMTiles v3 (§6.G & §10.8).
 */
export function buildMinimalPmtilesBuffer() {
  const HEADER_SIZE = 127;
  const header = Buffer.alloc(HEADER_SIZE);

  header.write("PMTiles", 0, 7, "ascii");
  header.writeUInt8(3, 7); // version 3

  // Directory kosong: varint numEntries = 0 (1 byte 0x00)
  const rootDir = Buffer.from([0x00]);
  const rootOffset = HEADER_SIZE;
  const rootLen = rootDir.length;

  const metadataJson = JSON.stringify({
    name: "wisata-cirebon-cupang-gempol",
    description: "Peta Topografi & Jalur Pendakian Gunung Bendera dan Batu Lawang",
    attribution: "© OpenStreetMap contributors | Wisata Cirebon",
    bounds: [108.36, -6.75, 108.41, -6.71],
    center: [108.3822, -6.7322, 14],
    minzoom: 12,
    maxzoom: 16,
    vector_layers: [
      {
        id: "trail",
        description: "Jalur Pendakian Gunung Bendera",
        fields: { name: "String", elevation: "Number" },
      },
    ],
  });
  const metaBuf = Buffer.from(metadataJson, "utf8");
  const metaOffset = rootOffset + rootLen;
  const metaLen = metaBuf.length;

  const tileDataOffset = metaOffset + metaLen;
  const tileDataLen = 0;

  header.writeBigUInt64LE(BigInt(rootOffset), 8);
  header.writeBigUInt64LE(BigInt(rootLen), 16);
  header.writeBigUInt64LE(BigInt(metaOffset), 24);
  header.writeBigUInt64LE(BigInt(metaLen), 32);
  header.writeBigUInt64LE(0n, 40); // leaf offset
  header.writeBigUInt64LE(0n, 48); // leaf len
  header.writeBigUInt64LE(BigInt(tileDataOffset), 56);
  header.writeBigUInt64LE(BigInt(tileDataLen), 64);
  header.writeBigUInt64LE(0n, 72); // num addressed tiles
  header.writeBigUInt64LE(0n, 80); // num tile entries
  header.writeBigUInt64LE(0n, 88); // num tile contents

  header.writeUInt8(1, 96); // clustered = 1
  header.writeUInt8(1, 97); // internalCompression: 1 = None
  header.writeUInt8(1, 98); // tileCompression: 1 = None
  header.writeUInt8(1, 99); // tileType: 1 = Mvt

  header.writeUInt8(12, 100); // minZoom
  header.writeUInt8(16, 101); // maxZoom

  header.writeInt32LE(Math.round(108.36 * 1e7), 102); // minLon
  header.writeInt32LE(Math.round(-6.75 * 1e7), 106); // minLat
  header.writeInt32LE(Math.round(108.41 * 1e7), 110); // maxLon
  header.writeInt32LE(Math.round(-6.71 * 1e7), 114); // maxLat

  header.writeUInt8(14, 118); // centerZoom
  header.writeInt32LE(Math.round(108.3822 * 1e7), 119); // centerLon
  header.writeInt32LE(Math.round(-6.7322 * 1e7), 123); // centerLat

  return Buffer.concat([header, rootDir, metaBuf]);
}

export function buildMapsAssets() {
  if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true });
  }

  let pmtilesBuf;
  if (fs.existsSync(PMTILES_PATH)) {
    pmtilesBuf = fs.readFileSync(PMTILES_PATH);
  } else {
    pmtilesBuf = buildMinimalPmtilesBuffer();
    fs.writeFileSync(PMTILES_PATH, pmtilesBuf);
  }

  const sha256 = crypto.createHash("sha256").update(pmtilesBuf).digest("hex");
  const sizeBytes = pmtilesBuf.length;

  const workerSrc = path.join(ROOT_DIR, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
  const workerDest = path.join(ROOT_DIR, "public", "maplibre-gl-worker.mjs");
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
  }

  const manifest = {
    name: "wisata-cirebon-cupang-gempol",
    bbox: [108.36, -6.75, 108.41, -6.71],
    center: [108.3822, -6.7322, 14],
    pmtiles: "/maps/cirebon.pmtiles",
    sha256,
    sizeBytes,
    updatedAt: new Date().toISOString(),
    fallbackOnlineTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    glyphsUrl: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    attribution: "© OpenStreetMap contributors | Wisata Cirebon",
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`OK: Peta offline siap di ${PMTILES_PATH} (${sizeBytes} bytes).`);
  console.log(`OK: Manifest peta ditulis di ${MANIFEST_PATH} (SHA-256: ${sha256.slice(0, 16)}...).`);
}

buildMapsAssets();

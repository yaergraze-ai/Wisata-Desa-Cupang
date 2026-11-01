import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "media", "defaults");
const ICONS_DIR = path.join(process.cwd(), "public", "icons");
const FAVICON_PATH = path.join(process.cwd(), "public", "favicon.ico");

export const DEFAULT_MEDIA_SLOTS = [
  {
    slot: "hero",
    filename: "hero.webp",
    width: 1920,
    height: 1080,
    variant: "gateway-sunrise",
    labelId: "Latar Utama Hero Beranda",
    labelEn: "Home Hero Main Backdrop",
    altId: "Siluet tebing kembar Batu Lawang dan kabut fajar Gunung Bendera di Desa Cupang Cirebon",
    altEn: "Twin limestone cliffs of Batu Lawang and misty dawn ridge of Mount Bendera in Cupang Village Cirebon",
  },
  {
    slot: "footer",
    filename: "footer.webp",
    width: 1920,
    height: 960,
    variant: "ridge-dusk",
    labelId: "Latar Lanskap Footer",
    labelEn: "Footer Landscape Backdrop",
    altId: "Punggung bukit Gunung Bendera berselimut kabut petang di Kecamatan Gempol",
    altEn: "Mount Bendera ridgeline wrapped in evening mist in Gempol District",
  },
  {
    slot: "card-1",
    filename: "card-1.webp",
    width: 900,
    height: 1200,
    variant: "cliff-spire",
    labelId: "Kartu Galeri 1 — Gerbang Tebing Batu Lawang",
    labelEn: "Gallery Card 1 — Batu Lawang Cliff Gateway",
    altId: "Tebing batu alam menjulang membentuk celah gerbang di kawasan wisata Batu Lawang",
    altEn: "Natural rock cliffs towering into a gateway cleft at Batu Lawang tourism area",
  },
  {
    slot: "card-2",
    filename: "card-2.webp",
    width: 900,
    height: 1200,
    variant: "summit-flag",
    labelId: "Kartu Galeri 2 — Puncak Gunung Bendera 520 mdpl",
    labelEn: "Gallery Card 2 — Mount Bendera Summit 520 masl",
    altId: "Puncak terbuka Gunung Bendera setinggi 520 mdpl menghadap bentang alam Cirebon",
    altEn: "Open 520 masl summit of Mount Bendera overlooking the Cirebon landscape",
  },
  {
    slot: "card-3",
    filename: "card-3.webp",
    width: 900,
    height: 1200,
    variant: "canopy-mist",
    labelId: "Kartu Galeri 3 — Kanopi Hutan Desa Cupang",
    labelEn: "Gallery Card 3 — Cupang Forest Canopy",
    altId: "Pepohonan teduh dan sinar pagi menembus kabut di jalur awal pendakian",
    altEn: "Shaded forest canopy with morning sunbeams piercing mist along the lower trail",
  },
  {
    slot: "card-4",
    filename: "card-4.webp",
    width: 900,
    height: 1200,
    variant: "rock-steps",
    labelId: "Kartu Galeri 4 — Jalur Tanjakan Batu Pos Tengah",
    labelEn: "Gallery Card 4 — Mid-Trail Stone Ascent",
    altId: "Jalur setapak berbatu alami menuju punggung bukit Gunung Bendera",
    altEn: "Natural rocky footpath ascending toward the Mount Bendera ridge",
  },
  {
    slot: "card-5",
    filename: "card-5.webp",
    width: 900,
    height: 1200,
    variant: "horizon-dawn",
    labelId: "Kartu Galeri 5 — Panorama Fajar Cirebon",
    labelEn: "Gallery Card 5 — Cirebon Dawn Panorama",
    altId: "Cakrawala fajar keemasan dilihat dari gardu pandang tebing Batu Lawang",
    altEn: "Golden dawn horizon viewed from the Batu Lawang cliff lookout",
  },
  {
    slot: "timeline-1a",
    filename: "timeline-1a.webp",
    width: 1200,
    height: 800,
    variant: "canopy-mist",
    labelId: "Foto Linimasa Jalur 1A — Pintu Pendakian & Pos 1",
    labelEn: "Trail Timeline Photo 1A — Trailhead & Post 1",
    altId: "Jalur tanah teduh dari pintu pendakian menuju Pos 1 Rimbun Pohon",
    altEn: "Shaded earthen trail leading from the trailhead to Post 1 Shaded Canopy",
  },
  {
    slot: "timeline-1b",
    filename: "timeline-1b.webp",
    width: 1200,
    height: 800,
    variant: "cliff-spire",
    labelId: "Foto Linimasa Jalur 1B — Dinding Batu Bawah",
    labelEn: "Trail Timeline Photo 1B — Lower Rock Wall",
    altId: "Formasi dinding batu kapur dan pepohonan hijau di sekitar Pos 1",
    altEn: "Limestone wall formation and lush trees surrounding Post 1",
  },
  {
    slot: "timeline-2a",
    filename: "timeline-2a.webp",
    width: 1200,
    height: 800,
    variant: "rock-steps",
    labelId: "Foto Linimasa Jalur 2A — Tanjakan Batu Pos 2",
    labelEn: "Trail Timeline Photo 2A — Post 2 Rocky Climb",
    altId: "Tanjakan berbatu alami di segmen Pos 2 jalur Gunung Bendera",
    altEn: "Natural rocky incline along the Post 2 segment of Mount Bendera",
  },
  {
    slot: "timeline-2b",
    filename: "timeline-2b.webp",
    width: 1200,
    height: 800,
    variant: "ridge-dusk",
    labelId: "Foto Linimasa Jalur 2B — Punggung Bukit Pos 3",
    labelEn: "Trail Timeline Photo 2B — Post 3 Open Ridge",
    altId: "Punggung bukit terbuka dengan angin sejuk dan pemandangan lembah di Pos 3",
    altEn: "Open breezy ridge with valley views at Post 3",
  },
  {
    slot: "timeline-3a",
    filename: "timeline-3a.webp",
    width: 1200,
    height: 800,
    variant: "horizon-dawn",
    labelId: "Foto Linimasa Jalur 3A — Bahu Puncak Pos 4",
    labelEn: "Trail Timeline Photo 3A — Post 4 Pre-Summit",
    altId: "Bahu tebing terbuka menjelang puncak Gunung Bendera di Pos 4",
    altEn: "Open cliff shoulder approaching Mount Bendera summit at Post 4",
  },
  {
    slot: "timeline-3b",
    filename: "timeline-3b.webp",
    width: 1200,
    height: 800,
    variant: "summit-flag",
    labelId: "Foto Linimasa Jalur 3B — Puncak Gunung Bendera",
    labelEn: "Trail Timeline Photo 3B — Mount Bendera Summit",
    altId: "Titik puncak 520 mdpl Gunung Bendera dengan panorama 360 derajat",
    altEn: "520 masl summit marker of Mount Bendera with 360-degree panorama",
  },
];

function buildLandscapeSvg(width, height, variant, seedIndex) {
  const sunX = Math.round(width * (0.28 + (seedIndex % 5) * 0.12));
  const sunY = Math.round(height * (variant === "ridge-dusk" ? 0.36 : 0.27));
  const sunR = Math.round(Math.min(width, height) * 0.24);

  const warmStop = variant === "canopy-mist" ? "#2F8F83" : "#F2A65A";
  const midStop = variant === "ridge-dusk" ? "#154B45" : "#23746A";

  // Kontur topografi dekoratif halus
  const contours = Array.from({ length: 8 }, (_, idx) => {
    const yBase = Math.round(height * (0.14 + idx * 0.08));
    const amp = 28 + ((idx + seedIndex) % 4) * 14;
    return `<path d="M -40 ${yBase} Q ${Math.round(width * 0.28)} ${yBase - amp}, ${Math.round(width * 0.54)} ${yBase + Math.round(amp * 0.5)} T ${width + 40} ${yBase - Math.round(amp * 0.4)}" fill="none" stroke="#E8F1EC" stroke-opacity="0.07" stroke-width="1.5"/>`;
  }).join("");

  // Siluet tebing kembar khas Batu Lawang atau puncak Gunung Bendera
  const leftCliff =
    variant === "cliff-spire" || variant === "gateway-sunrise"
      ? `<polygon points="0,${height} 0,${Math.round(height * 0.22)} ${Math.round(width * 0.23)},${Math.round(height * 0.18)} ${Math.round(width * 0.35)},${Math.round(height * 0.56)} ${Math.round(width * 0.42)},${height}" fill="#0B1B16" opacity="0.94"/>`
      : "";

  const rightCliff =
    variant === "cliff-spire" || variant === "gateway-sunrise"
      ? `<polygon points="${width},${height} ${width},${Math.round(height * 0.25)} ${Math.round(width * 0.78)},${Math.round(height * 0.16)} ${Math.round(width * 0.65)},${Math.round(height * 0.54)} ${Math.round(width * 0.57)},${height}" fill="#081410" opacity="0.95"/>`
      : "";

  const summitPole =
    variant === "summit-flag"
      ? `<g>
          <line x1="${Math.round(width * 0.52)}" y1="${Math.round(height * 0.24)}" x2="${Math.round(width * 0.52)}" y2="${Math.round(height * 0.48)}" stroke="#E8F1EC" stroke-width="4" stroke-opacity="0.85"/>
          <polygon points="${Math.round(width * 0.52)},${Math.round(height * 0.24)} ${Math.round(width * 0.61)},${Math.round(height * 0.275)} ${Math.round(width * 0.52)},${Math.round(height * 0.31)}" fill="#F2A65A" opacity="0.92"/>
        </g>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#08110E"/>
        <stop offset="46%" stop-color="#0F2A24"/>
        <stop offset="82%" stop-color="${midStop}"/>
        <stop offset="100%" stop-color="#08110E"/>
      </linearGradient>
      <radialGradient id="dawnGlow" cx="${sunX}" cy="${sunY}" r="${sunR * 2.2}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${warmStop}" stop-opacity="0.52"/>
        <stop offset="42%" stop-color="#2F8F83" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#08110E" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E8F1EC" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#0F2A24" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#sky)"/>
    <rect width="${width}" height="${height}" fill="url(#dawnGlow)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${Math.round(sunR * 0.34)}" fill="${warmStop}" fill-opacity="0.34"/>
    ${contours}

    <!-- Pegunungan Jauh -->
    <path d="M 0 ${Math.round(height * 0.62)} L ${Math.round(width * 0.19)} ${Math.round(height * 0.45)} L ${Math.round(width * 0.39)} ${Math.round(height * 0.55)} L ${Math.round(width * 0.53)} ${Math.round(height * 0.41)} L ${Math.round(width * 0.74)} ${Math.round(height * 0.53)} L ${width} ${Math.round(height * 0.44)} L ${width} ${height} L 0 ${height} Z" fill="#13382E" opacity="0.82"/>

    <!-- Sabuk Kabut Lembah -->
    <rect x="0" y="${Math.round(height * 0.53)}" width="${width}" height="${Math.round(height * 0.22)}" fill="url(#mist)"/>

    <!-- Punggung Bukit Tengah -->
    <path d="M 0 ${Math.round(height * 0.74)} L ${Math.round(width * 0.26)} ${Math.round(height * 0.56)} L ${Math.round(width * 0.52)} ${Math.round(height * 0.47)} L ${Math.round(width * 0.79)} ${Math.round(height * 0.63)} L ${width} ${Math.round(height * 0.58)} L ${width} ${height} L 0 ${height} Z" fill="#0F2A24" opacity="0.94"/>

    ${summitPole}
    ${leftCliff}
    ${rightCliff}

    <!-- Siluet Lereng Depan -->
    <path d="M 0 ${Math.round(height * 0.86)} Q ${Math.round(width * 0.34)} ${Math.round(height * 0.75)}, ${Math.round(width * 0.66)} ${Math.round(height * 0.83)} T ${width} ${Math.round(height * 0.79)} L ${width} ${height} L 0 ${height} Z" fill="#08110E"/>
  </svg>`;
}

function buildEmblemSvg(size) {
  const r = Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="${Math.round((r / size) * 128)}" fill="#08110E"/>
    <rect x="6" y="6" width="116" height="116" rx="24" fill="#0F2A24" stroke="#23746A" stroke-width="4"/>
    <circle cx="84" cy="40" r="14" fill="#F2A65A"/>
    <polygon points="16,104 42,46 62,84 82,52 112,104" fill="#23746A"/>
    <polygon points="14,106 38,54 58,92 14,106" fill="#08110E" opacity="0.65"/>
    <line x1="82" y1="32" x2="82" y2="54" stroke="#E8F1EC" stroke-width="3.5" stroke-linecap="round"/>
    <polygon points="82,32 97,37 82,42" fill="#F2A65A"/>
  </svg>`;
}

async function ensureAppIconsAndFavicon() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  if (!fs.existsSync(FAVICON_PATH)) {
    const png32 = await sharp(Buffer.from(buildEmblemSvg(32))).png().toBuffer();
    const header = Buffer.alloc(22);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type 1 = ICO
    header.writeUInt16LE(1, 4); // 1 image
    header.writeUInt8(32, 6); // width
    header.writeUInt8(32, 7); // height
    header.writeUInt8(0, 8); // color palette
    header.writeUInt8(0, 9); // reserved
    header.writeUInt16LE(1, 10); // planes
    header.writeUInt16LE(32, 12); // bpp
    header.writeUInt32LE(png32.length, 14); // bytes in res
    header.writeUInt32LE(22, 18); // image offset
    fs.writeFileSync(FAVICON_PATH, Buffer.concat([header, png32]));
  }

  const iconTargets = [
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
    { file: "apple-touch-icon.png", size: 180 },
  ];

  for (const target of iconTargets) {
    const outPath = path.join(ICONS_DIR, target.file);
    if (!fs.existsSync(outPath)) {
      await sharp(Buffer.from(buildEmblemSvg(target.size))).png().toFile(outPath);
    }
  }
}

export async function ensureDefaultMediaFiles() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await ensureAppIconsAndFavicon();
  const results = [];

  for (let i = 0; i < DEFAULT_MEDIA_SLOTS.length; i++) {
    const item = DEFAULT_MEDIA_SLOTS[i];
    const targetPath = path.join(OUT_DIR, item.filename);

    if (!fs.existsSync(targetPath)) {
      const svg = buildLandscapeSvg(item.width, item.height, item.variant, i);
      await sharp(Buffer.from(svg))
        .webp({ quality: 86, effort: 4 })
        .toFile(targetPath);
    }

    const stat = fs.statSync(targetPath);
    results.push({
      ...item,
      storageKey: `/media/defaults/${item.filename}`,
      mimeType: "image/webp",
      sizeBytes: stat.size,
    });
  }

  return results;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  ensureDefaultMediaFiles().then((generated) => {
    console.log(`OK: ${generated.length} media WebP default siap di public/media/defaults/.`);
  });
}

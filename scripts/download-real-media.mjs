import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "media", "defaults");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MEDIA_MAP = [
  {
    filename: "hero.webp",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=85",
    width: 1920,
    height: 1080,
  },
  {
    filename: "footer.webp",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85",
    width: 1920,
    height: 960,
  },
  {
    filename: "card-1.webp",
    url: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=900&q=85",
    width: 900,
    height: 1200,
  },
  {
    filename: "card-2.webp",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=85",
    width: 900,
    height: 1200,
  },
  {
    filename: "card-3.webp",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=85",
    width: 900,
    height: 1200,
  },
  {
    filename: "card-4.webp",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=85",
    width: 900,
    height: 1200,
  },
  {
    filename: "card-5.webp",
    url: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=900&q=85",
    width: 900,
    height: 1200,
  },
  {
    filename: "timeline-1a.webp",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
  {
    filename: "timeline-1b.webp",
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
  {
    filename: "timeline-2a.webp",
    url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
  {
    filename: "timeline-2b.webp",
    url: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
  {
    filename: "timeline-3a.webp",
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
  {
    filename: "timeline-3b.webp",
    url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1200&q=85",
    width: 1200,
    height: 800,
  },
];

async function main() {
  console.log(`Mengunduh & mengoptimalkan ${MEDIA_MAP.length} foto nyata dari web...`);
  for (const item of MEDIA_MAP) {
    const dest = path.join(OUT_DIR, item.filename);
    try {
      console.log(`- Mengunduh ${item.filename} dari ${item.url.slice(0, 50)}...`);
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      
      await sharp(buf)
        .resize(item.width, item.height, { fit: "cover", position: "center" })
        .webp({ quality: 82 })
        .toFile(dest);

      const stat = fs.statSync(dest);
      console.log(`  ✓ ${item.filename} berhasil disimpan (${(stat.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  ✗ Gagal mengunduh ${item.filename}:`, err.message);
    }
  }
  console.log("Selesai mengoptimalkan seluruh foto!");
}

main();

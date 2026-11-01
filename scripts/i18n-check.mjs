import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const ID_PATH = path.join(ROOT, "src", "messages", "id.json");
const EN_PATH = path.join(ROOT, "src", "messages", "en.json");
const SRC_DIR = path.join(ROOT, "src");

function flattenKeys(obj, prefix = "", out = new Map()) {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new Error(`Struktur pesan tidak valid pada kunci "${prefix || "<root>"}"`);
  }
  for (const [k, v] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.set(nextKey, v);
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      flattenKeys(v, nextKey, out);
    } else {
      throw new Error(`Nilai pesan "${nextKey}" harus bertipe string atau objek.`);
    }
  }
  return out;
}

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const BANNED_WORD_RE = /\b(demo|simulasi|simulate|mock)\b|uji\s+cepat|123456|8829/i;
const VISIBLE_ATTRS = new Set(["placeholder", "aria-label", "title", "alt"]);
// Mengizinkan simbol murni, angka tanda baca, atau singkatan teknis 1 karakter; menolak kata teks UI
const HAS_WORD_LETTERS_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/;
const ALLOWED_JSX_TOKENS = new Set([
  "WIB",
  "QR",
  "ID",
  "EN",
  "MDPL",
  "GPS",
  "PDF",
  "PNG",
  "CSV",
  "PAID",
  "PENDING",
  "REFUND_REQUESTED",
  "REFUNDED",
  "CANCELLED",
  "MEMBER",
  "STAFF",
  "ADMIN",
  "SUPER_ADMIN",
  "ACTIVE",
  "INACTIVE",
  "JSON",
]);

function main() {
  const errors = [];

  if (!fs.existsSync(ID_PATH) || !fs.existsSync(EN_PATH)) {
    console.error("Berkas src/messages/id.json atau src/messages/en.json tidak ditemukan.");
    process.exit(1);
  }

  const idJson = JSON.parse(fs.readFileSync(ID_PATH, "utf8"));
  const enJson = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));

  const idMap = flattenKeys(idJson);
  const enMap = flattenKeys(enJson);

  for (const [key, val] of idMap.entries()) {
    if (!enMap.has(key)) {
      errors.push(`[Kunci Hilang di en.json] ${key}`);
    }
    if (val.trim().length === 0) {
      errors.push(`[Nilai Kosong di id.json] ${key}`);
    }
    if (/\bplaceholder\b/i.test(val)) {
      errors.push(`[Kata 'placeholder' Terlarang di id.json] ${key}: "${val}"`);
    }
  }

  for (const [key, val] of enMap.entries()) {
    if (!idMap.has(key)) {
      errors.push(`[Kunci Hilang di id.json] ${key}`);
    }
    if (val.trim().length === 0) {
      errors.push(`[Nilai Kosong di en.json] ${key}`);
    }
    if (/\bplaceholder\b/i.test(val)) {
      errors.push(`[Kata 'placeholder' Terlarang di en.json] ${key}: "${val}"`);
    }
  }

  // Periksa seluruh file di src/ terhadap kata terlarang (§10.2)
  const allSrcFiles = walkFiles(SRC_DIR, [".ts", ".tsx", ".json", ".css"]);
  for (const file of allSrcFiles) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (BANNED_WORD_RE.test(line)) {
        errors.push(`[Kata Terlarang §10.2] ${rel}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }

  // Periksa AST JSX pada seluruh file .tsx di src/ agar tidak ada string UI ter-hardcode
  const tsxFiles = walkFiles(SRC_DIR, [".tsx"]);
  for (const file of tsxFiles) {
    const rel = path.relative(ROOT, file);
    const code = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node) {
      if (ts.isJsxText(node)) {
        const text = node.getText(sf).replace(/\s+/g, " ").trim();
        if (
          text.length > 0 &&
          HAS_WORD_LETTERS_RE.test(text) &&
          !ALLOWED_JSX_TOKENS.has(text)
        ) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          errors.push(`[Teks JSX Hardcode] ${rel}:${line + 1} -> "${text}"`);
        }
      } else if (ts.isJsxAttribute(node)) {
        const attrName = node.name.getText(sf);
        if (VISIBLE_ATTRS.has(attrName) && node.initializer && ts.isStringLiteral(node.initializer)) {
          const val = node.initializer.text.trim();
          if (val.length > 0 && HAS_WORD_LETTERS_RE.test(val)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            errors.push(`[Atribut JSX "${attrName}" Hardcode] ${rel}:${line + 1} -> "${val}"`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sf);
  }

  if (errors.length > 0) {
    console.error(`\nPemeriksaan i18n & kualitas teks GAGAL (${errors.length} temuan):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `OK: i18n:check lulus (${idMap.size} kunci identik di id.json & en.json, ${tsxFiles.length} komponen TSX bersih, 0 kata terlarang).`
  );
}

main();

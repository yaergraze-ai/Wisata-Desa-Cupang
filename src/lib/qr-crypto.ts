import crypto from "node:crypto";

const TOKEN_VERSION_PREFIX = "WC1";
const PUBLIC_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function deriveAes256Key(secret: string): Buffer {
  const raw = crypto.hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from("wisata-cirebon-qr-cipher-salt", "utf8"),
    Buffer.from("wisata-cirebon-qr-aes-256-gcm-v1", "utf8"),
    32
  );
  return Buffer.from(raw);
}

function computeHmacBase64Url(secret: string, body: string): string {
  return crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(body, "utf8")
    .digest("base64url");
}

/**
 * Membuat payload QR acak ≥128-bit (160-bit / 20 byte) bertanda tangan HMAC-SHA256 tanpa PII (§5.4).
 * Format: "WC1.<nonce_base64url>.<hmac_base64url>"
 */
export function createSignedQrPayload(secret: string): string {
  if (!secret || secret.length < 32) {
    throw new Error("QR_SIGNING_SECRET minimal 32 karakter.");
  }
  const nonce = crypto.randomBytes(20).toString("base64url");
  const body = `${TOKEN_VERSION_PREFIX}.${nonce}`;
  const sig = computeHmacBase64Url(secret, body);
  return `${body}.${sig}`;
}

/**
 * Memverifikasi tanda tangan HMAC-SHA256 payload QR secara constant-time sebelum pencarian hash di DB (§5.4).
 */
export function verifySignedQrPayload(
  rawPayload: string,
  secret: string
): boolean {
  if (!rawPayload || !secret || secret.length < 32) {
    return false;
  }
  const trimmed = rawPayload.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION_PREFIX) {
    return false;
  }
  const [prefix, nonce, providedSig] = parts;
  if (!nonce || nonce.length < 22 || !providedSig) {
    return false;
  }
  const expectedSig = computeHmacBase64Url(secret, `${prefix}.${nonce}`);
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * Menghasilkan hash SHA-256 satu arah dari payload QR untuk disimpan di kolom Ticket.qrTokenHash (§5.4).
 */
export function hashQrPayload(rawPayload: string): string {
  return crypto
    .createHash("sha256")
    .update(rawPayload.trim(), "utf8")
    .digest("hex");
}

/**
 * Mengenkripsi payload QR dengan AES-256-GCM terautentikasi untuk disimpan di Ticket.qrTokenCipher
 * agar hanya pemilik tiket sah yang dapat merender ulang QR di dompet/PDF tanpa menyimpan plaintext di DB.
 */
export function encryptQrPayload(rawPayload: string, secret: string): string {
  const key = deriveAes256Key(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawPayload, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/**
 * Mendekripsi Ticket.qrTokenCipher kembali ke payload QR bertanda tangan.
 */
export function decryptQrPayload(cipherText: string, secret: string): string {
  const parts = cipherText.split(".");
  if (parts.length !== 3) {
    throw new Error("Format cipher QR tidak valid.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Komponen cipher QR tidak lengkap.");
  }
  const key = deriveAes256Key(secret);
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const encrypted = Buffer.from(dataB64, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Menghasilkan kode publik tiket yang mudah dibaca manusia (mis. "PUTIH-CBN-8K4M2P" atau "REG-BL-7N3Q9X").
 */
export function generateReadableTicketCode(productCode: string): string {
  const prefix =
    productCode === "TIKET_PUTIH" ? "PUTIH-CBN" : "REG-BL";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    const b = bytes[i] ?? 0;
    suffix += PUBLIC_CODE_ALPHABET[b % PUBLIC_CODE_ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
}

/**
 * Menghasilkan nomor pesanan unik berbasis tanggal WIB ("WC-YYYYMMDD-XXXXXX").
 */
export function generateReadableOrderNumber(ymd: string): string {
  const compactDate = ymd.replace(/-/g, "");
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    const b = bytes[i] ?? 0;
    suffix += PUBLIC_CODE_ALPHABET[b % PUBLIC_CODE_ALPHABET.length];
  }
  return `WC-${compactDate}-${suffix}`;
}

import crypto from "node:crypto";
import { GateType, TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  createSignedQrPayload,
  decryptQrPayload,
  encryptQrPayload,
  generateReadableOrderNumber,
  generateReadableTicketCode,
  hashQrPayload,
  verifySignedQrPayload,
} from "@/lib/qr-crypto";
import { verifyMidtransWebhookSignature } from "@/server/integrations/payment/payment-provider";
import {
  generateTicketPdfBuffer,
  generateTicketQrPngBuffer,
} from "@/server/tickets/ticket-documents";

const TEST_QR_SECRET = "wisata-cirebon-unit-test-qr-secret-key-2026-aman";
const TEST_MIDTRANS_SERVER_KEY = "SB-Mid-server-UnitTestKeyWisataCirebon2026";

describe("QR Cryptographic Token & AES-256-GCM Cipher (§5.4)", () => {
  it("membuat payload QR acak >=128-bit bertanda tangan HMAC tanpa PII dan memverifikasinya", () => {
    const payloadA = createSignedQrPayload(TEST_QR_SECRET);
    const payloadB = createSignedQrPayload(TEST_QR_SECRET);

    expect(payloadA).not.toEqual(payloadB);
    expect(payloadA.startsWith("WC1.")).toBe(true);
    expect(verifySignedQrPayload(payloadA, TEST_QR_SECRET)).toBe(true);

    // Pastikan tidak mengandung PII dan memiliki panjang memadai
    const parts = payloadA.split(".");
    expect(parts).toHaveLength(3);
    const nonceBytes = Buffer.from(parts[1]!, "base64url");
    expect(nonceBytes.byteLength).toBeGreaterThanOrEqual(16); // >= 128-bit
  });

  it("menolak payload QR yang dimodifikasi atau ditandatangani kunci berbeda", () => {
    const valid = createSignedQrPayload(TEST_QR_SECRET);
    const [prefix, nonce, sig] = valid.split(".");
    const flippedChar = sig![0] === "A" ? "B" : "A";
    const tamperedSig = `${prefix}.${nonce}.${flippedChar}${sig!.slice(1)}`;
    const tamperedNonce = `${prefix}.${nonce!.slice(0, -1)}${nonce!.endsWith("A") ? "B" : "A"}.${sig}`;

    expect(verifySignedQrPayload(tamperedSig, TEST_QR_SECRET)).toBe(false);
    expect(verifySignedQrPayload(tamperedNonce, TEST_QR_SECRET)).toBe(false);
    expect(
      verifySignedQrPayload(
        valid,
        "kunci-rahasia-lain-yang-berbeda-32-karakter-lebih"
      )
    ).toBe(false);
    expect(verifySignedQrPayload("BUKAN-TOKEN-QR", TEST_QR_SECRET)).toBe(false);
  });

  it("mengenkripsi dan mendekripsi cipher QR dengan AES-256-GCM serta menghasilkan hash SHA-256 konsisten", () => {
    const payload = createSignedQrPayload(TEST_QR_SECRET);
    const hash = hashQrPayload(payload);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const cipher = encryptQrPayload(payload, TEST_QR_SECRET);
    expect(cipher).not.toContain(payload);

    const revealed = decryptQrPayload(cipher, TEST_QR_SECRET);
    expect(revealed).toBe(payload);
    expect(hashQrPayload(revealed)).toBe(hash);

    // Tamper pada ciphertext wajib ditolak oleh GCM auth tag
    const segments = cipher.split(".");
    const corrupted = `${segments[0]}.${segments[1]}.AAAA${segments[2]!.slice(4)}`;
    expect(() => decryptQrPayload(corrupted, TEST_QR_SECRET)).toThrow();
  });

  it("membuat kode publik tiket dan nomor pesanan yang rapi", () => {
    expect(generateReadableTicketCode("TIKET_PUTIH")).toMatch(
      /^PUTIH-CBN-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
    );
    expect(generateReadableTicketCode("REGULER_BL")).toMatch(
      /^REG-BL-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
    );
    expect(generateReadableOrderNumber("2026-11-15")).toMatch(
      /^WC-20261115-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
    );
  });
});

describe("Midtrans Webhook SHA-512 Signature Verification (§5.3)", () => {
  it("menerima signature SHA-512 resmi dan menolak manipulasi gross_amount atau kunci", () => {
    const orderId = "WC-20261115-9K3P7M";
    const statusCode = "200";
    const grossAmount = "36000.00";
    const validSig = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${TEST_MIDTRANS_SERVER_KEY}`)
      .digest("hex");

    expect(
      verifyMidtransWebhookSignature(
        {
          orderId,
          statusCode,
          grossAmount,
          signatureKey: validSig,
        },
        TEST_MIDTRANS_SERVER_KEY
      )
    ).toBe(true);

    // Manipulasi gross_amount menjadi 1000.00 harus ditolak
    expect(
      verifyMidtransWebhookSignature(
        {
          orderId,
          statusCode,
          grossAmount: "1000.00",
          signatureKey: validSig,
        },
        TEST_MIDTRANS_SERVER_KEY
      )
    ).toBe(false);

    // Kunci server salah harus ditolak
    expect(
      verifyMidtransWebhookSignature(
        {
          orderId,
          statusCode,
          grossAmount,
          signatureKey: validSig,
        },
        "SB-Mid-server-WrongKey"
      )
    ).toBe(false);
  });
});

describe("QR PNG & Bilingual PDF E-Ticket Generator (§6.C.3 & §7.3)", () => {
  it("menghasilkan buffer PNG dan PDF valid untuk Tiket Putih (ID) dan Reguler (EN)", async () => {
    const qrPayload = createSignedQrPayload(TEST_QR_SECRET);
    const pngBuf = await generateTicketQrPngBuffer(qrPayload);
    expect(pngBuf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(
      true
    );

    const pdfWhiteId = await generateTicketPdfBuffer(
      {
        publicCode: "PUTIH-CBN-7M4K2P",
        orderNumber: "WC-20261115-7M4K2P",
        productCode: "TIKET_PUTIH",
        productName: "Tiket Putih — Terusan Batu Lawang & Gunung Bendera",
        visitorName: "Raka Pratama",
        visitorWhatsapp: "+6285724908811",
        visitDateYmd: "2026-11-15",
        admitCount: 3,
        unitBase: 15000,
        unitParking: 3000,
        unitTotal: 18000,
        subtotal: 54000,
        allowedGates: [
          GateType.GERBANG_BATU_LAWANG,
          GateType.PINTU_GUNUNG_BENDERA,
        ],
        qrPayload,
        status: TicketStatus.ACTIVE,
        issuedAt: new Date("2026-10-31T10:00:00.000Z"),
      },
      "id"
    );

    expect(pdfWhiteId.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfWhiteId.byteLength).toBeGreaterThan(2500);

    const pdfRegularEn = await generateTicketPdfBuffer(
      {
        publicCode: "REG-BL-9Q3W8Z",
        orderNumber: "WC-20261115-9Q3W8Z",
        productCode: "REGULER_BL",
        productName: "Batu Lawang Regular Pass",
        visitorName: "claire bennett",
        visitorWhatsapp: "+6285724908811",
        visitDateYmd: "2026-11-15",
        admitCount: 2,
        unitBase: 10000,
        unitParking: 3000,
        unitTotal: 13000,
        subtotal: 26000,
        allowedGates: [GateType.GERBANG_BATU_LAWANG],
        qrPayload,
        status: TicketStatus.ACTIVE,
        issuedAt: new Date("2026-10-31T10:00:00.000Z"),
      },
      "en"
    );

    expect(pdfRegularEn.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfRegularEn.byteLength).toBeGreaterThan(2500);
  });
});

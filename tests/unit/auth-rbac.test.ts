import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  generateRandomSixDigitOtp,
  hashWhatsappOtpCode,
  verifyOtpHashConstantTime,
} from "@/server/auth/whatsapp-otp";
import {
  computeWindowBounds,
  hashRateIdentifier,
} from "@/server/rate-limit/rate-limit";
import {
  getRoleHomePath,
  sanitizeNextPath,
} from "@/server/auth/guards";

describe("Keamanan OTP WhatsApp & Rate Limiter", () => {
  it("menghasilkan OTP 6 digit kriptografis dan memverifikasi HMAC-SHA256 secara constant-time", () => {
    const code = generateRandomSixDigitOtp();
    expect(code).toMatch(/^\d{6}$/);

    const hashA = hashWhatsappOtpCode("+6281234567890", code);
    const hashSame = hashWhatsappOtpCode("+6281234567890", code);
    const hashOtherPhone = hashWhatsappOtpCode("+6281299999999", code);

    expect(verifyOtpHashConstantTime(hashA, hashSame)).toBe(true);
    expect(verifyOtpHashConstantTime(hashA, hashOtherPhone)).toBe(false);
  });

  it("menghitung batas jendela waktu rate limiter dengan deterministik", () => {
    const nowMs = Date.parse("2026-10-31T12:02:30.000Z");
    const bounds = computeWindowBounds(nowMs, 300); // jendela 5 menit
    expect(bounds.windowStart.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(bounds.expiresAt.toISOString()).toBe("2026-10-31T12:05:00.000Z");
    expect(bounds.retryAfterSeconds).toBe(150);
    expect(hashRateIdentifier("127.0.0.1")).toHaveLength(32);
  });
});

describe("RBAC Routing & Perlindungan Open Redirect", () => {
  it("menentukan rute beranda dashboard sesuai peran", () => {
    expect(getRoleHomePath(Role.MEMBER)).toBe("/dashboard");
    expect(getRoleHomePath(Role.STAFF)).toBe("/dashboard/staff");
    expect(getRoleHomePath(Role.ADMIN)).toBe("/dashboard/admin");
    expect(getRoleHomePath(Role.SUPER_ADMIN)).toBe("/dashboard/super-admin");
  });

  it("menolak URL eksternal atau protocol-relative pada parameter next", () => {
    expect(sanitizeNextPath("https://evil.example.com")).toBeNull();
    expect(sanitizeNextPath("//evil.example.com")).toBeNull();
    expect(sanitizeNextPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeNextPath("/dashboard?pkg=TIKET_PUTIH")).toBe(
      "/dashboard?pkg=TIKET_PUTIH"
    );
  });
});

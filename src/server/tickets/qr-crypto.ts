import "server-only";
import { getEnv } from "@/server/env";
import {
  createSignedQrPayload,
  decryptQrPayload,
  encryptQrPayload,
  hashQrPayload,
  verifySignedQrPayload,
} from "@/lib/qr-crypto";

export interface IssuedQrCredentials {
  qrPayload: string;
  qrTokenHash: string;
  qrTokenCipher: string;
}

export function issueServerQrCredentials(): IssuedQrCredentials {
  const secret = getEnv().QR_SIGNING_SECRET;
  const qrPayload = createSignedQrPayload(secret);
  return {
    qrPayload,
    qrTokenHash: hashQrPayload(qrPayload),
    qrTokenCipher: encryptQrPayload(qrPayload, secret),
  };
}

export function verifyServerQrPayload(rawPayload: string): {
  validSignature: boolean;
  qrTokenHash: string | null;
} {
  const secret = getEnv().QR_SIGNING_SECRET;
  const valid = verifySignedQrPayload(rawPayload, secret);
  if (!valid) {
    return { validSignature: false, qrTokenHash: null };
  }
  return {
    validSignature: true,
    qrTokenHash: hashQrPayload(rawPayload),
  };
}

export function revealServerQrPayload(qrTokenCipher: string): string {
  return decryptQrPayload(qrTokenCipher, getEnv().QR_SIGNING_SECRET);
}

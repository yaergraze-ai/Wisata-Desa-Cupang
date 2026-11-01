import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { extractRequestNetworkMeta } from "@/server/audit/audit";

const handler = toNextJsHandler(auth);

const RATE_LIMITED_AUTH_PATHS: Record<
  string,
  { maxRequests: number; windowSeconds: number }
> = {
  "/api/auth/sign-in/email": { maxRequests: 10, windowSeconds: 300 },
  "/api/auth/sign-up/email": { maxRequests: 6, windowSeconds: 600 },
  "/api/auth/request-password-reset": { maxRequests: 5, windowSeconds: 600 },
  "/api/auth/forget-password": { maxRequests: 5, windowSeconds: 600 },
  "/api/auth/two-factor/verify-totp": { maxRequests: 10, windowSeconds: 300 },
  "/api/auth/phone-number/send-otp": { maxRequests: 3, windowSeconds: 300 },
  "/api/auth/phone-number/verify": { maxRequests: 10, windowSeconds: 300 },
};

export const GET = handler.GET;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const limitRule = RATE_LIMITED_AUTH_PATHS[url.pathname];

  if (limitRule) {
    const net = extractRequestNetworkMeta(request.headers);
    const identifier = net.ip || "local-client";
    const decision = await checkRateLimit({
      bucket: `auth:${url.pathname}`,
      identifier,
      maxRequests: limitRule.maxRequests,
      windowSeconds: limitRule.windowSeconds,
      headers: request.headers,
    });

    if (!decision.allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: "Terlalu banyak percobaan. Silakan tunggu beberapa saat.",
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(decision.retryAfterSeconds),
          },
        }
      );
    }
  }

  return handler.POST(request);
}

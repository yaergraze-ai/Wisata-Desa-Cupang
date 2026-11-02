import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";
import { checkRateLimit } from "@/server/rate-limit/rate-limit";
import { extractRequestNetworkMeta } from "@/server/audit/audit";
import { db } from "@/server/db";

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

  if (url.pathname === "/api/auth/sign-out") {
    // 1. Ekstrak token sesi dari header cookie untuk penghapusan database langsung
    const cookieHeader = request.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
    const rawToken = tokenMatch?.[1];
    const sessionToken = rawToken ? decodeURIComponent(rawToken.trim()) : null;

    if (sessionToken) {
      try {
        await db.session.deleteMany({
          where: { token: sessionToken },
        });
      } catch {
        // Abaikan jika sudah terhapus
      }
    }

    let response: Response;
    try {
      response = await handler.POST(request);
    } catch {
      response = NextResponse.json({ success: true });
    }

    const cookieNames = [
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
      "better-auth.session_data",
      "__Secure-better-auth.session_data",
      "better-auth.account_data",
      "__Secure-better-auth.account_data",
      "better-auth.dont_remember",
      "__Secure-better-auth.dont_remember",
    ];

    const isHttps =
      request.url.startsWith("https://") ||
      request.headers.get("x-forwarded-proto") === "https";

    const nextResponse = new NextResponse(response.body, {
      status: response.status >= 200 && response.status < 400 ? response.status : 200,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    for (const name of cookieNames) {
      const isSecureCookie = name.startsWith("__Secure-") || isHttps;
      nextResponse.cookies.set({
        name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureCookie,
      });
    }

    return nextResponse;
  }

  return handler.POST(request);
}

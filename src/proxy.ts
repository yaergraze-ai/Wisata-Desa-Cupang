import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

function buildCspHeader(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://app.sandbox.midtrans.com",
    "https://app.midtrans.com",
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.r2.dev https://*.cloudflarestorage.com https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://demotiles.maplibre.org https://server.arcgisonline.com https://services.arcgisonline.com https://*.arcgisonline.com https://mt0.google.com https://mt1.google.com https://mt2.google.com https://mt3.google.com https://*.google.com https://tile.opentopomap.org",
    "font-src 'self' data: https://demotiles.maplibre.org",
    "connect-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://api.sandbox.midtrans.com https://api.midtrans.com https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://demotiles.maplibre.org https://server.arcgisonline.com https://services.arcgisonline.com https://*.arcgisonline.com https://mt0.google.com https://mt1.google.com https://mt2.google.com https://mt3.google.com https://*.google.com https://tile.opentopomap.org",
    "frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return directives.join("; ");
}

export default function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  response.headers.set("Content-Security-Policy", buildCspHeader());
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=(), payment=(self)"
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|media|maps|icons|sw\\.js|manifest\\.webmanifest|.*\\..*).*)",
  ],
};

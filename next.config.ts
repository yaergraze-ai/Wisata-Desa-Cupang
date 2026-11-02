import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["sharp", "pg"],
  images: {
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pub-bd6baffcd2fb4583a6d96e9be2673659.r2.dev",
      },
    ],
    localPatterns: [
      {
        pathname: "/media/**",
      },
      {
        pathname: "/api/media/**",
      },
      {
        pathname: "/api/review-photos/**",
      },
      {
        pathname: "/uploads/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);

import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["sharp", "pg"],
  experimental: {
    optimizePackageImports: ["bootstrap-icons", "date-fns"],
  },
  images: {
    formats: ["image/webp"],
    qualities: [72, 75, 78, 85],
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
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
    ],
    localPatterns: [
      {
        pathname: "/icons/**",
      },
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

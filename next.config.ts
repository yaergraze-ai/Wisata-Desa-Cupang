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
    ],
  },
};

export default withNextIntl(nextConfig);

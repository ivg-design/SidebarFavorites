import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isForgeContext = process.env.NEXT_PUBLIC_SITE_URL?.includes("forge.mograph.life");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  assetPrefix: isProd && isForgeContext ? "/apps/sidebarfavorites" : "",
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3103",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" },
        ],
      },
    ];
  },
};

export default nextConfig;

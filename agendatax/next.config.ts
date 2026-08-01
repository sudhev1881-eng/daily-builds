import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";
const assetPrefix =
  process.env.NEXT_PUBLIC_ASSET_PREFIX?.replace(/\/$/, "") || basePath || "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(process.env.NEXT_PUBLIC_STATIC_EXPORT === "1"
    ? {
        output: "export" as const,
        basePath: basePath || undefined,
        assetPrefix: assetPrefix || undefined,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;

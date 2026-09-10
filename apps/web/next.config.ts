import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@slotart/engine"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } }
};

export default nextConfig;

import type { NextConfig } from "next";
import { crossOriginIsolationHeaders } from "./lib/cross-origin-isolation";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const headers = crossOriginIsolationHeaders.map((header) => ({
      key: header.key,
      value: header.value,
    }));
    // Dotted public files (the Godot export) need these headers. The dev
    // HMR socket at /_next/hmr must not receive them, or the upgrade fails
    // and the dev page never hydrates.
    return [
      {
        source: "/((?!_next/hmr|_next/webpack-hmr).*)",
        headers,
      },
    ];
  },
};

export default nextConfig;

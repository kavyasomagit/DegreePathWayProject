import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // API routes read the synthetic JSON tables from /data at runtime; make sure they ship with the serverless functions.
  outputFileTracingIncludes: {
    "/api/**": ["./data/*.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

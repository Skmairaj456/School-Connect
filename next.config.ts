import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright and some browsers open the dev server as 127.0.0.1 rather than localhost.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
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

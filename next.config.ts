import type { NextConfig } from "next";

// Local-only dashboard that reads Postgres on every request, so Cache Components (static shells) are off.
const nextConfig: NextConfig = {
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

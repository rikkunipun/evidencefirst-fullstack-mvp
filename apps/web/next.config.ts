import type { NextConfig } from "next";

// This app is fully dynamic (cookie/session/DB-driven on every request).
// Explicit caching directives are deferred; disable experimental
// cache-components/partial-prefetching so routes aren't silently cached.
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

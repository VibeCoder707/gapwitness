import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/analyze": ["./fixtures/seat-limit-race/**/*", "./fixtures/replay/**/*"],
    "/api/verify": ["./fixtures/seat-limit-race/**/*", "./fixtures/replay/**/*"],
  },
};

export default nextConfig;

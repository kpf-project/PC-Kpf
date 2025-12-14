import type { NextConfig } from "next";
import withPWAInit, { type RuntimeCaching } from "next-pwa";
import runtimeCaching from "next-pwa/cache";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: runtimeCaching as RuntimeCaching[],
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Increase timeout for slow Supabase Storage responses
    minimumCacheTTL: 60,
    // Allow larger images and increase timeout
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default withPWA(nextConfig);

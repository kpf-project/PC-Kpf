import type { NextConfig } from "next";

declare module "next-pwa" {
  export type RuntimeCaching = {
    urlPattern: RegExp | string;
    handler: string;
    method?: string;
    options?: Record<string, unknown>;
  };

  export type NextPWAOptions = {
    dest?: string;
    disable?: boolean;
    runtimeCaching?: RuntimeCaching[];
    register?: boolean;
    skipWaiting?: boolean;
    buildExcludes?: Array<RegExp | string>;
  };

  export default function withPWA(options?: NextPWAOptions): (nextConfig: NextConfig) => NextConfig;
}

declare module "next-pwa/cache" {
  import type { RuntimeCaching } from "next-pwa";
  const runtimeCaching: RuntimeCaching[];
  export default runtimeCaching;
}

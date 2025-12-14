import type { BrandingSettings } from "@/lib/configStore";

const DEFAULT_FALLBACK = "/icons/icon-192x192.png";

function toTimestamp(updatedAt?: string | null) {
  if (!updatedAt) return null;
  const value = Date.parse(updatedAt);
  return Number.isFinite(value) ? value : null;
}

function applyCacheBuster(path: string, updatedAt?: string | null) {
  const timestamp = toTimestamp(updatedAt);
  if (!path || !timestamp) {
    return path;
  }

  const hashIndex = path.indexOf("#");
  const hasHash = hashIndex >= 0;
  const base = hasHash ? path.slice(0, hashIndex) : path;
  const hash = hasHash ? path.slice(hashIndex) : "";

  const queryIndex = base.indexOf("?");
  const pathname = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
  const queryString = queryIndex >= 0 ? base.slice(queryIndex + 1) : "";

  const params = new URLSearchParams(queryString);
  params.set("v", String(timestamp));
  const serialized = params.toString();

  return `${pathname}${serialized ? `?${serialized}` : ""}${hash}`;
}

function ensureAbsolute(src: string, origin?: string) {
  if (!origin) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }
  const prefix = src.startsWith("/") ? "" : "/";
  return `${origin}${prefix}${src}`;
}

export function getBrandingLogoSrc(
  logoPath: string | null,
  updatedAt?: string | null,
  fallback: string | null = DEFAULT_FALLBACK,
) {
  if (!logoPath) {
    return fallback;
  }
  return applyCacheBuster(logoPath, updatedAt);
}

export function getBrandingLogoUrl(
  logoPath: string | null,
  updatedAt?: string | null,
  options?: { fallback?: string | null; origin?: string },
) {
  const fallback = options?.fallback ?? DEFAULT_FALLBACK;
  const origin = options?.origin;
  const src = getBrandingLogoSrc(logoPath, updatedAt, fallback);
  if (!src) return src;
  return ensureAbsolute(src, origin);
}

export function getVersionedBranding(
  branding: BrandingSettings | null | undefined,
  fallback: string | null = DEFAULT_FALLBACK,
) {
  if (!branding) {
    return fallback;
  }
  return getBrandingLogoSrc(branding.logoPath, branding.updatedAt, fallback);
}

export { DEFAULT_FALLBACK as DEFAULT_BRANDING_LOGO };

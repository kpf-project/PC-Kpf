/**
 * Query Cache Utilities
 *
 * Provides in-memory caching for database queries with TTL and stale-while-revalidate support.
 * Reduces database load for frequently accessed data.
 *
 * @module queryCache
 */

export interface CacheOptions {
  /**
   * Time-to-live in milliseconds (how long cache is valid)
   * Default: 5 minutes (300000ms)
   */
  ttl?: number;

  /**
   * Stale-while-revalidate time in milliseconds
   * If data is stale but within this window, return stale data and refresh in background
   * Default: 2 minutes (120000ms)
   */
  staleWhileRevalidate?: number;

  /**
   * Cache key prefix for namespacing
   * Example: 'dashboard', 'reports', 'products'
   */
  prefix?: string;
}

export interface CacheEntry<T> {
  data: T;
  cachedAt: number; // Timestamp when cached
  expiresAt: number; // Timestamp when expires
}

/**
 * Simple in-memory cache with TTL support
 */
class InMemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRefresh = new Set<string>();

  /**
   * Gets a value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Expired - remove from cache
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Sets a value in cache with TTL
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time-to-live in milliseconds
   */
  set<T>(key: string, data: T, ttl: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Checks if cache entry is stale (expired) but still within revalidation window
   *
   * @param key - Cache key
   * @param staleTime - Stale-while-revalidate time in ms
   * @returns True if entry is stale but retrievable
   */
  isStale(key: string, staleTime: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    return now > entry.expiresAt && now <= entry.expiresAt + staleTime;
  }

  /**
   * Gets stale data without deleting it (for stale-while-revalidate pattern)
   *
   * @param key - Cache key
   * @returns Stale data or null if not found
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry.data as T;
  }

  /**
   * Marks a key as pending refresh (prevents duplicate refreshes)
   */
  markPendingRefresh(key: string): void {
    this.pendingRefresh.add(key);
  }

  /**
   * Checks if key is currently being refreshed
   */
  isPendingRefresh(key: string): boolean {
    return this.pendingRefresh.has(key);
  }

  /**
   * Clears pending refresh status
   */
  clearPendingRefresh(key: string): void {
    this.pendingRefresh.delete(key);
  }

  /**
   * Removes a value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears entire cache
   */
  clear(): void {
    this.cache.clear();
    this.pendingRefresh.clear();
  }

  /**
   * Removes all expired entries (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
    pendingRefresh: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      pendingRefresh: this.pendingRefresh.size,
    };
  }
}

// Global cache instance
const globalCache = new InMemoryCache();

/**
 * Generates a cache key from parameters
 *
 * @param prefix - Cache key prefix
 * @param params - Parameters to include in key
 * @returns Cache key string
 */
export function generateCacheKey(prefix: string, ...params: unknown[]): string {
  const paramString = params
    .map((param) => {
      if (typeof param === 'object') {
        return JSON.stringify(param);
      }
      return String(param);
    })
    .join(':');

  return `${prefix}:${paramString}`;
}

/**
 * Cached query wrapper with stale-while-revalidate support
 *
 * @param key - Cache key
 * @param queryFn - Function that performs the query
 * @param options - Cache options
 * @returns Query result (from cache or fresh)
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    staleWhileRevalidate = 2 * 60 * 1000, // 2 minutes default
  } = options;

  // Try to get from cache
  const cached = globalCache.get<T>(key);
  if (cached !== null) {
    console.log(`[Cache] HIT: ${key}`);
    return cached;
  }

  // Check if stale data exists
  if (globalCache.isStale(key, staleWhileRevalidate)) {
    console.log(`[Cache] STALE: ${key} (returning stale, refreshing in background)`);

    const staleData = globalCache.getStale<T>(key);

    // If stale data is null, fall through to fresh fetch
    if (staleData !== null) {
      // Refresh in background if not already refreshing
      if (!globalCache.isPendingRefresh(key)) {
        globalCache.markPendingRefresh(key);

        // Fire and forget - don't await
        queryFn()
          .then((freshData) => {
            globalCache.set(key, freshData, ttl);
            globalCache.clearPendingRefresh(key);
            console.log(`[Cache] REFRESHED: ${key}`);
          })
          .catch((error) => {
            console.error(`[Cache] REFRESH FAILED: ${key}`, error);
            globalCache.clearPendingRefresh(key);
          });
      }

      return staleData;
    }
  }

  // Cache miss - fetch fresh data
  console.log(`[Cache] MISS: ${key}`);
  const data = await queryFn();
  globalCache.set(key, data, ttl);
  return data;
}

/**
 * Invalidates (removes) a cached entry
 *
 * @param key - Cache key to invalidate
 */
export function invalidateCache(key: string): void {
  globalCache.delete(key);
  console.log(`[Cache] INVALIDATED: ${key}`);
}

/**
 * Invalidates all cache entries matching a prefix
 *
 * @param prefix - Cache key prefix to match
 */
export function invalidateCacheByPrefix(prefix: string): void {
  const stats = globalCache.getStats();
  const matchingKeys = stats.keys.filter((key) => key.startsWith(prefix));

  for (const key of matchingKeys) {
    globalCache.delete(key);
  }

  console.log(`[Cache] INVALIDATED PREFIX: ${prefix} (${matchingKeys.length} keys)`);
}

/**
 * Clears entire cache
 */
export function clearCache(): void {
  globalCache.clear();
  console.log('[Cache] CLEARED ALL');
}

/**
 * Gets cache statistics
 */
export function getCacheStats() {
  return globalCache.getStats();
}

/**
 * Starts automatic cache cleanup (runs every 5 minutes)
 */
export function startCacheCleanup(): NodeJS.Timeout {
  const interval = setInterval(() => {
    const statsBefore = globalCache.getStats();
    globalCache.cleanup();
    const statsAfter = globalCache.getStats();

    const removed = statsBefore.size - statsAfter.size;
    if (removed > 0) {
      console.log(`[Cache] CLEANUP: Removed ${removed} expired entries`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  return interval;
}

/**
 * USAGE EXAMPLES:
 *
 * 1. Simple caching:
 *
 * const employees = await cachedQuery(
 *   'employees:all',
 *   async () => {
 *     const { data } = await supabase.from('employees').select('*');
 *     return data || [];
 *   },
 *   { ttl: 10 * 60 * 1000 } // Cache for 10 minutes
 * );
 *
 * 2. With parameters:
 *
 * const key = generateCacheKey('sales:report', employeeId, startDate, endDate);
 * const salesData = await cachedQuery(
 *   key,
 *   async () => fetchSalesReport(employeeId, startDate, endDate),
 *   { ttl: 5 * 60 * 1000, staleWhileRevalidate: 2 * 60 * 1000 }
 * );
 *
 * 3. Invalidation after mutation:
 *
 * // After creating a new sale
 * await createSale(saleData);
 * invalidateCacheByPrefix('sales:'); // Invalidate all sales caches
 * invalidateCache('dashboard:metrics'); // Invalidate dashboard
 *
 * 4. In API routes:
 *
 * export async function GET(request: Request) {
 *   const metrics = await cachedQuery(
 *     'dashboard:metrics',
 *     async () => getDashboardMetrics(),
 *     { ttl: 1 * 60 * 1000 } // Cache for 1 minute
 *   );
 *   return NextResponse.json({ metrics });
 * }
 *
 * 5. Start cleanup (in app initialization):
 *
 * // In a server-side initialization file
 * startCacheCleanup();
 *
 * BEST PRACTICES:
 *
 * 1. Use descriptive prefixes: 'dashboard:', 'sales:', 'products:'
 * 2. Include relevant parameters in cache key
 * 3. Set appropriate TTL based on data volatility
 * 4. Invalidate cache after mutations that affect cached data
 * 5. Use stale-while-revalidate for non-critical reads
 * 6. Monitor cache hit rates with getCacheStats()
 *
 * LIMITATIONS:
 *
 * - In-memory cache is per-instance (not shared across servers)
 * - Cache is lost on server restart
 * - For multi-server deployments, consider Redis/Memcached
 * - Not suitable for very large datasets (memory limits)
 *
 * PRODUCTION ALTERNATIVES:
 *
 * For production with multiple servers, consider:
 * 1. Redis (best for distributed caching)
 * 2. Upstash Redis (serverless Redis for Vercel/Netlify)
 * 3. Cloudflare KV (edge caching)
 * 4. React Query (client-side caching)
 */

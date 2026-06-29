/**
 * Redis caching middleware for VoteChain backend API.
 *
 * TTLs:
 *   - Proposal list  → 30 seconds
 *   - Single proposal → 10 seconds
 *
 * Cache-hit/miss metrics are tracked in memory and exposed via GET /metrics/cache.
 * Cache invalidation is triggered by calling invalidateProposalCache(id?).
 */

import { createClient, RedisClientType } from "redis";
import { Request, Response, NextFunction } from "express";
import { withTimeout, redisTimeoutMs } from "../timeout";

// ── Redis client ───────────────────────────────────────────────────────────

let redis: RedisClientType;

export async function connectRedis(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
  redis = createClient({ url }) as RedisClientType;
  redis.on("error", (err) => console.error("[redis] error:", err));
  await withTimeout(redis.connect(), redisTimeoutMs());
  console.log("[redis] connected to", url);
}

export function isRedisReady(): boolean {
  return redis?.isOpen ?? false;
}

// ── Metrics ────────────────────────────────────────────────────────────────

const metrics = { hits: 0, misses: 0 };

export function getCacheMetrics() {
  return { ...metrics, hitRate: metrics.hits + metrics.misses === 0 ? 0 : metrics.hits / (metrics.hits + metrics.misses) };
}

// ── TTL constants ──────────────────────────────────────────────────────────

const TTL = {
  PROPOSAL_LIST: 30,   // seconds
  PROPOSAL_ITEM: 10,   // seconds
};

// ── Cache key helpers ──────────────────────────────────────────────────────

const KEY = {
  list: (limit?: number, offset?: number) => {
    const parts = ["proposals:list"];
    if (limit !== undefined) parts.push(`limit:${limit}`);
    if (offset !== undefined) parts.push(`offset:${offset}`);
    return parts.join(":");
  },
  item: (id: string | number) => `proposals:item:${id}`,
};

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * Returns an Express middleware that caches the JSON response in Redis.
 * @param keyFn   Function that derives the cache key from the request.
 * @param ttl     TTL in seconds.
 */
function cacheMiddleware(keyFn: (req: Request) => string, ttl: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redis?.isOpen) return next();

    const key = keyFn(req);
    try {
      const cached = await withTimeout(redis.get(key), redisTimeoutMs());
      if (cached !== null) {
        metrics.hits++;
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json");
        return res.send(cached);
      }
    } catch (err) {
      console.error("[redis] get error:", err);
    }

    metrics.misses++;
    res.setHeader("X-Cache", "MISS");

    // Intercept res.json to store the response in Redis
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const serialized = JSON.stringify(body);
      withTimeout(redis.setEx(key, ttl, serialized), redisTimeoutMs()).catch((err) =>
        console.error("[redis] setEx error:", err)
      );
      return originalJson(body);
    };

    next();
  };
}

/** Middleware for GET /proposals — 30-second TTL */
export const cacheProposalList = cacheMiddleware(
  (req) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    return KEY.list(limit, offset);
  },
  TTL.PROPOSAL_LIST
);

/** Middleware for GET /proposals/:id — 10-second TTL */
export const cacheProposalItem = cacheMiddleware(
  (req) => KEY.item(req.params.id),
  TTL.PROPOSAL_ITEM
);

// ── Cache invalidation ─────────────────────────────────────────────────────

/**
 * Invalidate cache entries.
 * - No argument: clears all proposal list caches.
 * - With id: clears all list caches and the specific item cache.
 *
 * Call this from your event indexer when new on-chain events arrive.
 */
export async function invalidateProposalCache(id?: string | number) {
  if (!redis?.isOpen) return;
  const keys: string[] = [];
  // Get all proposal list keys
  try {
    const listKeys = await redis.keys("proposals:list*");
    keys.push(...listKeys);
  } catch (err) {
    console.error("[redis] keys error:", err);
  }
  if (id !== undefined) keys.push(KEY.item(id));
  if (keys.length > 0) {
    try {
      await redis.del(keys);
      console.log("[redis] invalidated keys:", keys);
    } catch (err) {
      console.error("[redis] del error:", err);
    }
  }
}

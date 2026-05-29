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

// ── Redis client ───────────────────────────────────────────────────────────

let redis: RedisClientType;

export async function connectRedis(url = process.env.REDIS_URL ?? "redis://localhost:6379") {
  redis = createClient({ url }) as RedisClientType;
  redis.on("error", (err) => console.error("[redis] error:", err));
  await redis.connect();
  console.log("[redis] connected to", url);
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
  list: () => "proposals:list",
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
      const cached = await redis.get(key);
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
      redis.setEx(key, ttl, serialized).catch((err) =>
        console.error("[redis] setEx error:", err)
      );
      return originalJson(body);
    };

    next();
  };
}

/** Middleware for GET /proposals — 30-second TTL */
export const cacheProposalList = cacheMiddleware(() => KEY.list(), TTL.PROPOSAL_LIST);

/** Middleware for GET /proposals/:id — 10-second TTL */
export const cacheProposalItem = cacheMiddleware(
  (req) => KEY.item(req.params.id),
  TTL.PROPOSAL_ITEM
);

// ── Cache invalidation ─────────────────────────────────────────────────────

/**
 * Invalidate cache entries.
 * - No argument: clears the proposal list cache.
 * - With id: clears both the list and the specific item cache.
 *
 * Call this from your event indexer when new on-chain events arrive.
 */
export async function invalidateProposalCache(id?: string | number) {
  if (!redis?.isOpen) return;
  const keys = [KEY.list()];
  if (id !== undefined) keys.push(KEY.item(id));
  try {
    await redis.del(keys);
    console.log("[redis] invalidated keys:", keys);
  } catch (err) {
    console.error("[redis] del error:", err);
  }
}

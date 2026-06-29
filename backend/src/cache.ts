import { getRedisClient } from "./redis";
import { withTimeout, redisTimeoutMs } from "./timeout";

const TTL_SECONDS = 300;
const KEY_PREFIX = "proposal:";

const stats = { hits: 0, misses: 0 };

export async function cacheProposal(id: string, data: unknown): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await withTimeout(
      redis.set(KEY_PREFIX + id, JSON.stringify(data), "EX", TTL_SECONDS),
      redisTimeoutMs()
    );
  } catch (err) {
    console.warn("[cache] set failed:", (err as Error).message);
  }
}

export async function getCachedProposal(id: string): Promise<unknown | null> {
  const redis = getRedisClient();
  if (!redis) { stats.misses++; return null; }
  try {
    const raw = await withTimeout(redis.get(KEY_PREFIX + id), redisTimeoutMs());
    if (raw) { stats.hits++; return JSON.parse(raw); }
    stats.misses++;
    return null;
  } catch (err) {
    console.warn("[cache] get failed:", (err as Error).message);
    stats.misses++;
    return null;
  }
}

export async function invalidateProposal(id: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await withTimeout(redis.del(KEY_PREFIX + id), redisTimeoutMs());
  } catch (err) {
    console.warn("[cache] invalidate failed:", (err as Error).message);
  }
}

export function getCacheStats(): { hits: number; misses: number } {
  return { ...stats };
}

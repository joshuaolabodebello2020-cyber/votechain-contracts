import { getRedisClient } from "./redis";

const TTL_SECONDS = 300;
const KEY_PREFIX = "proposal:";

const stats = { hits: 0, misses: 0 };

export async function cacheProposal(id: string, data: unknown): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(KEY_PREFIX + id, JSON.stringify(data), "EX", TTL_SECONDS);
  } catch (err) {
    console.warn("[cache] set failed:", (err as Error).message);
  }
}

export async function getCachedProposal(id: string): Promise<unknown | null> {
  const redis = getRedisClient();
  if (!redis) { stats.misses++; return null; }
  try {
    const raw = await redis.get(KEY_PREFIX + id);
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
    await redis.del(KEY_PREFIX + id);
  } catch (err) {
    console.warn("[cache] invalidate failed:", (err as Error).message);
  }
}

export function getCacheStats(): { hits: number; misses: number } {
  return { ...stats };
}

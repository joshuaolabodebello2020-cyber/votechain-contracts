import Redis from "ioredis";
import { withTimeout, redisTimeoutMs } from "./timeout";

function parseEnvInt(name: string, fallback: number): number {
  const value = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const DEFAULT_RETRY_DELAYS = [100, 200, 400, 800, 1600];

let client: Redis | null = null;

export function createRedisClient(): Redis {
  const maxRetries = parseEnvInt("REDIS_MAX_RETRIES", DEFAULT_RETRY_DELAYS.length);
  const baseDelay = parseEnvInt("REDIS_RETRY_BASE_MS", 100);

  const redis = new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    retryStrategy: (times: number) => {
      if (times > maxRetries) {
        console.error("[redis] max retries reached, giving up");
        return null; // stop retrying
      }
      const delay = baseDelay * Math.pow(2, times - 1);
      console.warn(`[redis] retry ${times} in ${delay}ms`);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on("error", (err: Error) => {
    console.error("[redis] connection error:", err.message);
  });

  return redis;
}

export function getRedisClient(): Redis | null {
  if (!client) {
    client = createRedisClient();
  }
  return client;
}

/**
 * Explicitly connect the Redis client with a configurable timeout.
 * Callers should catch and handle `TimeoutError` for graceful degradation.
 */
export async function connectRedisClient(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await withTimeout(redis.connect(), redisTimeoutMs());
}

import Redis from "ioredis";

const RETRY_DELAYS = [100, 200, 400, 800, 1600];

let client: Redis | null = null;

export function createRedisClient(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    retryStrategy: (times: number) => {
      if (times > RETRY_DELAYS.length) {
        console.error("[redis] max retries reached, giving up");
        return null; // stop retrying
      }
      const delay = RETRY_DELAYS[times - 1];
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

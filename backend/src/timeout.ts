/**
 * Timeout utility.
 *
 * Wraps any promise with a deadline. If the promise does not settle within
 * `ms` milliseconds a `TimeoutError` is thrown and the original promise is
 * abandoned.
 *
 * Environment variable:
 *   RPC_TIMEOUT_MS    – default timeout for RPC calls   (default: 10 000)
 *   REDIS_TIMEOUT_MS  – default timeout for Redis calls (default:  3 000)
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Race `promise` against a `ms`-millisecond deadline.
 * Rejects with `TimeoutError` if the deadline fires first.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** Timeout (ms) to use for Stellar RPC calls. */
export function rpcTimeoutMs(): number {
  return parseInt(process.env.RPC_TIMEOUT_MS ?? "10000", 10);
}

/** Timeout (ms) to use for Redis calls. */
export function redisTimeoutMs(): number {
  return parseInt(process.env.REDIS_TIMEOUT_MS ?? "3000", 10);
}

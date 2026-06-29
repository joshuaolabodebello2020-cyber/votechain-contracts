/**
 * Retry utility with exponential backoff.
 *
 * Environment variables:
 *   RPC_MAX_RETRIES      – additional retry attempts after first failure (default: 3)
 *   RPC_RETRY_BASE_MS    – base delay in ms (doubles each attempt, default: 200)
 */

export interface RetryOptions {
  /** Maximum number of attempts (1 = no retries). */
  maxAttempts?: number;
  /** Base delay in ms; doubles on each subsequent attempt. */
  baseDelayMs?: number;
  /** Optional predicate — return false to skip retrying for this error. */
  shouldRetry?: (err: unknown) => boolean;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;

/**
 * Execute `fn`, retrying up to `maxAttempts - 1` times on failure with
 * exponential backoff. The final error is re-thrown if all attempts fail.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !shouldRetry(err)) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Retry options derived from environment variables (for RPC calls). */
function parseEnvInt(name: string, fallback: number): number {
  const value = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function rpcRetryOptions(): RetryOptions {
  return {
    maxAttempts: parseEnvInt("RPC_MAX_RETRIES", DEFAULT_MAX_ATTEMPTS) + 1,
    baseDelayMs: parseEnvInt("RPC_RETRY_BASE_MS", DEFAULT_BASE_DELAY_MS),
  };
}

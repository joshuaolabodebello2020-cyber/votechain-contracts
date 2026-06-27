/**
 * Circuit breaker for Stellar RPC calls.
 *
 * States:
 *   CLOSED   — normal; requests pass through.
 *   OPEN     — tripped; requests fail-fast without hitting RPC.
 *   HALF_OPEN — probe mode; one request allowed to test recovery.
 *
 * Transitions:
 *   CLOSED  → OPEN      after `failureThreshold` consecutive failures.
 *   OPEN    → HALF_OPEN after `resetTimeoutMs` elapses.
 *   HALF_OPEN → CLOSED  on success.
 *   HALF_OPEN → OPEN    on failure.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Consecutive failures before opening. Default: 5 */
  failureThreshold?: number;
  /** ms before moving OPEN → HALF_OPEN. Default: 30_000 */
  resetTimeoutMs?: number;
  /** Name used in error messages / logs. */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  readonly name: string;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.name = opts.name ?? "stellar-rpc";
  }

  getState(): CircuitState {
    return this.state;
  }

  /** Wrap an async RPC call with circuit-breaker protection. */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed < this.resetTimeoutMs) {
        throw new CircuitOpenError(this.name, this.resetTimeoutMs - elapsed);
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.openedAt = null;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
      console.error(
        `[circuit-breaker] ${this.name} OPEN after ${this.failures} failure(s)`
      );
    }
  }

  /** Expose state for health checks. */
  status() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      openedAt: this.openedAt,
    };
  }
}

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;
  constructor(name: string, retryAfterMs: number) {
    super(`Circuit breaker '${name}' is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = "CircuitOpenError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Singleton used by route handlers — configure via env vars. */
export const rpcCircuitBreaker = new CircuitBreaker({
  name: "stellar-rpc",
  failureThreshold: Number(process.env.CB_FAILURE_THRESHOLD ?? 5),
  resetTimeoutMs: Number(process.env.CB_RESET_TIMEOUT_MS ?? 30_000),
});

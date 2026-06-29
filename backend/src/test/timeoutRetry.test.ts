import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "../timeout";
import { withRetry, rpcRetryOptions } from "../retry";

// ── withTimeout ─────────────────────────────────────────────────────────────

describe("withTimeout", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("resolves when promise settles before deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when deadline fires first", async () => {
    const never = new Promise<never>(() => {});
    const raced = withTimeout(never, 50);
    vi.advanceTimersByTime(51);
    await expect(raced).rejects.toBeInstanceOf(TimeoutError);
  });

  it("TimeoutError message includes the configured ms", async () => {
    const never = new Promise<never>(() => {});
    const raced = withTimeout(never, 200);
    vi.advanceTimersByTime(201);
    await expect(raced).rejects.toThrow("200ms");
  });

  it("propagates the original rejection when it beats the timeout", async () => {
    await expect(withTimeout(Promise.reject(new Error("upstream")), 1000))
      .rejects.toThrow("upstream");
  });
});

// ── withRetry ───────────────────────────────────────────────────────────────
// Use real timers with tiny delays (1ms) to avoid fake-timer / unhandled-
// rejection interactions in vitest.

describe("withRetry", () => {
  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("value");
    await expect(withRetry(fn, { maxAttempts: 3 })).resolves.toBe("value");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and eventually succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "done";
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).resolves.toBe("done");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all attempts", async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error("permanent"); });
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn().mockImplementation(async () => { throw new Error("fatal"); });
    await expect(withRetry(fn, { maxAttempts: 5, baseDelayMs: 1, shouldRetry: () => false }))
      .rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff delays", async () => {
    const delays: number[] = [];
    const origSetTimeout = global.setTimeout;
    const spy = vi.spyOn(global, "setTimeout").mockImplementation(
      (cb: any, delay?: number, ...args: any[]) => {
        delays.push(delay ?? 0);
        return origSetTimeout(cb, 0, ...args); // execute immediately
      }
    );

    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 })).resolves.toBe("ok");
    // attempt 1 fail → delay 100 * 2^0 = 100, attempt 2 fail → delay 100 * 2^1 = 200
    expect(delays).toEqual([100, 200]);
    spy.mockRestore();
  });
});

// ── rpcRetryOptions ──────────────────────────────────────────────────────────
describe("rpcRetryOptions", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns configured retry options from env vars", () => {
    process.env.RPC_MAX_RETRIES = "2";
    process.env.RPC_RETRY_BASE_MS = "150";

    const opts = rpcRetryOptions();

    expect(opts.maxAttempts).toBe(3);
    expect(opts.baseDelayMs).toBe(150);
  });

  it("falls back to defaults for invalid env values", () => {
    process.env.RPC_MAX_RETRIES = "invalid";
    process.env.RPC_RETRY_BASE_MS = "invalid";

    const opts = rpcRetryOptions();

    expect(opts.maxAttempts).toBe(4);
    expect(opts.baseDelayMs).toBe(200);
  });
});

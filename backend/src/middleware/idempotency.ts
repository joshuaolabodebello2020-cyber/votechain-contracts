/**
 * Replay / idempotency protection middleware.
 *
 * How it works:
 *   1. Clients include an `Idempotency-Key` header (UUID) with mutating requests.
 *   2. On first receipt the response is stored (in-memory map; swap for Redis in prod).
 *   3. Duplicate submissions with the same key within the TTL window receive the
 *      cached response instead of re-executing — preventing double-processing.
 *   4. Requests without an `Idempotency-Key` are passed through unchanged (GET-safe).
 *
 * Issue: #479
 */

import { Request, Response, NextFunction } from "express";

export interface IdempotencyStore {
  get(key: string): Promise<StoredResponse | null>;
  set(key: string, value: StoredResponse, ttlMs: number): Promise<void>;
}

export interface StoredResponse {
  status: number;
  body: unknown;
  storedAt: number;
}

// ── In-memory store (replace with Redis adapter in production) ───────────────

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, { value: StoredResponse; expiresAt: number }>();

  async get(key: string): Promise<StoredResponse | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: StoredResponse, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Visible for testing. */
  size(): number {
    return this.map.size;
  }
}

// Singleton used by route handlers.
export const defaultStore = new InMemoryIdempotencyStore();

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum key length to reject oversized / garbage values early. */
const MAX_KEY_LENGTH = 128;

/** How long a stored response is considered valid (default: 24 h). */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1_000;

// ── Middleware factory ────────────────────────────────────────────────────────

/**
 * Returns an Express middleware that enforces idempotency for mutating requests
 * (POST / PUT / PATCH / DELETE) when an `Idempotency-Key` header is present.
 *
 * @param store  Backing store — defaults to the in-memory singleton.
 * @param ttlMs  Time-to-live for stored responses in milliseconds.
 */
export function idempotency(
  store: IdempotencyStore = defaultStore,
  ttlMs = DEFAULT_TTL_MS
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only protect mutating methods.
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return next();
    }

    const key = req.headers["idempotency-key"];
    if (!key || typeof key !== "string") {
      return next();
    }

    if (key.length > MAX_KEY_LENGTH) {
      return res.status(400).json({ error: "Idempotency-Key exceeds maximum length" });
    }

    // Replay: return cached response.
    const cached = await store.get(key);
    if (cached) {
      res.setHeader("X-Idempotent-Replayed", "true");
      return res.status(cached.status).json(cached.body);
    }

    // First request: intercept the response and cache it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const stored: StoredResponse = { status: res.statusCode, body, storedAt: Date.now() };
      store.set(key, stored, ttlMs).catch((err) =>
        console.error("[idempotency] store.set error:", err)
      );
      return originalJson(body);
    };

    next();
  };
}

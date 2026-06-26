/**
 * In-memory rate limiter for public API endpoints.
 *
 * Configuration (environment variables):
 *   RATE_LIMIT_WINDOW_MS  — sliding window duration in milliseconds (default: 60000)
 *   RATE_LIMIT_MAX_REQUESTS — maximum requests per window per client (default: 100)
 *
 * Behavior:
 *   - On excess requests: HTTP 429 with Retry-After and X-RateLimit-* headers.
 *   - Client identity is derived from req.ip with fallbacks.
 *   - Expired entries are periodically cleaned up to bound memory usage.
 */
import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10);

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, WINDOW_MS);

function getClientId(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "anonymous";
}

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientId = getClientId(req);
  const now = Date.now();
  const entry = store.get(clientId);

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_REQUESTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(entry.resetAt));
      return res.status(429).json({
        status: "error",
        message: "Too many requests. Please try again later.",
        retryAfter,
      });
    }
    entry.count++;
  } else {
    store.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
  }

  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - (entry?.count ?? 0) - 1)));
  res.setHeader("X-RateLimit-Reset", String(entry?.resetAt ?? now + WINDOW_MS));

  next();
}

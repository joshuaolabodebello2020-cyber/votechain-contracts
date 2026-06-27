/**
 * Structured request logging middleware with correlation IDs.
 *
 * Every HTTP request receives a unique `X-Correlation-ID` header.
 * If the client sends one it is honoured; otherwise a new UUID is generated.
 *
 * Each request is logged as a single JSON line on completion:
 *   {
 *     "ts":          "2026-06-27T07:20:15.826Z",
 *     "correlationId": "550e8400-...",
 *     "method":      "POST",
 *     "path":        "/api/proposals",
 *     "status":      201,
 *     "latencyMs":   12,
 *     "userAgent":   "Mozilla/5.0 ...",
 *     "ip":          "127.0.0.1"
 *   }
 *
 * Error responses include `correlationId` in the body so clients can
 * reference it in support requests.
 *
 * Issue: #460
 */

import { Request, Response, NextFunction } from "express";

// ── Correlation ID ────────────────────────────────────────────────────────────

/** Generates a v4-like UUID without external dependencies. */
function generateId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${(Math.floor(Math.random() * 4) + 8).toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

const HEADER = "x-correlation-id";

/** Attaches a correlation ID to the request and response, then calls next(). */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers[HEADER] as string | undefined) ?? generateId();
  // Make it available to downstream handlers via res.locals.
  res.locals["correlationId"] = id;
  res.setHeader(HEADER, id);
  next();
}

// ── Structured logger ─────────────────────────────────────────────────────────

export interface LogEntry {
  ts: string;
  correlationId: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  userAgent: string;
  ip: string;
}

/** Logs every completed request as a JSON line to stdout. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startMs = Date.now();

  res.on("finish", () => {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      correlationId: (res.locals["correlationId"] as string) ?? "unknown",
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: Date.now() - startMs,
      userAgent: req.headers["user-agent"] ?? "",
      ip: req.ip ?? req.socket.remoteAddress ?? "",
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  });

  next();
}

// ── Error responder helper ─────────────────────────────────────────────────────

/**
 * Wraps an error response body with the correlation ID so clients can trace it.
 *
 * Usage in route handlers:
 *   res.status(500).json(withCorrelationId(res, { error: "something went wrong" }));
 */
export function withCorrelationId(res: Response, body: Record<string, unknown>): Record<string, unknown> {
  return { ...body, correlationId: res.locals["correlationId"] };
}

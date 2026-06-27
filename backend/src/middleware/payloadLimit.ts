import { Request, Response, NextFunction } from "express";

/**
 * Configurable payload size limits for the VoteChain API (#546).
 *
 * All limits are expressed as bytes. The defaults protect the server from
 * memory exhaustion and slow-loris-style attacks without blocking any
 * legitimate governance request (titles ≤128 chars, descriptions ≤1024 chars).
 *
 * Consumers must stay within these limits:
 *   - JSON body:          100 KB  (MAX_JSON_BYTES)
 *   - URL-encoded body:    16 KB  (MAX_URLENCODED_BYTES)
 *   - Individual field:    32 KB  (MAX_FIELD_BYTES)
 */
export const MAX_JSON_BYTES = parseInt(process.env.MAX_JSON_BYTES ?? "102400", 10);       // 100 KB
export const MAX_URLENCODED_BYTES = parseInt(process.env.MAX_URLENCODED_BYTES ?? "16384", 10); // 16 KB
export const MAX_FIELD_BYTES = parseInt(process.env.MAX_FIELD_BYTES ?? "32768", 10);      // 32 KB

/**
 * Returns Express JSON parser options with the configured size limit.
 * Mount before route handlers:
 *   app.use(express.json(jsonParserOptions()))
 */
export function jsonParserOptions(): Parameters<typeof import("express").json>[0] {
  return { limit: MAX_JSON_BYTES };
}

/**
 * Middleware: rejects requests whose Content-Length header already exceeds the
 * JSON limit before the body is parsed. Returns HTTP 413 immediately so the
 * server never reads the oversized body into memory.
 */
export function rejectOversizedRequests(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > MAX_JSON_BYTES) {
    res.status(413).json({
      error: "Payload Too Large",
      message: `Request body must not exceed ${MAX_JSON_BYTES} bytes (${MAX_JSON_BYTES / 1024} KB).`,
      limit_bytes: MAX_JSON_BYTES,
    });
    return;
  }
  next();
}

/**
 * Error-handling middleware: converts Express body-parser errors into
 * well-formed JSON responses.
 *
 * - `PayloadTooLargeError` (status 413) → HTTP 413
 * - Malformed JSON / unsupported media type → HTTP 400
 *
 * Mount AFTER route handlers:
 *   app.use(payloadErrorHandler)
 */
export function payloadErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.type === "entity.too.large" || err.status === 413) {
    res.status(413).json({
      error: "Payload Too Large",
      message: `Request body must not exceed ${MAX_JSON_BYTES} bytes (${MAX_JSON_BYTES / 1024} KB).`,
      limit_bytes: MAX_JSON_BYTES,
    });
    return;
  }

  if (
    err.type === "entity.parse.failed" ||
    err.type === "charset.unsupported" ||
    err.status === 400
  ) {
    res.status(400).json({
      error: "Bad Request",
      message: "Request body could not be parsed. Ensure the body is valid JSON and the Content-Type is application/json.",
    });
    return;
  }

  next(err);
}

/**
 * Middleware: validates that individual string fields in the parsed JSON body
 * do not exceed MAX_FIELD_BYTES bytes. Returns HTTP 400 with the offending
 * field names when the limit is violated.
 *
 * This is a defense-in-depth measure for fields that bypass the top-level
 * size check through gzip or chunked encoding edge cases.
 */
export function validateFieldSizes(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.body || typeof req.body !== "object") {
    return next();
  }

  const oversized: string[] = [];
  for (const [key, value] of Object.entries(req.body)) {
    if (typeof value === "string" && Buffer.byteLength(value, "utf8") > MAX_FIELD_BYTES) {
      oversized.push(key);
    }
  }

  if (oversized.length > 0) {
    res.status(400).json({
      error: "Validation Failed",
      message: `The following fields exceed the maximum allowed size of ${MAX_FIELD_BYTES} bytes: ${oversized.join(", ")}.`,
      limit_bytes: MAX_FIELD_BYTES,
      fields: oversized,
    });
    return;
  }

  next();
}

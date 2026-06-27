import express, { Request, Response } from "express";
import { idempotency, InMemoryIdempotencyStore } from "../middleware/idempotency";

// Minimal test helper — builds a request/response cycle without HTTP.
import httpMocks from "node-mocks-http";

// ── helper: simulate a full Express chain ────────────────────────────────────

async function runMiddleware(
  store: InMemoryIdempotencyStore,
  method: string,
  headers: Record<string, string>,
  handler: (req: Request, res: Response) => void
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const req = httpMocks.createRequest({ method, headers });
  const res = httpMocks.createResponse();

  const mw = idempotency(store, 5_000);

  await new Promise<void>((resolve) => {
    mw(req as unknown as Request, res as unknown as Response, () => {
      handler(req as unknown as Request, res as unknown as Response);
      resolve();
    });
  });

  return {
    status: res.statusCode,
    body: res._getJSONData(),
    headers: res._getHeaders() as Record<string, string>,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("idempotency middleware", () => {
  it("passes through GET requests without a key", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const handler = (_req: Request, res: Response) => {
      calls++;
      res.status(200).json({ calls });
    };

    await runMiddleware(store, "GET", {}, handler);
    await runMiddleware(store, "GET", {}, handler);
    expect(calls).toBe(2);
  });

  it("passes through POST without Idempotency-Key header", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    await runMiddleware(store, "POST", {}, (_req, res) => { calls++; res.status(200).json({}); });
    await runMiddleware(store, "POST", {}, (_req, res) => { calls++; res.status(200).json({}); });
    expect(calls).toBe(2);
  });

  it("executes handler once and replays on duplicate key", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const key = "test-key-abc";
    const handler = (_req: Request, res: Response) => {
      calls++;
      res.status(201).json({ id: 42 });
    };

    const first = await runMiddleware(store, "POST", { "idempotency-key": key }, handler);
    const second = await runMiddleware(store, "POST", { "idempotency-key": key }, handler);

    expect(calls).toBe(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual({ id: 42 });
    expect(second.headers["x-idempotent-replayed"]).toBe("true");
  });

  it("treats different keys independently", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    await runMiddleware(store, "POST", { "idempotency-key": "key-1" }, (_req, res) => { calls++; res.status(201).json({}); });
    await runMiddleware(store, "POST", { "idempotency-key": "key-2" }, (_req, res) => { calls++; res.status(201).json({}); });
    expect(calls).toBe(2);
  });

  it("returns 400 for an oversized key", async () => {
    const store = new InMemoryIdempotencyStore();
    const longKey = "x".repeat(200);
    const req = httpMocks.createRequest({ method: "POST", headers: { "idempotency-key": longKey } });
    const res = httpMocks.createResponse();

    const mw = idempotency(store);
    let nextCalled = false;
    await new Promise<void>((resolve) => {
      mw(req as unknown as Request, res as unknown as Response, () => { nextCalled = true; resolve(); });
      if (!nextCalled) resolve();
    });

    expect(res.statusCode).toBe(400);
  });

  it("expires cached entries after TTL", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;
    const key = "ttl-key";

    await runMiddleware(store, "POST", { "idempotency-key": key }, (_req, res) => {
      calls++;
      res.status(200).json({});
    });
    // Artificially expire by overwriting with past expiry
    (store as unknown as { map: Map<string, { value: unknown; expiresAt: number }> })
      .map.get(key)!.expiresAt = Date.now() - 1;

    await runMiddleware(store, "POST", { "idempotency-key": key }, (_req, res) => {
      calls++;
      res.status(200).json({});
    });
    expect(calls).toBe(2);
  });
});

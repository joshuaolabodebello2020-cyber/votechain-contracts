import httpMocks from "node-mocks-http";
import { correlationId, requestLogger, withCorrelationId, LogEntry } from "../middleware/requestLogger";
import { Request, Response, NextFunction } from "express";

// ── helpers ───────────────────────────────────────────────────────────────────

function runSync(
  mw: (req: Request, res: Response, next: NextFunction) => void,
  req: ReturnType<typeof httpMocks.createRequest>,
  res: ReturnType<typeof httpMocks.createResponse>
) {
  let nextCalled = false;
  mw(req as unknown as Request, res as unknown as Response, () => { nextCalled = true; });
  return nextCalled;
}

// ── correlationId middleware ──────────────────────────────────────────────────

describe("correlationId middleware", () => {
  it("generates a correlation ID and sets the response header", () => {
    const req = httpMocks.createRequest({ headers: {} });
    const res = httpMocks.createResponse();
    runSync(correlationId, req, res);

    const id = res.getHeader("x-correlation-id") as string;
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(res.locals["correlationId"]).toBe(id);
  });

  it("honours an existing Idempotency-Key from the client", () => {
    const clientId = "my-custom-id-123";
    const req = httpMocks.createRequest({ headers: { "x-correlation-id": clientId } });
    const res = httpMocks.createResponse();
    runSync(correlationId, req, res);

    expect(res.getHeader("x-correlation-id")).toBe(clientId);
    expect(res.locals["correlationId"]).toBe(clientId);
  });

  it("calls next()", () => {
    const req = httpMocks.createRequest();
    const res = httpMocks.createResponse();
    expect(runSync(correlationId, req, res)).toBe(true);
  });

  it("generates unique IDs for different requests", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const req = httpMocks.createRequest({ headers: {} });
      const res = httpMocks.createResponse();
      runSync(correlationId, req, res);
      ids.add(res.locals["correlationId"] as string);
    }
    expect(ids.size).toBe(20);
  });
});

// ── requestLogger middleware ──────────────────────────────────────────────────

describe("requestLogger middleware", () => {
  it("logs a JSON entry to stdout on response finish", () => {
    const req = httpMocks.createRequest({ method: "GET", url: "/api/proposals" });
    const res = httpMocks.createResponse({ eventEmitter: require("events").EventEmitter });
    res.locals["correlationId"] = "test-id-456";

    const lines: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
      lines.push(s);
      return true;
    };

    runSync(requestLogger, req, res);
    res.statusCode = 200;
    res.emit("finish");

    (process.stdout as unknown as { write: (s: string) => boolean }).write = origWrite;

    expect(lines.length).toBeGreaterThan(0);
    const entry: LogEntry = JSON.parse(lines[0]);
    expect(entry.correlationId).toBe("test-id-456");
    expect(entry.method).toBe("GET");
    expect(entry.path).toBe("/api/proposals");
    expect(entry.status).toBe(200);
    expect(typeof entry.latencyMs).toBe("number");
    expect(entry.ts).toMatch(/^\d{4}-/);
  });

  it("calls next()", () => {
    const req = httpMocks.createRequest();
    const res = httpMocks.createResponse({ eventEmitter: require("events").EventEmitter });
    expect(runSync(requestLogger, req, res)).toBe(true);
  });
});

// ── withCorrelationId helper ──────────────────────────────────────────────────

describe("withCorrelationId", () => {
  it("merges correlationId into the body", () => {
    const res = httpMocks.createResponse();
    res.locals["correlationId"] = "err-id-789";
    const body = withCorrelationId(res as unknown as Response, { error: "oops" });
    expect(body).toEqual({ error: "oops", correlationId: "err-id-789" });
  });
});

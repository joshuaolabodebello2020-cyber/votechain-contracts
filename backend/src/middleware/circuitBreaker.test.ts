import { CircuitBreaker, CircuitOpenError } from "../middleware/circuitBreaker";

const ok = () => Promise.resolve("ok");
const fail = () => Promise.reject(new Error("rpc error"));

function makeBreaker(threshold = 3, timeout = 500) {
  return new CircuitBreaker({ failureThreshold: threshold, resetTimeoutMs: timeout, name: "test" });
}

describe("CircuitBreaker", () => {
  it("starts CLOSED", () => {
    expect(makeBreaker().getState()).toBe("CLOSED");
  });

  it("passes through successful calls", async () => {
    const cb = makeBreaker();
    await expect(cb.call(ok)).resolves.toBe("ok");
    expect(cb.getState()).toBe("CLOSED");
  });

  it("opens after threshold failures", async () => {
    const cb = makeBreaker(3);
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(fail)).rejects.toThrow("rpc error");
    }
    expect(cb.getState()).toBe("OPEN");
  });

  it("throws CircuitOpenError when OPEN", async () => {
    const cb = makeBreaker(1);
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(ok)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("moves to HALF_OPEN after reset timeout", async () => {
    const cb = makeBreaker(1, 50);
    await expect(cb.call(fail)).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 60));
    // Next call is allowed (HALF_OPEN probe)
    await expect(cb.call(ok)).resolves.toBe("ok");
    expect(cb.getState()).toBe("CLOSED");
  });

  it("re-opens from HALF_OPEN on failure", async () => {
    const cb = makeBreaker(1, 50);
    await expect(cb.call(fail)).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 60));
    await expect(cb.call(fail)).rejects.toThrow("rpc error");
    expect(cb.getState()).toBe("OPEN");
  });

  it("resets failure count on success", async () => {
    const cb = makeBreaker(3);
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(ok)).resolves.toBe("ok");
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.status().failures).toBe(0);
  });
});

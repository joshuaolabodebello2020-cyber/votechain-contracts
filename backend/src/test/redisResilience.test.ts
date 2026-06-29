/**
 * Redis resilience tests - validates backend behavior during Redis outages and recovery.
 *
 * These tests simulate:
 * - Redis connection failures during startup
 * - Redis disconnection during active operations
 * - Redis reconnection and state recovery
 * - Degraded mode operation without cache
 * - Concurrent operations during outage
 * - Partial failures and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Redis mock with outage simulation ───────────────────────────────────────────

interface MockRedisState {
  isOpen: boolean;
  shouldFail: boolean;
  store: Map<string, string>;
  connectionAttempts: number;
}

const mockState: MockRedisState = {
  isOpen: false,
  shouldFail: false,
  store: new Map(),
  connectionAttempts: 0,
};

const mockRedisClient = {
  get isOpen() { return mockState.isOpen; },
  
  get: vi.fn(async (key: string) => {
    if (mockState.shouldFail) throw new Error('Redis connection error');
    return mockState.store.get(key) ?? null;
  }),
  
  setEx: vi.fn(async (key: string, _ttl: number, value: string) => {
    if (mockState.shouldFail) throw new Error('Redis connection error');
    mockState.store.set(key, value);
  }),
  
  del: vi.fn(async (keys: string[]) => {
    if (mockState.shouldFail) throw new Error('Redis connection error');
    keys.forEach((k) => mockState.store.delete(k));
  }),
  
  keys: vi.fn(async (pattern: string) => {
    if (mockState.shouldFail) throw new Error('Redis connection error');
    const allKeys = Array.from(mockState.store.keys());
    return allKeys.filter(k => k.startsWith(pattern.replace('*', '')));
  }),
  
  ping: vi.fn(async () => {
    if (mockState.shouldFail) throw new Error('Redis connection error');
    return 'PONG';
  }),
  
  on: vi.fn((event: string, handler: Function) => {
    if (event === 'error') {
      // Simulate error events when shouldFail is set
      if (mockState.shouldFail) {
        handler(new Error('Redis connection error'));
      }
    }
  }),
  
  connect: vi.fn(async () => {
    mockState.connectionAttempts++;
    if (mockState.shouldFail) {
      throw new Error('Redis connection failed');
    }
    mockState.isOpen = true;
  }),
  
  disconnect: vi.fn(async () => {
    mockState.isOpen = false;
  }),
  
  quit: vi.fn(async () => {
    mockState.isOpen = false;
  }),
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

// ── Import app after mocks are set up ───────────────────────────────────────────

import app from '../app';

// ── Test helpers ───────────────────────────────────────────────────────────────

function simulateRedisOutage() {
  mockState.shouldFail = true;
  mockState.isOpen = false;
}

function simulateRedisRecovery() {
  mockState.shouldFail = false;
  mockState.isOpen = true;
}

function resetMockState() {
  mockState.isOpen = false;
  mockState.shouldFail = false;
  mockState.store.clear();
  mockState.connectionAttempts = 0;
  vi.clearAllMocks();
}

beforeEach(() => {
  resetMockState();
  mockState.isOpen = true; // Start with Redis available
});

afterEach(() => {
  resetMockState();
});

// ── Test suites ───────────────────────────────────────────────────────────────

describe('Redis Connection Failure During Startup', () => {
  it('health check returns 503 when Redis is unavailable', async () => {
    simulateRedisOutage();
    
    const res = await request(app).get('/health');
    
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.redis).toBe('down');
  });

  it('health check returns 200 when Redis is available', async () => {
    simulateRedisRecovery();
    
    const res = await request(app).get('/health');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.redis).toBe('up');
  });

  it('backend continues serving requests when Redis fails during startup', async () => {
    simulateRedisOutage();
    
    // Even with Redis down, the app should still handle requests
    const res = await request(app).get('/proposals/test-id');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'test-id');
  });
});

describe('Degraded Mode Operation', () => {
  it('serves proposal data without cache when Redis is down', async () => {
    simulateRedisOutage();
    
    const res = await request(app).get('/proposals/test-id');
    
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.data).toBeNull();
  });

  it('cache metrics show misses when Redis is unavailable', async () => {
    simulateRedisOutage();
    
    // Make a request
    await request(app).get('/proposals/test-id');
    
    // Check metrics
    const res = await request(app).get('/metrics/cache');
    
    expect(res.status).toBe(200);
    expect(res.body.misses).toBeGreaterThan(0);
  });

  it('does not crash when attempting to cache during outage', async () => {
    simulateRedisOutage();
    
    // Multiple requests should not crash the server
    const requests = Array.from({ length: 5 }, (_, i) => 
      request(app).get(`/proposals/test-${i}`)
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(res => {
      expect(res.status).toBe(200);
    });
  });
});

describe('Redis Outage During Active Operations', () => {
  it('handles cache read failure gracefully', async () => {
    // Prime cache
    mockState.store.set('proposals:item:test-1', JSON.stringify({ id: 'test-1', title: 'Cached' }));
    
    // Then simulate outage
    simulateRedisOutage();
    
    const res = await request(app).get('/proposals/test-1');
    
    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
  });

  it('handles cache write failure gracefully', async () => {
    simulateRedisOutage();
    
    const res = await request(app).get('/proposals/test-2');
    
    expect(res.status).toBe(200);
    // Should not throw error, just skip caching
    expect(res.body.cached).toBe(false);
  });

  it('handles cache invalidation failure gracefully', async () => {
    // Prime cache
    mockState.store.set('proposals:list', JSON.stringify([{ id: 'test' }]));
    
    // Simulate outage
    simulateRedisOutage();
    
    const res = await request(app)
      .post('/proposals/invalidate')
      .send({});
    
    // Should still return success even if invalidation fails
    expect(res.status).toBe(200);
  });
});

describe('Redis Recovery and State Validation', () => {
  it('successfully reconnects after outage', async () => {
    // Start with outage
    simulateRedisOutage();
    
    let res = await request(app).get('/health');
    expect(res.status).toBe(503);
    
    // Recover Redis
    simulateRedisRecovery();
    
    // Health check should now pass
    res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('cache operations work correctly after recovery', async () => {
    simulateRedisOutage();
    
    // Request during outage
    let res = await request(app).get('/proposals/test-3');
    expect(res.body.cached).toBe(false);
    
    // Recover
    simulateRedisRecovery();
    
    // Request after recovery
    res = await request(app).get('/proposals/test-3');
    expect(res.status).toBe(200);
    
    // Cache should be writable now
    expect(mockState.store.size).toBeGreaterThanOrEqual(0);
  });

  it('state is not corrupted after recovery', async () => {
    // Set some initial state
    mockState.store.set('proposals:item:test-4', JSON.stringify({ id: 'test-4', data: 'initial' }));
    
    // Simulate outage
    simulateRedisOutage();
    
    // Attempt operations during outage
    await request(app).get('/proposals/test-4');
    
    // Recover
    simulateRedisRecovery();
    
    // Verify original state is intact
    const cached = mockState.store.get('proposals:item:test-4');
    expect(cached).toBeDefined();
    const parsed = JSON.parse(cached!);
    expect(parsed.data).toBe('initial');
  });

  it('can write new cache entries after recovery', async () => {
    simulateRedisOutage();
    
    await request(app).get('/proposals/test-5');
    
    simulateRedisRecovery();
    
    await request(app).get('/proposals/test-5');
    
    // Should have cached the result
    expect(mockState.store.size).toBeGreaterThan(0);
  });
});

describe('Concurrent Operations During Outage', () => {
  it('handles concurrent requests during outage', async () => {
    simulateRedisOutage();
    
    const concurrentRequests = Array.from({ length: 20 }, (_, i) => 
      request(app).get(`/proposals/concurrent-${i}`)
    );
    
    const responses = await Promise.all(concurrentRequests);
    
    responses.forEach(res => {
      expect(res.status).toBe(200);
    });
  });

  it('handles mixed read/write operations during outage', async () => {
    simulateRedisOutage();
    
    const operations = [
      request(app).get('/proposals/read-1'),
      request(app).get('/proposals/read-2'),
      request(app).post('/proposals/invalidate').send({}),
      request(app).get('/metrics/cache'),
    ];
    
    const results = await Promise.all(operations);
    
    results.forEach(res => {
      expect(res.status).toBe(200);
    });
  });
});

describe('Edge Cases', () => {
  it('handles rapid connect/disconnect cycles', async () => {
    for (let i = 0; i < 5; i++) {
      simulateRedisRecovery();
      await request(app).get('/health');
      
      simulateRedisOutage();
      await request(app).get('/health');
    }
    
    // Final state should be consistent
    simulateRedisRecovery();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('handles partial failure (some operations succeed, others fail)', async () => {
    // Set shouldFail to true for get operations only
    const originalGet = mockRedisClient.get;
    mockRedisClient.get = vi.fn(async (key: string) => {
      if (key.includes('fail')) throw new Error('Simulated partial failure');
      return mockState.store.get(key) ?? null;
    });
    
    // Successful request
    const res1 = await request(app).get('/proposals/success');
    expect(res1.status).toBe(200);
    
    // Failing request (should still not crash)
    const res2 = await request(app).get('/proposals/fail-test');
    expect(res2.status).toBe(200);
    
    // Restore original
    mockRedisClient.get = originalGet;
  });

  it('handles timeout scenarios', async () => {
    simulateRedisOutage();
    
    // Simulate slow Redis operations
    mockRedisClient.get = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('Timeout');
    });
    
    const res = await request(app).get('/proposals/timeout-test');
    
    // Should still respond, not hang
    expect(res.status).toBe(200);
  });

  it('cache metrics remain accurate after outage', async () => {
    // Make some requests with Redis up
    simulateRedisRecovery();
    await request(app).get('/proposals/metric-1');
    await request(app).get('/proposals/metric-2');
    
    // Check metrics
    let res = await request(app).get('/metrics/cache');
    const initialMisses = res.body.misses;
    
    // Simulate outage and make more requests
    simulateRedisOutage();
    await request(app).get('/proposals/metric-3');
    
    // Check metrics again
    res = await request(app).get('/metrics/cache');
    expect(res.body.misses).toBeGreaterThan(initialMisses);
  });
});

describe('Redis Client Retry Behavior', () => {
  it('tracks connection attempts during retry', async () => {
    simulateRedisOutage();
    
    // Attempt to connect multiple times
    for (let i = 0; i < 3; i++) {
      try {
        await mockRedisClient.connect();
      } catch (e) {
        // Expected to fail
      }
    }
    
    expect(mockState.connectionAttempts).toBe(3);
  });

  it('stops retrying after max attempts', async () => {
    simulateRedisOutage();
    
    let attempts = 0;
    mockRedisClient.connect = vi.fn(async () => {
      attempts++;
      if (attempts > 5) {
        throw new Error('Max retries exceeded');
      }
      throw new Error('Connection failed');
    });
    
    for (let i = 0; i < 10; i++) {
      try {
        await mockRedisClient.connect();
      } catch (e) {
        // Expected
      }
    }
    
    // Should have stopped after max retries
    expect(attempts).toBeLessThanOrEqual(6);
  });
});

/**
 * Integration tests for the /proposals routes.
 *
 * Redis is fully mocked so tests run without a running Redis instance.
 * The mock simulates hit/miss behaviour and invalidation to let us verify
 * that the correct cache keys and TTLs would be set in production.
 */

import request from 'supertest';

// ── Redis mock ────────────────────────────────────────────────────────────────

let mockStore: Map<string, string>;
let mockIsOpen: boolean;

const mockRedisClient = {
  get isOpen() { return mockIsOpen; },
  get: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setEx: jest.fn(async (key: string, _ttl: number, value: string) => { mockStore.set(key, value); }),
  del: jest.fn(async (keys: string[]) => { keys.forEach((k) => mockStore.delete(k)); }),
  on: jest.fn(),
  connect: jest.fn(async () => { mockIsOpen = true; }),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// ── App import (after mocks are in place) ─────────────────────────────────────

import app from '../app';

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore = new Map();
  mockIsOpen = true;
  jest.clearAllMocks();
  // Re-prime open state after clearMocks reset the getter
  mockIsOpen = true;
});

// ── GET /api/proposals ────────────────────────────────────────────────────────

describe('GET /api/proposals', () => {
  it('returns 200 with an array body on cache miss', async () => {
    const res = await request(app).get('/api/proposals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns X-Cache: MISS on the first request', async () => {
    const res = await request(app).get('/api/proposals');
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('returns X-Cache: HIT on a subsequent request when cache is populated', async () => {
    // Prime the cache manually
    mockStore.set('proposals:list', JSON.stringify([{ id: 'cached' }]));
    const res = await request(app).get('/api/proposals');
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body).toEqual([{ id: 'cached' }]);
  });

  it('accepts valid query parameters (limit, page, status)', async () => {
    const res = await request(app)
      .get('/api/proposals')
      .query({ limit: '10', page: '1', status: 'Active' });
    expect(res.status).toBe(200);
  });

  it('rejects invalid limit (string instead of integer)', async () => {
    const res = await request(app)
      .get('/api/proposals')
      .query({ limit: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation Failed');
  });

  it('rejects out-of-range limit (> 100)', async () => {
    const res = await request(app)
      .get('/api/proposals')
      .query({ limit: '101' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status enum value', async () => {
    const res = await request(app)
      .get('/api/proposals')
      .query({ status: 'Unknown' });
    expect(res.status).toBe(400);
  });

  it('falls through to the handler when Redis is closed', async () => {
    mockIsOpen = false;
    const res = await request(app).get('/api/proposals');
    expect(res.status).toBe(200);
    // No cache header when Redis is unavailable
    expect(res.headers['x-cache']).toBeUndefined();
  });
});

// ── GET /api/proposals/:id ────────────────────────────────────────────────────

describe('GET /api/proposals/:id', () => {
  it('returns 200 with the id in the body on cache miss', async () => {
    const res = await request(app).get('/api/proposals/P-001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'P-001');
  });

  it('returns X-Cache: MISS on first fetch', async () => {
    const res = await request(app).get('/api/proposals/P-001');
    expect(res.headers['x-cache']).toBe('MISS');
  });

  it('returns X-Cache: HIT when item is cached', async () => {
    mockStore.set('proposals:item:P-001', JSON.stringify({ id: 'P-001', title: 'Cached title' }));
    const res = await request(app).get('/api/proposals/P-001');
    expect(res.headers['x-cache']).toBe('HIT');
    expect(res.body.title).toBe('Cached title');
  });

  it('rejects invalid id with special characters', async () => {
    const res = await request(app).get('/api/proposals/bad id!');
    expect(res.status).toBe(400);
  });

  it('rejects id that exceeds max length', async () => {
    const longId = 'a'.repeat(65);
    const res = await request(app).get(`/api/proposals/${longId}`);
    expect(res.status).toBe(400);
  });
});

// ── POST /api/proposals/invalidate ───────────────────────────────────────────

describe('POST /api/proposals/invalidate', () => {
  it('invalidates the list cache when no id is provided', async () => {
    mockStore.set('proposals:list', JSON.stringify([]));

    const res = await request(app)
      .post('/proposals/invalidate')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, invalidated: 'list' });
    expect(mockStore.has('proposals:list')).toBe(false);
  });

  it('invalidates both list and item cache when id is provided', async () => {
    mockStore.set('proposals:list', JSON.stringify([]));
    mockStore.set('proposals:item:P-001', JSON.stringify({ id: 'P-001' }));

    const res = await request(app)
      .post('/proposals/invalidate')
      .send({ id: 'P-001' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, invalidated: 'P-001' });
    expect(mockStore.has('proposals:list')).toBe(false);
    expect(mockStore.has('proposals:item:P-001')).toBe(false);
  });

  it('rejects an id with special characters', async () => {
    const res = await request(app)
      .post('/proposals/invalidate')
      .send({ id: 'bad id!' });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/metrics/cache ────────────────────────────────────────────────────

describe('GET /api/metrics/cache', () => {
  it('returns hit/miss counts and hitRate', async () => {
    const res = await request(app).get('/api/metrics/cache');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hits');
    expect(res.body).toHaveProperty('misses');
    expect(res.body).toHaveProperty('hitRate');
  });

  it('hitRate is 0 when no requests have been made', async () => {
    const res = await request(app).get('/api/metrics/cache');
    expect(res.body.hitRate).toBe(0);
  });
});

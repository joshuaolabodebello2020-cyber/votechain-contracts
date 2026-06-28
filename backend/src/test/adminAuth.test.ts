import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../middleware/redisCache', () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  cacheProposalList: (_req: unknown, _res: unknown, next: () => void) => next(),
  cacheProposalItem: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCacheMetrics: vi.fn().mockReturnValue({ hits: 5, misses: 2 }),
  invalidateProposalCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middleware/rateLimiter', () => ({
  rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: proposalRouter } = await import('../routes/proposals');

import express, { type Express } from 'express';
import request from 'supertest';

const TEST_ADMIN_KEY = 'test-secret-admin-key-xyz';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', proposalRouter);
  return app;
}

describe('Admin endpoint security: POST /api/proposals/invalidate', () => {
  let app: Express;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('returns 403 when no admin key header is provided', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .send({ id: 'P-101' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 when an incorrect admin key is provided', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', 'wrong-key')
      .send({ id: 'P-101' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 when admin key is empty string', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', '')
      .send({ id: 'P-101' });

    expect(res.status).toBe(403);
  });

  it('returns 200 when the correct admin key is provided', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', TEST_ADMIN_KEY)
      .send({ id: 'P-101' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 500 when ADMIN_API_KEY env var is not set', async () => {
    delete process.env.ADMIN_API_KEY;
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', 'any-key')
      .send({ id: 'P-101' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('SERVER_MISCONFIGURED');
  });
});

describe('Admin endpoint security: GET /api/metrics/cache', () => {
  let app: Express;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('returns 403 when no admin key header is provided', async () => {
    const res = await request(app).get('/api/metrics/cache');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 403 when an incorrect admin key is provided', async () => {
    const res = await request(app)
      .get('/api/metrics/cache')
      .set('X-Admin-Key', 'invalid-key');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('returns 200 with cache metrics when the correct admin key is provided', async () => {
    const res = await request(app)
      .get('/api/metrics/cache')
      .set('X-Admin-Key', TEST_ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('hits');
    expect(res.body.data).toHaveProperty('misses');
  });
});

describe('Public endpoints remain accessible without admin key', () => {
  let app: Express;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('GET /api/proposals is accessible without admin key', async () => {
    const res = await request(app).get('/api/proposals');
    expect(res.status).toBe(200);
  });

  it('GET /api/proposals/:id is accessible without admin key', async () => {
    const res = await request(app).get('/api/proposals/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/proposals/:id/votes is accessible without admin key', async () => {
    const res = await request(app).get('/api/proposals/1/votes');
    expect(res.status).toBe(200);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock redis cache middleware to no-op (no Redis needed in unit tests) ──────
vi.mock('../middleware/redisCache', () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  cacheProposalList: (_req: unknown, _res: unknown, next: () => void) => next(),
  cacheProposalItem: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCacheMetrics: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
  invalidateProposalCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middleware/rateLimiter', () => ({
  rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Import after mocks
const { default: proposalRouter } = await import('../routes/proposals');
const { default: governanceRouter } = await import('../routes/governance');

import express, { type Express } from 'express';
import request from 'supertest';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', proposalRouter);
  app.use('/api', governanceRouter);
  return app;
}

describe('GET /api/proposals', () => {
  let app: Express;
  beforeEach(() => { app = buildApp(); });

  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/proposals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('accepts valid query params', async () => {
    const res = await request(app).get('/api/proposals?limit=5&page=1&status=Active');
    expect(res.status).toBe(200);
  });

  it('rejects invalid status value', async () => {
    const res = await request(app).get('/api/proposals?status=Invalid');
    expect(res.status).toBe(400);
  });

  it('rejects limit above 100', async () => {
    const res = await request(app).get('/api/proposals?limit=200');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/proposals/:id', () => {
  let app: Express;
  beforeEach(() => { app = buildApp(); });

  it('returns 200 with the requested id', async () => {
    const res = await request(app).get('/api/proposals/P-101');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('P-101');
  });

  it('rejects an id that is too long', async () => {
    const longId = 'a'.repeat(65);
    const res = await request(app).get(`/api/proposals/${longId}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/proposals/invalidate', () => {
  let app: Express;
  beforeEach(() => { app = buildApp(); });

  it('returns ok:true when given an id', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .send({ id: 'P-101' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invalidated).toBe('P-101');
  });

  it('returns ok:true and invalidates list when no id given', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.invalidated).toBe('list');
  });
});

describe('GET /api/metrics/cache', () => {
  let app: Express;
  beforeEach(() => { app = buildApp(); });

  it('returns cache metrics object', async () => {
    const res = await request(app).get('/api/metrics/cache');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hits');
    expect(res.body).toHaveProperty('misses');
  });
});

describe('GET /api/governance/stats', () => {
  let app: Express;
  beforeEach(() => { app = buildApp(); });

  it('returns 200 with byState, participationOverTime, topVoters', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byState');
    expect(res.body).toHaveProperty('participationOverTime');
    expect(res.body).toHaveProperty('topVoters');
    expect(res.body).toHaveProperty('avgQuorumAchievement');
  });

  it('byState contains all five proposal states', async () => {
    const res = await request(app).get('/api/governance/stats');
    const { byState } = res.body;
    expect(byState).toHaveProperty('Active');
    expect(byState).toHaveProperty('Passed');
    expect(byState).toHaveProperty('Rejected');
    expect(byState).toHaveProperty('Executed');
    expect(byState).toHaveProperty('Cancelled');
  });
});

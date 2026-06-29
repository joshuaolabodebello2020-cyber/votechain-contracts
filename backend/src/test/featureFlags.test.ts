import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

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

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

describe('Feature Flags - governance stats disabled', () => {
  let app: Express;
  const originalEnv = process.env.FEATURE_GOVERNANCE_STATS;

  beforeEach(async () => {
    process.env.FEATURE_GOVERNANCE_STATS = 'false';
    vi.resetModules();
    const { default: governanceRouter } = await import('../routes/governance');
    app = buildApp();
    app.use('/api', governanceRouter);
  });

  afterEach(() => {
    process.env.FEATURE_GOVERNANCE_STATS = originalEnv;
    vi.resetModules();
  });

  it('returns 503 with FEATURE_DISABLED when flag is false', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.status).toBe(503);
    expect(res.body.errors[0]).toHaveProperty('code', 'FEATURE_DISABLED');
    expect(res.body.errors[0]).toHaveProperty('message');
  });
});

describe('Feature Flags - voter votes disabled', () => {
  let app: Express;
  const originalEnv = process.env.FEATURE_VOTER_VOTES;

  beforeEach(async () => {
    process.env.FEATURE_VOTER_VOTES = 'false';
    vi.resetModules();
    const { default: governanceRouter } = await import('../routes/governance');
    app = buildApp();
    app.use('/api', governanceRouter);
  });

  afterEach(() => {
    process.env.FEATURE_VOTER_VOTES = originalEnv;
    vi.resetModules();
  });

  it('returns 503 with FEATURE_DISABLED when flag is false', async () => {
    const res = await request(app).get('/api/voters/GABC123/votes');
    expect(res.status).toBe(503);
    expect(res.body.errors[0]).toHaveProperty('code', 'FEATURE_DISABLED');
  });
});

describe('Feature Flags - proposal invalidation disabled', () => {
  let app: Express;
  const originalEnv = process.env.FEATURE_PROPOSAL_INVALIDATION;

  beforeEach(async () => {
    process.env.FEATURE_PROPOSAL_INVALIDATION = 'false';
    process.env.ADMIN_API_KEY = 'test-admin-key';
    vi.resetModules();
    const { default: proposalRouter } = await import('../routes/proposals');
    app = buildApp();
    app.use('/api', proposalRouter);
  });

  afterEach(() => {
    process.env.FEATURE_PROPOSAL_INVALIDATION = originalEnv;
    delete process.env.ADMIN_API_KEY;
    vi.resetModules();
  });

  it('returns 503 with FEATURE_DISABLED when flag is false', async () => {
    const res = await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ id: 'P-101' });
    expect(res.status).toBe(503);
    expect(res.body.errors[0]).toHaveProperty('code', 'FEATURE_DISABLED');
  });
});

describe('Feature Flags - advanced metrics disabled', () => {
  let app: Express;
  const originalEnv = process.env.FEATURE_ADVANCED_METRICS;

  beforeEach(async () => {
    process.env.FEATURE_ADVANCED_METRICS = 'false';
    process.env.ADMIN_API_KEY = 'test-admin-key';
    vi.resetModules();
    const { default: proposalRouter } = await import('../routes/proposals');
    app = buildApp();
    app.use('/api', proposalRouter);
  });

  afterEach(() => {
    process.env.FEATURE_ADVANCED_METRICS = originalEnv;
    delete process.env.ADMIN_API_KEY;
    vi.resetModules();
  });

  it('returns 503 with FEATURE_DISABLED when flag is false', async () => {
    const res = await request(app)
      .get('/api/metrics/cache')
      .set('X-Admin-Key', 'test-admin-key');
    expect(res.status).toBe(503);
    expect(res.body.errors[0]).toHaveProperty('code', 'FEATURE_DISABLED');
  });
});

describe('Feature Flags - defaults', () => {
  let app: Express;

  beforeEach(async () => {
    delete process.env.FEATURE_GOVERNANCE_STATS;
    delete process.env.FEATURE_VOTER_VOTES;
    delete process.env.FEATURE_PROPOSAL_INVALIDATION;
    vi.resetModules();
    const { default: governanceRouter } = await import('../routes/governance');
    app = buildApp();
    app.use('/api', governanceRouter);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('governance stats endpoint is enabled by default', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.status).toBe(200);
  });

  it('voter votes endpoint is enabled by default', async () => {
    const res = await request(app).get('/api/voters/GABC123/votes');
    expect(res.status).toBe(200);
  });
});

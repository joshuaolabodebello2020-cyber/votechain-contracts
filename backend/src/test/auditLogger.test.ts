import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { getAuditLog, clearAuditLog } from '../middleware/auditLogger';

vi.mock('../middleware/redisCache', () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  cacheProposalList: (_req: unknown, _res: unknown, next: () => void) => next(),
  cacheProposalItem: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCacheMetrics: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
  invalidateProposalCache: vi.fn().mockResolvedValue(undefined),
}));

import proposalRouter from '../routes/proposals';

const TEST_ADMIN_KEY = 'test-secret-admin-key-xyz';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', proposalRouter);
  return app;
}

describe('Audit logging', () => {
  let app: Express;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    clearAuditLog();
    app = buildApp();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('logs AUTH_SUCCESS on valid admin request', async () => {
    await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', TEST_ADMIN_KEY)
      .send({ id: 'P-101' });

    const logs = getAuditLog();
    const entry = logs.find(l => l.action === 'AUTH_SUCCESS');
    expect(entry).toBeDefined();
    expect(entry?.endpoint).toBe('/proposals/invalidate');
    expect(entry?.method).toBe('POST');
  });

  it('logs AUTH_FAILURE on invalid admin key', async () => {
    await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', 'wrong-key')
      .send({ id: 'P-101' });

    const logs = getAuditLog();
    const entry = logs.find(l => l.action === 'AUTH_FAILURE');
    expect(entry).toBeDefined();
    expect(entry?.statusCode).toBe(403);
  });

  it('logs CACHE_INVALIDATION action on successful invalidate', async () => {
    await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', TEST_ADMIN_KEY)
      .send({ id: 'P-101' });

    const logs = getAuditLog();
    const entry = logs.find(l => l.action === 'CACHE_INVALIDATION');
    expect(entry).toBeDefined();
    expect(entry?.actor).toBe('admin');
  });

  it('does not expose admin key in log entries', async () => {
    await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', TEST_ADMIN_KEY)
      .send({ id: 'P-101' });

    const logs = getAuditLog();
    for (const entry of logs) {
      expect(JSON.stringify(entry)).not.toContain(TEST_ADMIN_KEY);
      expect(entry).not.toHaveProperty('payload');
      expect(entry).not.toHaveProperty('body');
    }
  });

  it('GET /api/audit-log requires admin authentication', async () => {
    const res = await request(app).get('/api/audit-log');
    expect(res.status).toBe(403);
  });

  it('GET /api/audit-log returns entries for authorized admin', async () => {
    await request(app)
      .post('/api/proposals/invalidate')
      .set('X-Admin-Key', TEST_ADMIN_KEY)
      .send({ id: 'P-101' });

    const res = await request(app)
      .get('/api/audit-log')
      .set('X-Admin-Key', TEST_ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('timestamp');
    expect(res.body.data[0]).toHaveProperty('actor');
    expect(res.body.data[0]).toHaveProperty('action');
  });
});

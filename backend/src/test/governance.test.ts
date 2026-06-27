/**
 * Integration tests for the /governance routes.
 *
 * Redis mock is included to prevent real connection attempts when
 * app.ts wires up connectRedis() at import time.
 */

import request from 'supertest';

// ── Redis mock ─────────────────────────────────────────────────────────────────

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    isOpen: true,
    get: jest.fn(async () => null),
    setEx: jest.fn(async () => {}),
    del: jest.fn(async () => {}),
    on: jest.fn(),
    connect: jest.fn(async () => {}),
  })),
}));

import app from '../app';

// ── GET /api/governance/stats ─────────────────────────────────────────────────

describe('GET /api/governance/stats', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.status).toBe(200);
  });

  it('response body contains byState', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.body).toHaveProperty('byState');
  });

  it('byState includes expected proposal states', async () => {
    const res = await request(app).get('/api/governance/stats');
    const states = Object.keys(res.body.byState);
    expect(states).toEqual(
      expect.arrayContaining(['Active', 'Passed', 'Rejected', 'Executed', 'Cancelled'])
    );
  });

  it('response body contains participationOverTime array', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(Array.isArray(res.body.participationOverTime)).toBe(true);
    expect(res.body.participationOverTime.length).toBeGreaterThan(0);
  });

  it('each participationOverTime entry has date and rate fields', async () => {
    const res = await request(app).get('/api/governance/stats');
    for (const entry of res.body.participationOverTime) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('rate');
      expect(typeof entry.rate).toBe('number');
    }
  });

  it('response body contains topVoters array', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(Array.isArray(res.body.topVoters)).toBe(true);
    expect(res.body.topVoters.length).toBeGreaterThan(0);
  });

  it('each topVoters entry has address and total_weight fields', async () => {
    const res = await request(app).get('/api/governance/stats');
    for (const voter of res.body.topVoters) {
      expect(voter).toHaveProperty('address');
      expect(voter).toHaveProperty('total_weight');
      expect(typeof voter.total_weight).toBe('number');
    }
  });

  it('response body contains avgQuorumAchievement', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.body).toHaveProperty('avgQuorumAchievement');
    expect(typeof res.body.avgQuorumAchievement).toBe('number');
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/governance/stats');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

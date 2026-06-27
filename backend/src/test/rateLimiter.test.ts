/**
 * Integration tests for the rate limiter middleware.
 *
 * These exercise the sliding-window logic through the full Express app
 * so headers and 429 responses are verified end-to-end.
 */

import request from 'supertest';

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

// Override the rate-limit cap to a small number so tests run fast
process.env.RATE_LIMIT_MAX_REQUESTS = '3';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

import app from '../app';

describe('Rate limiter middleware', () => {
  it('includes X-RateLimit-Limit header in every response', async () => {
    const res = await request(app).get('/api/proposals');
    expect(res.headers['x-ratelimit-limit']).toBe('3');
  });

  it('returns 429 after exceeding the request cap', async () => {
    // Consume all allowed slots
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/proposals');
    }
    const res = await request(app).get('/api/proposals');
    expect(res.status).toBe(429);
  });

  it('429 response includes Retry-After header', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/proposals');
    }
    const res = await request(app).get('/api/proposals');
    expect(res.headers['retry-after']).toBeDefined();
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('429 response body includes retryAfter field', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/proposals');
    }
    const res = await request(app).get('/api/proposals');
    expect(res.body).toHaveProperty('retryAfter');
    expect(res.body.message).toMatch(/too many requests/i);
  });

  it('X-RateLimit-Remaining decrements with each request', async () => {
    const first = await request(app).get('/api/proposals');
    const second = await request(app).get('/api/proposals');

    const remainingFirst = Number(first.headers['x-ratelimit-remaining']);
    const remainingSecond = Number(second.headers['x-ratelimit-remaining']);
    expect(remainingSecond).toBeLessThan(remainingFirst);
  });
});

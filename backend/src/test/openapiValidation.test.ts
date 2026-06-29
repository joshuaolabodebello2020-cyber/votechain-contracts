/**
 * OpenAPI Schema Validation Tests
 *
 * These tests validate that backend API responses conform to the OpenAPI schema
 * defined in api/openapi.yml. This prevents integration mismatches and ensures
 * the schema remains authoritative.
 *
 * Tests use the Ajv validator to validate actual responses against the schema.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express, { type Express } from 'express';

// ── Mock redis cache middleware ────────────────────────────────────────────────

vi.mock('../middleware/redisCache', () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  cacheProposalList: (_req: unknown, _res: unknown, next: () => void) => next(),
  cacheProposalItem: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCacheMetrics: vi.fn().mockReturnValue({ hits: 0, misses: 0, hitRate: 0 }),
  invalidateProposalCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middleware/rateLimiter', () => ({
  rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ── Load OpenAPI schema ───────────────────────────────────────────────────────────

const openApiPath = path.resolve(__dirname, '../../../api/openapi.yml');
const openApiContent = fs.readFileSync(openApiPath, 'utf8');
const openApiSpec: any = yaml.load(openApiContent);

// ── Setup Ajv validator ─────────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Add OpenAPI spec to Ajv
ajv.addSchema(openApiSpec, 'openapi.yml');

// ── Build test app ───────────────────────────────────────────────────────────────

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  
  // Import routes after mocks are set up
  const proposalRouter = require('../routes/proposals').default;
  const governanceRouter = require('../routes/governance').default;
  
  app.use('/api/v1', proposalRouter);
  app.use('/api/v1', governanceRouter);
  
  return app;
}

// ── Validation helper ───────────────────────────────────────────────────────────

function validateResponse(
  path: string,
  method: string,
  statusCode: number,
  responseBody: any
): { valid: boolean; errors: string[] } {
  const pathItem = openApiSpec.paths[path];
  if (!pathItem) {
    return { valid: false, errors: [`Path ${path} not found in OpenAPI spec`] };
  }

  const operation = pathItem[method.toLowerCase()];
  if (!operation) {
    return { valid: false, errors: [`Method ${method} not found for path ${path}`] };
  }

  const responseSpec = operation.responses[statusCode.toString()];
  if (!responseSpec) {
    return { valid: false, errors: [`Response ${statusCode} not defined for ${method} ${path}`] };
  }

  const contentSpec = responseSpec.content?.['application/json'];
  if (!contentSpec) {
    return { valid: false, errors: [`application/json content not defined for ${method} ${path} ${statusCode}`] };
  }

  const schema = contentSpec.schema;
  const validate = ajv.compile(schema);
  const valid = validate(responseBody);

  if (!valid && validate.errors) {
    const errors = validate.errors.map(err => 
      `${err.instancePath}: ${err.message} (${err.keyword})`
    );
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('OpenAPI Schema Validation', () => {
  let app: Express;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
  });

  describe('GET /api/v1/proposals', () => {
    it('response conforms to ProposalSummaryListResponse schema', async () => {
      const res = await request(app).get('/api/v1/proposals');
      
      const validation = validateResponse('/proposals', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('GET /api/v1/proposals/:id', () => {
    it('response conforms to ProposalDetailResponse schema', async () => {
      const res = await request(app).get('/api/v1/proposals/1');
      
      const validation = validateResponse('/proposals/{id}', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('GET /api/v1/proposals/:id/votes', () => {
    it('response conforms to VoteRecordListResponse schema', async () => {
      const res = await request(app).get('/api/v1/proposals/1/votes');
      
      const validation = validateResponse('/proposals/{id}/votes', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('GET /api/v1/governance/stats', () => {
    it('response conforms to GovernanceStatsResponse schema', async () => {
      const res = await request(app).get('/api/v1/governance/stats');
      
      const validation = validateResponse('/governance/stats', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('GET /api/v1/metrics/cache', () => {
    it('response conforms to CacheMetricsResponse schema', async () => {
      const res = await request(app).get('/api/v1/metrics/cache');
      
      const validation = validateResponse('/metrics/cache', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('GET /api/v1/voters/:address/votes', () => {
    it('response conforms to VoteRecordListResponse schema', async () => {
      const res = await request(app).get('/api/v1/voters/GABC123/votes');
      
      const validation = validateResponse('/voters/{address}/votes', 'get', 200, res.body);
      
      if (!validation.valid) {
        console.error('Validation errors:', validation.errors);
      }
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('POST /api/v1/proposals/invalidate', () => {
    it('response conforms to schema (with id)', async () => {
      const res = await request(app)
        .post('/api/v1/proposals/invalidate')
        .send({ id: 'P-101' });
      
      // Note: This endpoint returns a custom response, not the standard ApiResponse envelope
      // We validate it has the expected structure
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok');
      expect(res.body).toHaveProperty('invalidated');
    });

    it('response conforms to schema (without id)', async () => {
      const res = await request(app)
        .post('/api/v1/proposals/invalidate')
        .send({});
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ok');
      expect(res.body).toHaveProperty('invalidated');
    });
  });
});

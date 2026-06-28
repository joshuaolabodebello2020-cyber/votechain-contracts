# OpenAPI Schema Validation

This document describes the OpenAPI schema validation implementation for the VoteChain backend API.

## Overview

The backend uses a two-layer validation approach to ensure API responses conform to the OpenAPI schema:

1. **Runtime Validation** - `express-openapi-validator` middleware validates responses in development/production
2. **Test Validation** - Ajv-based tests validate responses against the schema in CI

This dual approach ensures:
- Schema compliance is enforced at runtime
- Schema mismatches are caught in CI before deployment
- The OpenAPI spec remains the single source of truth

## Architecture

### Runtime Validation (express-openapi-validator)

The backend uses `express-openapi-validator` middleware configured in `src/app.ts`:

```typescript
app.use(
  OpenApiValidator.middleware({
    apiSpec: path.resolve(__dirname, "../../api/openapi.yml"),
    validateRequests: true,
    validateResponses: true,
    validateSecurity: false,
  })
);
```

This middleware:
- Validates incoming requests against the OpenAPI schema
- Validates outgoing responses against the OpenAPI schema
- Returns 400/500 errors with detailed messages when validation fails

### Test Validation (Ajv)

The test suite in `src/test/openapiValidation.test.ts` uses Ajv to validate responses:

- Loads the OpenAPI schema from `api/openapi.yml`
- Uses Ajv with `ajv-formats` for schema validation
- Makes actual HTTP requests to the test app
- Validates responses against the corresponding schema definitions
- Fails tests with detailed error messages on mismatches

## Running Validation Tests

### Run all OpenAPI validation tests

```bash
cd backend
npm run test:openapi
```

### Run with coverage

```bash
cd backend
npm run test:coverage
```

### Run as part of full test suite

```bash
cd backend
npm test
```

## Test Coverage

The validation tests cover all API endpoints:

| Endpoint | Method | Schema |
|----------|--------|--------|
| `/api/v1/proposals` | GET | ProposalSummaryListResponse |
| `/api/v1/proposals/:id` | GET | ProposalDetailResponse |
| `/api/v1/proposals/:id/votes` | GET | VoteRecordListResponse |
| `/api/v1/governance/stats` | GET | GovernanceStatsResponse |
| `/api/v1/metrics/cache` | GET | CacheMetricsResponse |
| `/api/v1/voters/:address/votes` | GET | VoteRecordListResponse |
| `/api/v1/proposals/invalidate` | POST | Custom response |

## Adding New Endpoints

When adding a new API endpoint:

1. **Add the endpoint to the OpenAPI spec** (`api/openapi.yml`)
   - Define the path and method
   - Define request parameters
   - Define response schemas

2. **Implement the endpoint** in the appropriate route file
   - Follow the existing pattern using `sendSuccess()` or `sendError()`
   - Ensure responses match the schema structure

3. **Add a validation test** in `src/test/openapiValidation.test.ts`
   ```typescript
   describe('GET /api/v1/new-endpoint', () => {
     it('response conforms to NewEndpointResponse schema', async () => {
       const res = await request(app).get('/api/v1/new-endpoint');
       
       const validation = validateResponse('/new-endpoint', 'get', 200, res.body);
       
       if (!validation.valid) {
         console.error('Validation errors:', validation.errors);
       }
       
       expect(validation.valid).toBe(true);
       expect(validation.errors).toEqual([]);
     });
   });
   ```

4. **Run the validation tests** to ensure compliance
   ```bash
   npm run test:openapi
   ```

## Schema Structure

The OpenAPI schema uses a standard response envelope:

```typescript
interface ApiResponse<T> {
  data: T | null;           // The response payload
  errors: ApiError[] | null; // Array of errors (null on success)
  meta: ApiMeta | null;      // Optional metadata (pagination, cache info, etc.)
}

interface ApiError {
  code: string;
  message: string;
}
```

All successful responses use this envelope with `data` containing the actual payload and `errors: null`.

Error responses use the same envelope with `data: null` and `errors` containing error details.

## Common Validation Errors

### Missing Required Fields

If a response is missing a required field defined in the schema:

```
Error: /data/0/title is required
```

**Fix**: Add the missing field to the response in the route handler.

### Type Mismatch

If a field has the wrong type:

```
Error: /data/0/quorum must be integer
```

**Fix**: Ensure the field type matches the schema (e.g., use `Number()` instead of string).

### Enum Value Invalid

If an enum field has an invalid value:

```
Error: /data/0/state must be equal to one of the allowed values
```

**Fix**: Use only values defined in the enum (e.g., "active", "passed", etc.).

### Additional Properties

If the response includes fields not defined in the schema:

```
Error: /data/0 must NOT have additional properties
```

**Fix**: Either remove the extra field or add it to the schema definition.

## CI Integration

To ensure schema validation runs in CI, add to your CI pipeline:

```yaml
- name: Install dependencies
  run: |
    cd backend
    npm install

- name: Run OpenAPI validation tests
  run: |
    cd backend
    npm run test:openapi
```

This ensures any schema mismatches are caught before deployment.

## Troubleshooting

### Tests fail with "Path not found in OpenAPI spec"

**Cause**: The endpoint path in the test doesn't match the OpenAPI spec.

**Fix**: Ensure the path in the test matches exactly (including `/api/v1` prefix if needed).

### Tests fail with "Response not defined"

**Cause**: The response status code isn't defined in the OpenAPI spec.

**Fix**: Add the response status code to the OpenAPI spec for that endpoint.

### Validation passes but runtime validation fails

**Cause**: The test environment differs from production (e.g., different data sources).

**Fix**: Ensure the test uses the same data sources or mocks that match production behavior.

## Dependencies

- `ajv` - JSON Schema validator
- `ajv-formats` - Format validators for Ajv
- `js-yaml` - YAML parser for loading OpenAPI spec
- `express-openapi-validator` - Runtime validation middleware

## References

- [OpenAPI Specification](https://swagger.io/specification/)
- [express-openapi-validator Documentation](https://github.com/cdimascio/express-openapi-validator)
- [Ajv Documentation](https://ajv.js.org/)

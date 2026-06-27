# VoteChain Backend API Validation Documentation

Enforce schema validation on all incoming API request payloads to ensure data integrity and prevent malformed data from reaching underlying controllers/RPC connections.

## Validation Middleware (`backend/src/middleware/requestValidator.ts`)

A custom, zero-dependency middleware validator that matches request parameters against a declarative schema definition:
- Performs type enforcement (`string`, `number`, `integer`, `boolean`).
- Validates field constraints (e.g. `min`, `max`, `pattern` regexes, `enum` sets).
- Coerces types from string-based query/params input into native values.
- Returns HTTP 400 with a list of validation errors if validation fails.

### Standard Error Response Shape (HTTP 400)

```json
{
  "error": "Validation Failed",
  "messages": [
    "Field 'id' in params must have length at least 1."
  ]
}
```

---

## Validation Schema Reference

### 1. `GET /api/proposals`
Retrieves a list of proposals.

- **Query Parameters**:
  - `limit` (Optional): Integer. Min: 1, Max: 100.
  - `page` (Optional): Integer. Min: 1.
  - `status` (Optional): String. Enum: `["Active", "Passed", "Rejected", "Executed", "Cancelled"]`.

### 2. `GET /api/proposals/:id`
Retrieves details of a single proposal.

- **Path Parameters**:
  - `id` (Required): String. Length: 1-64. Pattern: `^[a-zA-Z0-9_-]+$`.

### 3. `POST /api/proposals/invalidate`
Called by the event indexer on new on-chain events to clear Redis cache caches.

- **Body Parameters**:
  - `id` (Optional): String. Length: 1-64. Pattern: `^[a-zA-Z0-9_-]+$`.

### 4. `GET /api/governance/stats`
Returns governance metrics.

- **Parameters**:
  - None expected. Empty schema validation is applied.

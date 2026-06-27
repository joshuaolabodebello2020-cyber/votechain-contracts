# Replay / Idempotency Protection

## Overview

VoteChain protects against duplicate transaction submissions at two layers:

### 1. On-chain (Soroban contract)

The governance contract natively prevents replayed state changes:

| Operation | Protection |
|-----------|-----------|
| `cast_vote` | `HasVoted(proposal_id, voter)` flag stored in persistent storage — second call returns `AlreadyVoted` |
| `initialize` | `ContractState` flag — second call returns `AlreadyInitialized` |
| `finalise` | Proposal must be `Active` — already-finalised proposals return `ProposalNotActive` |
| `execute` | Proposal must be `Passed` — returns `ProposalNotPassed` otherwise |
| `cancel` | Proposal must be `Active` — returns `ProposalNotActive` otherwise |

State remains consistent after repeated calls because every operation checks the current proposal state before mutating storage.

### 2. Backend API (HTTP layer)

The `idempotency` middleware (`backend/src/middleware/idempotency.ts`) protects mutating HTTP endpoints from double-processing.

#### How to use

Include an `Idempotency-Key` header with every POST / PUT / PATCH / DELETE request:

```http
POST /api/proposals/invalidate
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{"id": "42"}
```

- First request: handler executes; response is stored for 24 hours.
- Duplicate request (same key, within 24 h): cached response returned immediately with `X-Idempotent-Replayed: true` header.
- Request without key: passes through normally (no protection applied).
- Key > 128 characters: rejected with `400 Bad Request`.

#### Production deployment

The default store is in-memory. For multi-instance deployments, replace `defaultStore` with a Redis-backed implementation:

```typescript
import { idempotency } from "./middleware/idempotency";
import { RedisIdempotencyStore } from "./middleware/redisIdempotencyStore"; // custom adapter

router.post("/my-route", idempotency(new RedisIdempotencyStore(redisClient)), handler);
```

## Test coverage

`backend/src/middleware/idempotency.test.ts` covers:

- GET requests pass through unchanged
- POST without key passes through unchanged
- Same key → single handler execution, response replayed
- Different keys → independent executions
- Oversized key → 400 error
- Expired TTL → handler re-executes

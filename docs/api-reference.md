# VoteChain Backend API Reference

> **Kept in sync with [`api/openapi.yml`](../api/openapi.yml)**

VoteChain exposes two independent REST services:

| Service | Default port | Description |
|---------|-------------|-------------|
| **Backend API** | `:3001` | Express server with Redis caching; proxies and caches governance data |
| **Indexer API** | `:4000` | Rust/Axum service; ingests on-chain events and serves raw event data |

---

## Base URLs

| Environment | Backend | Indexer |
|-------------|---------|---------|
| Local | `http://localhost:3001/api` | `http://localhost:4000` |
| Testnet | `https://api-testnet.votechain.io/api` | `https://indexer-testnet.votechain.io` |

---

## Authentication

No authentication is required. All endpoints are publicly accessible.

---

## Rate Limiting

The backend API applies an in-memory rate limiter to all `/api/*` routes.

**Defaults:**

| Parameter | Default | Environment variable |
|-----------|---------|---------------------|
| Window duration | 60 s | `RATE_LIMIT_WINDOW_MS` |
| Max requests per window | 100 | `RATE_LIMIT_MAX_REQUESTS` |

Client identity is derived from the source IP address.

**Response headers (every request):**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp (ms) when the window resets |

**On limit exceeded — `429 Too Many Requests`:**

```json
{
  "status": "error",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 42
}
```

Additional header: `Retry-After: <seconds>`.

The indexer API (`localhost:4000`) has no rate limiting.

---

## Error Schema

Backend and indexer errors follow this shape:

```json
{
  "code": "NOT_FOUND",
  "message": "Proposal 99 not found"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable description |

---

## Backend API Endpoints

All paths are prefixed with `/api`.

---

### GET /api/proposals

List proposals with optional filtering and pagination.

**Query parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `page` | integer ≥ 1 | No | 1 | Page number |
| `limit` | integer 1–100 | No | 20 | Items per page |
| `status` | string | No | — | Filter by state: `Active`, `Passed`, `Rejected`, `Executed`, `Cancelled` |

**Response `200 OK`:**

```json
[
  {
    "id": 1,
    "title": "Increase Treasury Allocation",
    "state": "Active",
    "quorum": 5000000,
    "start_time": 1750000000,
    "end_time": 1750604800
  },
  {
    "id": 2,
    "title": "Add New Council Member",
    "state": "Passed",
    "quorum": 3000000,
    "start_time": 1749000000,
    "end_time": 1749604800
  }
]
```

**Response schema — array of `ProposalSummary`:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Proposal ID |
| `title` | string | Proposal title |
| `state` | string | `Active` \| `Passed` \| `Rejected` \| `Executed` \| `Cancelled` |
| `quorum` | integer | Minimum votes required |
| `start_time` | integer | Voting start (Unix timestamp) |
| `end_time` | integer | Voting end (Unix timestamp) |

**Example:**

```bash
curl "http://localhost:3001/api/proposals?status=Active&limit=10"
```

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | Invalid query parameter value |
| `429 Too Many Requests` | Rate limit exceeded |

---

### GET /api/proposals/:id

Fetch full details for a single proposal.

**Path parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string (alphanumeric, max 64 chars) | Yes | Proposal ID |

**Response `200 OK`:**

```json
{
  "id": 1,
  "proposer": "GABC1234DEFG5678HIJK9012LMNO3456PQRS7890TUVW1234XYZA5678BCDE",
  "title": "Increase Treasury Allocation",
  "description": "Allocate 10M tokens from the reserve to fund Q3 development.",
  "quorum": 5000000,
  "votes_yes": 6200000,
  "votes_no": 800000,
  "votes_abstain": 1500000,
  "start_time": 1750000000,
  "end_time": 1750604800,
  "state": "Passed",
  "execute_after": 1750691200
}
```

**Response schema — `ProposalDetail`:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Proposal ID |
| `proposer` | string | Stellar address of the proposer |
| `title` | string | Proposal title |
| `description` | string | Proposal description |
| `quorum` | integer | Minimum votes required |
| `votes_yes` | integer | Total yes vote weight |
| `votes_no` | integer | Total no vote weight |
| `votes_abstain` | integer | Total abstain vote weight |
| `start_time` | integer | Voting start (Unix timestamp) |
| `end_time` | integer | Voting end (Unix timestamp) |
| `state` | string | `Active` \| `Passed` \| `Rejected` \| `Executed` \| `Cancelled` |
| `execute_after` | integer | Earliest execution timestamp (Unix) |

**Example:**

```bash
curl "http://localhost:3001/api/proposals/1"
```

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | `id` fails validation (non-alphanumeric, too long) |
| `404 Not Found` | Proposal does not exist |
| `429 Too Many Requests` | Rate limit exceeded |

---

### POST /api/proposals/invalidate

Invalidate the Redis cache for a proposal or for the entire proposal list. Intended to be called by the event indexer when new on-chain events arrive.

**Request body (JSON, optional):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (alphanumeric, max 64 chars) | No | Proposal ID to invalidate. Omit to invalidate the full list cache. |

**Example — invalidate a single proposal:**

```bash
curl -X POST http://localhost:3001/api/proposals/invalidate \
  -H "Content-Type: application/json" \
  -d '{"id": "1"}'
```

**Example — invalidate list cache:**

```bash
curl -X POST http://localhost:3001/api/proposals/invalidate \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response `200 OK`:**

```json
{ "ok": true, "invalidated": "1" }
```

```json
{ "ok": true, "invalidated": "list" }
```

**Error responses:**

| Status | When |
|--------|------|
| `400 Bad Request` | `id` fails validation |
| `429 Too Many Requests` | Rate limit exceeded |

---

### GET /api/metrics/cache

Return hit/miss counters for the Redis proposal cache.

**No parameters.**

**Example:**

```bash
curl "http://localhost:3001/api/metrics/cache"
```

**Response `200 OK`:**

```json
{
  "hits": 1042,
  "misses": 38
}
```

**Error responses:**

| Status | When |
|--------|------|
| `429 Too Many Requests` | Rate limit exceeded |

---

### GET /api/governance/stats

Return governance health metrics aggregated across all proposals.

**No parameters.**

**Example:**

```bash
curl "http://localhost:3001/api/governance/stats"
```

**Response `200 OK`:**

```json
{
  "byState": {
    "Active": 3,
    "Passed": 12,
    "Rejected": 5,
    "Executed": 10,
    "Cancelled": 2
  },
  "participationOverTime": [
    { "date": "2026-01", "rate": 42 },
    { "date": "2026-02", "rate": 55 }
  ],
  "topVoters": [
    { "address": "GABC...1234", "total_weight": 9800000 },
    { "address": "GDEF...5678", "total_weight": 7200000 }
  ],
  "avgQuorumAchievement": 73
}
```

**Response schema:**

| Field | Type | Description |
|-------|------|-------------|
| `byState` | object | Proposal count keyed by state |
| `participationOverTime` | array | Monthly participation rate (`date`: YYYY-MM, `rate`: integer %) |
| `topVoters` | array | Top 10 voters by cumulative weight (`address`, `total_weight`) |
| `avgQuorumAchievement` | integer | Average quorum achievement across all proposals (%) |

**Error responses:**

| Status | When |
|--------|------|
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Upstream data fetch failed |

---

## Indexer API Endpoints

The indexer API runs on port `4000` with no path prefix and no rate limiting.

---

### GET /events

Return the 100 most recent ingested on-chain contract events, ordered by ledger descending.

**No parameters.**

**Example:**

```bash
curl "http://localhost:4000/events"
```

**Response `200 OK`:**

```json
[
  {
    "id": 501,
    "ledger_seq": 5823041,
    "tx_hash": "a3f1...9c2d",
    "topic": "vote",
    "proposal_id": 7,
    "payload": { "voter": "GABC...1234", "vote": "yes", "weight": 2000000 },
    "ingested_at": "2026-06-26T14:02:11Z"
  },
  {
    "id": 500,
    "ledger_seq": 5823038,
    "tx_hash": "b9e4...2a71",
    "topic": "created",
    "proposal_id": 7,
    "payload": { "proposer": "GDEF...5678", "title": "Increase Treasury" },
    "ingested_at": "2026-06-26T14:01:44Z"
  }
]
```

**Response schema — array of `EventRow`:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Internal event ID |
| `ledger_seq` | integer | Stellar ledger sequence number |
| `tx_hash` | string | Transaction hash |
| `topic` | string | Event topic: `init`, `created`, `vote`, `final`, `executed`, `cancelled`, `qupdate`, `admxfer`, `paused`, `unpaused`, `durationupdate` |
| `proposal_id` | integer \| null | Proposal ID (null for contract-level events) |
| `payload` | object | Raw event payload (topic-dependent structure) |
| `ingested_at` | string (ISO 8601) | Timestamp when the event was stored |

---

### GET /events/proposals/:id

Return all events for a specific proposal, ordered by ledger ascending (chronological order).

**Path parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | Proposal ID |

**Example:**

```bash
curl "http://localhost:4000/events/proposals/7"
```

**Response `200 OK`:**

```json
[
  {
    "id": 500,
    "ledger_seq": 5823038,
    "tx_hash": "b9e4...2a71",
    "topic": "created",
    "proposal_id": 7,
    "payload": { "proposer": "GDEF...5678", "title": "Increase Treasury" },
    "ingested_at": "2026-06-26T14:01:44Z"
  },
  {
    "id": 501,
    "ledger_seq": 5823041,
    "tx_hash": "a3f1...9c2d",
    "topic": "vote",
    "proposal_id": 7,
    "payload": { "voter": "GABC...1234", "vote": "yes", "weight": 2000000 },
    "ingested_at": "2026-06-26T14:02:11Z"
  },
  {
    "id": 520,
    "ledger_seq": 5824100,
    "tx_hash": "c7d2...8e53",
    "topic": "final",
    "proposal_id": 7,
    "payload": { "state": "passed", "votes_yes": 6200000, "votes_no": 800000 },
    "ingested_at": "2026-06-26T16:00:05Z"
  }
]
```

Same `EventRow` schema as [GET /events](#get-events).

Returns an empty array `[]` if no events exist for the given proposal ID.

---

### GET /stats/participation

Return voter participation statistics derived from all `vote` events, showing the top 100 most active voters by vote count.

**No parameters.**

**Example:**

```bash
curl "http://localhost:4000/stats/participation"
```

**Response `200 OK`:**

```json
[
  { "voter": "GABC...1234", "vote_count": 18 },
  { "voter": "GDEF...5678", "vote_count": 15 },
  { "voter": "GHIJ...9012", "vote_count": 9 }
]
```

**Response schema — array of `VoterStats`:**

| Field | Type | Description |
|-------|------|-------------|
| `voter` | string | Stellar address of the voter |
| `vote_count` | integer | Number of proposals this voter has voted on |

---

## Indexer Event Topics

Events ingested from the on-chain governance contract:

| Topic | Description |
|-------|-------------|
| `init` | Contract initialized |
| `created` | Proposal created |
| `vote` | Vote cast |
| `final` | Proposal finalized (passed or rejected) |
| `executed` | Proposal executed |
| `cancelled` | Proposal cancelled |
| `qupdate` | Quorum updated |
| `admxfer` | Admin transferred |
| `paused` | Contract paused |
| `unpaused` | Contract unpaused |
| `durationupdate` | Voting duration updated |

---

### GET /api/governance/stats

Returns governance health metrics: proposal counts by state, participation over time, top voters, and average quorum achievement.

**No parameters.**

**Example:**

```bash
curl "http://localhost:3001/api/governance/stats"
```

**Response `200 OK`:**

```json
{
  "byState": {
    "Active": 3,
    "Passed": 12,
    "Rejected": 5,
    "Executed": 10,
    "Cancelled": 2
  },
  "participationOverTime": [
    { "date": "2026-01", "rate": 42 },
    { "date": "2026-06", "rate": 64 }
  ],
  "topVoters": [
    { "address": "GABC...1234", "total_weight": 9800000 }
  ],
  "avgQuorumAchievement": 73
}
```

---

## Keeping in Sync with openapi.yml

The indexer `/proposals`, `/proposals/{id}`, `/proposals/{id}/votes`, and `/voters/{address}/votes` routes defined in [`api/openapi.yml`](../api/openapi.yml) are served through the backend API's cached proposal endpoints. When `openapi.yml` schemas change, update the corresponding sections in this document and the backend route handlers.

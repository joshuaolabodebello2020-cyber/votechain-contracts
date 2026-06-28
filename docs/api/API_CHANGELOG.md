# API Changelog

All breaking and notable changes to the VoteChain backend API and contract interfaces are documented here. Integrators should review this before upgrading.

This changelog follows the principles of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Only changes that affect external consumers are listed — internal refactors and test-only changes are omitted.

---

## How to Use This Document

- **Before upgrading**, check for entries newer than your current version.
- **Breaking changes** are flagged with a ⚠ prefix and include migration guidance.
- **Deprecated** features will be removed in a future version — migrate away promptly.
- Entries are added to `[Unreleased]` during development and moved to a versioned heading at release time.

---

## [Unreleased]

### Breaking

- ⚠ **Admin endpoints now require authentication.** `POST /proposals/invalidate` and `GET /metrics/cache` require an `X-Admin-Key` header matching the server's `ADMIN_API_KEY` environment variable. Requests without a valid key receive `403 Forbidden`.
  - **Migration:** Set the `ADMIN_API_KEY` env var on the server and include `X-Admin-Key: <key>` in all requests to admin endpoints.

### Added

- `requireAdmin` middleware for protecting admin-only endpoints.
- Security regression tests for admin endpoint access control.
- Frontend validation mutation tests covering boundary and malformed input cases.

---

## [1.0.0] — 2026-04-27

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/proposals` | List proposals (paginated) |
| GET | `/api/v1/proposals/:id` | Get proposal details |
| GET | `/api/v1/proposals/:id/votes` | List votes for a proposal |
| POST | `/api/v1/proposals/invalidate` | Invalidate proposal cache (admin) |
| GET | `/api/v1/governance/stats` | Governance dashboard metrics |
| GET | `/api/v1/voters/:address/votes` | Vote history for a voter |
| GET | `/api/v1/metrics/cache` | Cache hit/miss counters (admin) |
| GET | `/live` | Liveness probe |
| GET | `/ready` | Readiness probe (includes Redis) |

### Contract Interface

| Contract | Function | Description |
|----------|----------|-------------|
| Governance | `initialize` | Set up governance parameters |
| Governance | `create_proposal` | Create a new proposal |
| Governance | `cast_vote` | Cast a vote (Yes/No/Abstain) |
| Governance | `finalise` | Finalize a proposal after voting ends |
| Governance | `execute` | Execute a passed proposal |
| Governance | `cancel` | Cancel an active proposal (admin) |
| Governance | `get_proposal` | Read proposal state |
| Governance | `has_voted` | Check if address voted |
| Governance | `proposal_count` | Total proposal count |
| Governance | `update_quorum` | Update quorum on active proposal (admin) |
| Governance | `get_version` | Contract semver tuple |
| Token | `initialize` | Set up token parameters |
| Token | `transfer` | Transfer tokens |
| Token | `approve` | Approve spender allowance |
| Token | `transfer_from` | Transfer using allowance |
| Token | `mint` | Mint new tokens (admin) |
| Token | `burn` | Burn tokens |
| Token | `total_supply` | Current total supply |
| Token | `balance` | Balance of an address |
| Token | `get_version` | Contract semver tuple |

### Response Envelope

All API responses use a standard envelope:

```json
{
  "data": <payload | null>,
  "errors": [{"code": "...", "message": "..."}] | null,
  "meta": {} | null
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request failed schema validation |
| `FORBIDDEN` | 403 | Admin access required |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVER_MISCONFIGURED` | 500 | Required server configuration is missing |

---

## Versioning Policy

- The API is versioned under `/api/v1/`. A new major version (`/api/v2/`) will be introduced for breaking changes to the REST API.
- Contract interfaces are versioned via the `get_version` function which returns a `(major, minor, patch)` tuple.
- Breaking changes to the contract interface will bump the major version.
- This changelog is updated before every release.

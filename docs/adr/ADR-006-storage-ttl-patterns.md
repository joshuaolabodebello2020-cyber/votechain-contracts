# ADR-006: Storage TTL Patterns

**Status:** Accepted  
**Date:** 2026-06-26

## Context

Soroban provides three storage tiers — `persistent`, `instance`, and `temporary` — each with different TTL semantics. Choosing the wrong tier causes either premature data loss (too short-lived) or unnecessary ledger bloat (entries that never expire). VoteChain contracts store several distinct kinds of data with different durability requirements, so a deliberate mapping was needed.

## Decision

### Governance contract (`votechain-governance`)

| Entry | Key | Storage tier | Rationale |
|---|---|---|---|
| Proposal data | `DataKey::Proposal(id)` | `persistent` | Proposals must survive for the full voting period and remain readable after finalisation/execution. |
| Vote record | `DataKey::HasVoted(proposal_id, voter)` | `persistent` | Double-vote prevention must be enforced for as long as a proposal is active; records must outlast the voting period. |
| Admin address | `DataKey::Admin` | `instance` | Global configuration tied to the contract's lifetime; must be available as long as the contract is deployed. |
| Voting token address | `DataKey::VotingToken` | `instance` | Same lifetime requirement as Admin. |
| Proposal counter | `DataKey::ProposalCount` | `instance` | Monotonic counter needed for every proposal creation call. |

### Token contract (`votechain-token`)

| Entry | Key | Storage tier | Rationale |
|---|---|---|---|
| Token balance | `TokenDataKey::Balance(owner)` | `persistent` | Balances are permanent financial records; they must never expire. |
| Allowance | `TokenDataKey::Allowance(owner, spender)` | `temporary` | Allowances are inherently short-lived approvals. Automatic expiry is a desirable safety property — stale approvals cannot be exploited after their TTL elapses. |
| Total supply | `TokenDataKey::TotalSupply` | `instance` | Global invariant; same lifetime as the contract. |
| Admin address | `TokenDataKey::Admin` | `instance` | Global configuration; same lifetime as the contract. |

## TTL expectations

Soroban TTLs are measured in ledgers. A new entry's TTL equals `min_persistent_entry_ttl - 1` (persistent/instance) or `min_temp_entry_ttl - 1` (temporary) on the ledger where it is created.

Entries whose TTL reaches zero are handled differently per tier:

- **Temporary** — permanently deleted. The governance and token contracts rely on this for allowance expiry.
- **Persistent** — archived. An archived persistent entry can be restored via a footprint extension transaction; in the test environment the SDK automatically restores it on next access.
- **Instance** — archived alongside the contract instance. Deployers are responsible for periodically extending the contract instance TTL.

Applications deploying VoteChain should monitor instance and persistent entry TTLs and extend them before expiry using `extend_ttl` calls or a dedicated keeper service.

## Consequences

- Allowances expire automatically without any explicit revocation mechanism.
- Proposal and vote data may require TTL extensions for long-running governance processes (proposals with very long durations or prolonged post-finalisation periods).
- Tests set explicit `min_persistent_entry_ttl` and `min_temp_entry_ttl` values so TTL assertions are deterministic and independent of network defaults.

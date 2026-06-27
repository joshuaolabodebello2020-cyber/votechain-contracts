# ADR-006: Instance vs Persistent Storage

**Status:** Accepted  
**Date:** 2026-04-28  
**Ticket:** SC-025

## Context

Soroban exposes three storage tiers with different cost and lifetime characteristics:

| Tier | TTL | Cost | Best for |
|------|-----|------|----------|
| **Instance** | Tied to the contract instance | Cheapest reads (whole bucket loaded once) | Contract-wide config read on every call |
| **Persistent** | Per-key, renewed independently | Moderate | Per-user / per-proposal data that must survive long-term |
| **Temporary** | Expires without renewal | Cheapest writes | Short-lived data (e.g. allowances) |

Choosing the wrong tier wastes fees: putting per-user data in instance storage bloats the instance bucket (every call pays to load it), while putting frequently-read config in persistent storage pays a per-key lookup fee on every invocation.

## Decision

### Governance contract (`contracts/governance/src/storage.rs`)

**Instance storage** — contract-wide configuration, read on almost every call:

| Key | Type | Rationale |
|-----|------|-----------|
| `Admin` | `Address` | Set once at init; read on every admin operation |
| `VotingToken` | `Address` | Read on every `cast_vote` and `create_proposal` |
| `ProposalCount` | `u64` | Incremented on every `create_proposal` |
| `MinProposalBalance` | `i128` | Read on every `create_proposal` |
| `ProposalCooldown` | `u64` | Read on every `create_proposal` |
| `Version` | `(u32, u32, u32)` | Set once at init |

**Persistent storage** — per-proposal / per-voter data with unbounded cardinality:

| Key | Type | Rationale |
|-----|------|-----------|
| `Proposal(id)` | `Proposal` | Full proposal state; must survive the entire proposal lifecycle |
| `HasVoted(proposal_id, voter)` | `bool` | Deduplication flag; one entry per voter per proposal |
| `VoteRecord(proposal_id, voter)` | `VoteRecord` | Immutable audit trail; one entry per voter per proposal |
| `VoterSnapshot(proposal_id, voter)` | `i128` | Balance snapshot at vote time (see ADR-003) |
| `LastProposal(proposer)` | `u64` | Cooldown timestamp; one entry per proposer address |

### Token contract (`contracts/token/src/storage.rs`)

**Instance storage** — contract-wide singletons:

| Key | Type | Rationale |
|-----|------|-----------|
| `Admin` | `Address` | Set once at init; read on mint/burn |
| `TotalSupply` | `i128` | Updated on every mint/burn; contract-wide aggregate |
| `Version` | `(u32, u32, u32)` | Set once at init |

**Persistent storage** — per-address data:

| Key | Type | Rationale |
|-----|------|-----------|
| `Balance(owner)` | `i128` | Token balance per address; must survive indefinitely |

**Temporary storage** — short-lived approvals:

| Key | Type | Rationale |
|-----|------|-----------|
| `Allowance(owner, spender)` | `i128` | ERC-20-style approval; acceptable to expire with the ledger entry TTL |

## Consequences

- Config reads (`Admin`, `VotingToken`, etc.) pay only the instance bucket load cost, not a per-key lookup.
- Proposal and vote data are stored persistently and survive ledger expiry independently of the contract instance.
- Allowances in the token contract expire naturally, reducing long-term storage bloat without requiring explicit revocation.
- The instance bucket size stays bounded: only a fixed set of scalar config keys live there, regardless of how many proposals or voters exist.

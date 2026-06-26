# Requirements Document

## Introduction

### SC-006: Storage TTL Bump for Long-Lived Proposals

#### Overview

Soroban persistent storage entries have a finite TTL (Time To Live) measured in ledgers. Without explicit TTL management, proposal entries and their associated vote records can expire before a long-running governance proposal concludes, causing data loss that would permanently break finalisation and audit queries.

This feature adds automatic TTL bumping to all persistent storage accessors in the governance contract, with a configurable bump amount stored in instance storage.

## Background

On Stellar/Soroban:
- Persistent storage entries are assigned a default TTL at creation time (~120 days / ~6,312,000 ledgers at 5s/ledger, but this is network-configurable and can be shorter).
- Once expired, the entry is gone — reads return `None` and the contract cannot recover the data.
- `extend_ttl(key, threshold, extend_to)` keeps an entry alive: it bumps the TTL to `extend_to` only when the current TTL has fallen below `threshold`, avoiding redundant writes.
- A proposal with a 30-day voting window plus a timelock plus a pending execution window can easily span millions of ledgers, pushing against default TTL limits.

## Requirements

### REQ-1: Configurable TTL bump amount

**As** a governance contract deployer  
**I want** to configure the TTL bump threshold and extension amount at initialisation  
**So that** the contract's storage longevity matches the expected maximum proposal lifetime for the deployed network

**Acceptance criteria:**
- A new `storage_bump_amount` parameter (ledger count, `u32`) is accepted by `initialize`.
- A new `storage_bump_threshold` parameter (ledger count, `u32`) is accepted by `initialize`; when a persistent entry's remaining TTL falls below this value the TTL is extended.
- Both values are stored in instance storage under new `DataKey` variants (`StorageBumpAmount`, `StorageBumpThreshold`).
- Both values default to a safe constant (`LEDGERS_TO_LIVE = 535_000`, roughly 31 days at 5 s/ledger) if not explicitly set or set to zero.
- A new `get_storage_ttl_config` read-only entry point exposes both values.

### REQ-2: TTL bump on every write to persistent storage

**As** a governance contract  
**I want** the TTL of a persistent entry to be extended every time it is written  
**So that** a newly created or updated entry always has a fresh TTL

**Acceptance criteria:**
- `save_proposal` calls `extend_ttl` on `DataKey::Proposal(id)` after the `set`.
- `mark_voted` calls `extend_ttl` on `DataKey::HasVoted(proposal_id, voter)` after the `set`.
- `save_vote_record` calls `extend_ttl` on `DataKey::VoteRecord(proposal_id, voter)` after the `set`.
- `save_voter_snapshot` calls `extend_ttl` on `DataKey::VoterSnapshot(proposal_id, voter)` after the `set`.
- `set_last_proposal` calls `extend_ttl` on `DataKey::LastProposal(proposer)` after the `set`.
- Multi-sig persistent writers (`save_multisig_action`, `set_multisig_approval`) call `extend_ttl` after each `set`.
- The bump uses the contract-configured `storage_bump_amount` / `storage_bump_threshold` values.

### REQ-3: TTL bump on every read from persistent storage (state-modifying calls only)

**As** a governance contract  
**I want** the TTL of a persistent entry to be refreshed when it is read as part of a state-changing operation  
**So that** long-lived proposals whose entries have aged between writes do not expire unexpectedly

**Acceptance criteria:**
- `load_proposal` bumps the TTL of `DataKey::Proposal(id)` after a successful `get`.
- `has_voted` does **not** bump TTL (pure read-only query, called by `get_vote` public endpoint and tests).
- `get_vote_record` does **not** bump TTL (pure read-only query, called by `get_vote` public endpoint).
- `get_voter_snapshot` does **not** bump TTL (read-only helper inside `cast_vote`; the subsequent `save_voter_snapshot` write bump covers it).
- `get_last_proposal` does **not** bump TTL (read-only cooldown check; no state change follows if the cooldown check fails).
- `load_multisig_action` bumps TTL after a successful `get`.
- `has_multisig_approval` does **not** bump TTL (read-only query).

> **Rationale for read-bump vs. no-read-bump distinction:**  
> The acceptance criteria for SC-006 states "No unnecessary TTL bumps on read-only calls." A call is "read-only" from the bump perspective when it is only ever reached via a public read-only entry point (`get_vote`, `get_proposal`, etc.) or an internal check that returns early on failure without modifying state. `load_proposal` is excluded from this because it feeds every state-mutating function (`cast_vote`, `finalise`, `execute`, `cancel`, `amend_proposal`) and an un-bumped proposal could expire between a vote and a finalise call.

### REQ-4: Tests verify TTL survival across expected ledger counts

**As** a developer  
**I want** automated tests that advance the ledger sequence counter and confirm entries are still readable  
**So that** regressions are caught if bump logic is accidentally removed

**Acceptance criteria:**
- A test creates a proposal, advances the ledger by `storage_bump_amount - 1` ledgers, then successfully reads the proposal back (no panic).
- A test creates a proposal, casts a vote, advances the ledger by `storage_bump_amount - 1` ledgers, then successfully reads `has_voted` and `get_vote` back (no panic).
- A test verifies that `get_storage_ttl_config` returns the values passed to `initialize`.
- A test verifies that setting `storage_bump_amount = 0` at init falls back to the default constant.
- Tests use `env.ledger().with_mut(|l| l.sequence += N)` to advance ledger sequence (Soroban TTL is ledger-sequence based, not timestamp based).

### REQ-5: No regression on existing public interface

**As** a developer  
**I want** the TTL bump to be fully internal to the storage module  
**So that** no existing call-site in `lib.rs` or existing tests require modification

**Acceptance criteria:**
- All bump calls live inside `storage.rs`; `lib.rs` imports no new TTL-related symbols.
- The only breaking change is the two new `initialize` parameters; existing test helpers are updated to pass defaults.
- All pre-existing tests continue to pass without modification beyond adding the two new `initialize` arguments.

## Out of Scope

- Instance storage TTL management (instance storage shares the contract's own TTL, which is managed separately by the host environment and deployer).
- Temporary storage (not used in this contract).
- Retroactive TTL repair for entries that have already expired.
- A `bump_proposal` admin-callable entry point (can be a follow-up if operators need manual override).

## Glossary

| Term | Definition |
|------|-----------|
| **TTL** | Time To Live — the number of ledgers remaining before a Soroban storage entry expires and is deleted by the network. |
| **extend_ttl** | Soroban host function that raises an entry's TTL to a target ledger count, but only if the current TTL is below a given threshold. Has no effect (zero cost) when the entry is already long-lived enough. |
| **Persistent storage** | The Soroban storage tier where entries survive ledger expiry independently. Used for proposal data, vote records, voter snapshots, and cooldown timestamps. |
| **Instance storage** | The Soroban storage tier whose TTL is tied to the contract instance itself. Used for configuration singletons (admin, token address, thresholds, etc.). Not affected by this feature. |
| **Ledger sequence** | A monotonically increasing counter incremented with every closed Soroban ledger (~5 seconds on mainnet). Soroban TTL is measured in ledger sequence units, not wall-clock time. |
| **StorageBumpAmount** | The target TTL (in ledgers) an entry is extended to when a bump occurs. |
| **StorageBumpThreshold** | The TTL floor (in ledgers) below which a bump is triggered. If an entry's remaining TTL is already above this value, `extend_ttl` is a no-op. |
| **LEDGERS_TO_LIVE** | The default value for both bump parameters when not explicitly configured — currently `535_000` (~31 days at 5 s/ledger). |

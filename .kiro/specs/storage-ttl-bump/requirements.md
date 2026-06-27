# Requirements Document

## Introduction

This feature adds automatic TTL (time-to-live) bump behaviour to all persistent storage entries
in the governance contract. Soroban persistent storage entries expire after a ledger-defined
period unless their TTL is explicitly extended. Without TTL bumping, long-running proposals
(those with voting windows spanning many ledgers) risk having their `Proposal`, `HasVoted`,
`VoteRecord`, `VoterSnapshot`, and `LastProposal` entries expire before the proposal concludes.

The solution introduces a configurable `TtlBumpLedgers` value stored in instance storage.
Write operations (any function that mutates a persistent entry) bump the TTL of the affected
key(s) unconditionally. Read-only query functions (e.g. `get_vote`) do **not** bump TTL, to
avoid charging unnecessary fees on view calls. The bump amount is set during `initialize` with
a sensible default and is updatable by the admin via a dedicated setter.

## Glossary

- **Contract**: The VoteChain governance Soroban smart contract (`GovernanceContract`).
- **Persistent_Storage**: Soroban's persistent storage tier, where entries survive ledger
  boundaries but expire if not explicitly TTL-bumped.
- **TTL**: Time-to-live — the number of ledgers remaining before a persistent storage entry
  is eligible for archival.
- **TTL_Bump**: The act of calling `env.storage().persistent().extend_ttl(&key, threshold, extend_to)`
  to extend a persistent entry's TTL to at least `extend_to` ledgers from the current ledger,
  provided the current TTL is below `threshold`.
- **Bump_Amount**: The `extend_to` value (in ledgers) passed to `extend_ttl`. Stored in instance
  storage under `DataKey::TtlBumpLedgers`.
- **Threshold**: The `threshold` value passed to `extend_ttl`. Entries whose current TTL is at
  or above `threshold` are not bumped, avoiding unnecessary host-function calls. For this
  feature, `threshold` is always set equal to `Bump_Amount`.
- **Write_Operation**: Any contract entrypoint that creates or mutates a persistent storage
  entry: `create_proposal`, `cast_vote`, `finalise`, `execute`, `cancel`, `amend_proposal`.
- **Read_Only_Query**: A contract entrypoint that only reads persistent storage without
  mutating it: `get_vote`.
- **Admin**: The privileged address stored under `DataKey::Admin`; the sole caller permitted
  to update `TtlBumpLedgers`.
- **DataKey**: The Rust enum that namespaces all storage keys in the contract.

---

## Requirements

### Requirement 1: TTL Bump Configuration

**User Story:** As an admin, I want to configure the number of ledgers by which persistent
storage TTLs are extended, so that I can tune storage costs versus expiry risk without
redeploying the contract.

#### Acceptance Criteria

1. THE Contract SHALL store the TTL bump amount in instance storage under a new `DataKey::TtlBumpLedgers` variant.
2. WHEN `initialize` is called, THE Contract SHALL write `TtlBumpLedgers` to instance storage using a default value of 535,000 ledgers (approximately 30 days at 5-second ledger close time).
3. WHEN `initialize` is called with a `ttl_bump_ledgers` argument greater than zero, THE Contract SHALL store that value as `TtlBumpLedgers` instead of the default.
4. WHEN `set_ttl_bump_ledgers` is called by the admin with a valid value, THE Contract SHALL update the `TtlBumpLedgers` entry in instance storage so that the stored value equals exactly the supplied argument.
5. IF `set_ttl_bump_ledgers` is called by a caller whose address does not match the stored `Admin`, THEN THE Contract SHALL return `ContractError::NotAdmin`.
6. IF `set_ttl_bump_ledgers` is called with a value of zero, THEN THE Contract SHALL return `ContractError::InvalidTtlBumpLedgers`.
7. THE Contract SHALL expose a `get_ttl_bump_ledgers` read-only entrypoint that returns the currently configured `TtlBumpLedgers` value.

---

### Requirement 2: TTL Bump on Proposal Write Operations

**User Story:** As a governance participant, I want proposal storage entries to have their
TTL extended whenever a write operation touches them, so that long-running proposals are
not archived before they conclude.

#### Acceptance Criteria

1. WHEN `create_proposal` successfully writes a new `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
2. WHEN `create_proposal` successfully writes a `DataKey::LastProposal(proposer)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
3. WHEN `cast_vote` successfully writes a `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
4. WHEN `cast_vote` successfully writes a `DataKey::HasVoted(proposal_id, voter)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
5. WHEN `cast_vote` successfully writes a `DataKey::VoteRecord(proposal_id, voter)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
6. WHEN `cast_vote` successfully writes a `DataKey::VoterSnapshot(proposal_id, voter)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
7. WHEN `finalise` successfully writes the updated `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
8. WHEN `execute` successfully writes the updated `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
9. WHEN `cancel` successfully writes the updated `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
10. WHEN `amend_proposal` successfully writes the updated `DataKey::Proposal(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.

---

### Requirement 3: TTL Bump on Vote Record Write Operations (Multi-sig)

**User Story:** As a multi-sig admin, I want multi-sig action storage entries to have their
TTL bumped on every write, so that pending approvals for long-running admin operations
are not archived mid-flow.

#### Acceptance Criteria

1. WHEN `save_multisig_action` writes a `DataKey::MultiSigAction(id)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.
2. WHEN `set_multisig_approval` writes a `DataKey::MultiSigApproval(action_id, approver)` entry, THE Contract SHALL call `extend_ttl` on that key with `threshold = Bump_Amount` and `extend_to = Bump_Amount`.

---

### Requirement 4: No TTL Bump on Read-Only Queries

**User Story:** As a contract integrator, I want read-only query calls to incur no TTL bump
charges, so that view functions remain cost-efficient and do not produce unnecessary
state changes.

#### Acceptance Criteria

1. WHEN `get_vote` is called, THE Contract SHALL NOT call `extend_ttl` on any storage key.
2. WHEN `get_config` is called, THE Contract SHALL NOT call `extend_ttl` on any storage key.
3. WHEN `get_proposal` is called, THE Contract SHALL NOT call `extend_ttl` on any storage key.
4. WHEN `get_ttl_bump_ledgers` is called, THE Contract SHALL NOT call `extend_ttl` on any storage key.

---

### Requirement 5: TTL Bump Placement After Write (Correct Ordering)

**User Story:** As a smart contract developer, I want TTL bumps to occur after the write
they protect, so that a bump is never applied to an entry that was not actually persisted.

#### Acceptance Criteria

1. WHEN a write operation sets a persistent storage entry and then calls `extend_ttl`, THE Contract SHALL call `extend_ttl` on the same key only after the corresponding `set` or `save` call completes without error.
2. IF a write operation returns an error before reaching the `set` or `save` call, THEN THE Contract SHALL NOT call `extend_ttl` for that entry in that invocation.

---

### Requirement 6: Entry Survival Across Expected Ledger Count

**User Story:** As a governance participant, I want to verify that persistent entries survive
the configured TTL window, so that I have confidence that proposals and vote records will
not expire during a normal voting period.

#### Acceptance Criteria

1. WHEN a proposal is created and the ledger sequence advances by a number of ledgers less than `Bump_Amount`, THE Contract SHALL successfully load the `DataKey::Proposal(id)` entry without error.
2. WHEN a vote is cast and the ledger sequence advances by a number of ledgers less than `Bump_Amount`, THE Contract SHALL successfully load the `DataKey::VoteRecord(proposal_id, voter)` entry without error.
3. WHEN a `HasVoted` flag is written and the ledger sequence advances by a number of ledgers less than `Bump_Amount`, THE Contract SHALL return `true` for that voter without error.
4. WHEN a `VoterSnapshot` is written and the ledger sequence advances by a number of ledgers less than `Bump_Amount`, THE Contract SHALL return the correct snapshot weight without error.

# Storage Data Dictionary

This document catalogs all on-chain storage keys and core data structures used by the VoteChain contracts.

## Governance Contract (`contracts/governance`)

### Storage Key Enum: `DataKey`

| Key | Payload Type | Storage Tier | Purpose |
|---|---|---|---|
| `Proposal(u64)` | `Proposal` | Persistent | Stores proposal record by proposal ID. |
| `ProposalCount` | `u64` | Instance | Monotonic counter for next proposal ID. |
| `HasVoted(u64, Address)` | `bool` | Persistent | Fast flag for duplicate-vote checks per proposal + voter. |
| `VoteRecord(u64, Address)` | `VoteRecord` | Persistent | Stores full vote choice + vote weight for auditability. |
| `VoterSnapshot(u64, Address)` | `i128` | Persistent | Stores token-balance snapshot at vote time per voter/proposal. |
| `LastProposal(Address)` | `u64` | Persistent | Stores last proposal timestamp per proposer for cooldown checks. |
| `Admin` | `Address` | Instance | Governance admin account. |
| `VotingToken` | `Address` | Instance | Token contract used for vote weight and proposal threshold checks. |
| `MinProposalBalance` | `i128` | Instance | Minimum token balance required to create a proposal. |
| `ProposalCooldown` | `u64` | Instance | Cooldown in seconds between proposals per proposer. |
| `Version` | `(u32, u32, u32)` | Instance | Contract semantic version tuple `(major, minor, patch)`. |
| `ContractState` | `ContractState` | Instance | Governance contract lifecycle state. |

### Structs

#### `Proposal`

| Field | Type | Description / Constraints |
|---|---|---|
| `id` | `u64` | Unique proposal identifier. |
| `proposer` | `Address` | Address that created the proposal. |
| `title` | `String` | Human-readable proposal title. Length validated in contract. |
| `description` | `String` | Proposal details. Length validated in contract. |
| `votes_yes` | `i128` | Running weighted tally for `Yes` votes. |
| `votes_no` | `i128` | Running weighted tally for `No` votes. |
| `votes_abstain` | `i128` | Running weighted tally for `Abstain` votes. |
| `quorum` | `i128` | Minimum total vote weight required to finalise with quorum. |
| `start_time` | `u64` | Voting start timestamp (ledger time). |
| `end_time` | `u64` | Voting end timestamp (ledger time). |
| `state` | `ProposalState` | Current proposal lifecycle state. |

#### `VoteRecord`

| Field | Type | Description / Constraints |
|---|---|---|
| `vote_type` | `Vote` | Voter's selected option (`Yes`, `No`, `Abstain`). |
| `weight` | `i128` | Snapshotted vote weight used for this vote. |

### Enums

#### `ContractState`
- `Uninitialized`: contract deployed but not initialized.
- `Ready`: contract initialized and operational.

#### `ProposalState`
- `Active`: proposal is currently open for voting.
- `Passed`: voting ended and proposal met pass conditions.
- `Rejected`: voting ended and proposal failed.
- `Executed`: passed proposal has been executed.
- `Cancelled`: proposal was cancelled.

#### `Vote`
- `Yes`: affirmative vote.
- `No`: negative vote.
- `Abstain`: abstention.

#### `ContractError` (Governance)
- `AdminNotSet`
- `NotAdmin`
- `VotingTokenNotSet`
- `InvalidQuorum`
- `InvalidDuration`
- `ProposalNotFound`
- `ProposalNotActive`
- `VotingPeriodEnded`
- `VotingStillOpen`
- `AlreadyVoted`
- `NoVotingPower`
- `ProposalNotPassed`
- `AlreadyInitialized`
- `VoteTallyOverflow`
- `InsufficientBalance`
- `ProposalCooldown`
- `TitleTooLong`
- `DescriptionTooLong`
- `InvalidTitle`
- `InvalidDescription`
- `InvalidDurationRange`
- `QuorumExceedsSupply`

## Token Contract (`contracts/token`)

### Storage Key Enum: `TokenDataKey`

| Key | Payload Type | Storage Tier | Purpose |
|---|---|---|---|
| `Balance(Address)` | `i128` | Persistent | Token balance per holder address. |
| `Allowance(Address, Address)` | `i128` | Temporary | Spending allowance from owner to spender. |
| `TotalSupply` | `i128` | Instance | Aggregate circulating token supply. |
| `Admin` | `Address` | Instance | Token admin address (mint/burn/admin operations). |
| `Version` | `(u32, u32, u32)` | Instance | Contract semantic version tuple `(major, minor, patch)`. |

### Enums

#### `ContractError` (Token)
- `AdminNotSet`
- `NotAdmin`
- `InvalidAmount`
- `InsufficientBalance`
- `AllowanceExceeded`
- `InvalidNewAdmin`

## Notes on Storage Isolation

- Governance and token contracts each namespace storage with contract-specific key enums (`DataKey`, `TokenDataKey`).
- Soroban serializes enum discriminants as part of the key, so variants cannot collide even when payload shapes match.
- Instance keys are singleton config/state values.
- Persistent keys hold long-lived per-entity state.
- Temporary keys are used for short-lived allowances.

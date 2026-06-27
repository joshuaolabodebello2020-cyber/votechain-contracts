# VoteChain ABI Reference

Complete ABI reference for the VoteChain governance and token contracts. Covers all public functions, parameter types, return values, error codes, emitted events, and example calls.

For event payload schemas see [events.md](events.md).

---

## Table of Contents

- [Data Types](#data-types)
- [Error Codes](#error-codes)
- [Governance Contract ABI](#governance-contract-abi)
- [Token Contract ABI](#token-contract-abi)
- [ABI Changelog](#abi-changelog)

---

## Data Types

### Shared primitives

| Rust type  | XDR type        | Notes                              |
|------------|-----------------|------------------------------------|
| `Address`  | `ScAddress`     | Stellar account or contract address |
| `String`   | `ScString`      | UTF-8, length-prefixed              |
| `u64`      | `Uint64`        | Unsigned 64-bit integer             |
| `i128`     | `Int128Parts`   | Signed 128-bit integer (token amounts) |
| `bool`     | `Bool`          | Boolean flag                        |
| `()`       | `Void`          | No return value / empty payload     |

### `Vote` enum

```rust
pub enum Vote {
    Yes,
    No,
    Abstain,
}
```

### `ProposalState` enum

```rust
pub enum ProposalState {
    Active,
    Passed,
    Rejected,
    Executed,
    Cancelled,
}
```

### `Proposal` struct

```rust
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub votes_yes: i128,
    pub votes_no: i128,
    pub votes_abstain: i128,
    pub quorum: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub state: ProposalState,
}
```

### `VoteRecord` struct

```rust
pub struct VoteRecord {
    pub vote: Vote,
    pub weight: i128,  // balance snapshot at vote time
}
```

---

## Error Codes

### Governance contract errors

| Error                  | Code | Trigger                                                              |
|------------------------|------|----------------------------------------------------------------------|
| `AlreadyInitialized`   | 1    | `initialize` called on an already-initialized contract               |
| `NotAdmin`             | 2    | Caller is not the admin                                              |
| `ContractPaused`       | 3    | State-changing call while contract is paused                         |
| `NotPaused`            | 4    | `unpause` called when not paused                                     |
| `InvalidTitle`         | 5    | Title is empty or longer than 128 characters                         |
| `InvalidDescription`   | 6    | Description is empty or longer than 1024 characters                  |
| `InvalidQuorum`        | 7    | Quorum is zero or negative                                           |
| `QuorumExceedsSupply`  | 8    | Quorum is greater than the total token supply                        |
| `InvalidDurationRange` | 9    | Duration outside `[60, 2_592_000]` seconds                           |
| `InsufficientBalance`  | 10   | Proposer balance below `min_proposal_balance`                        |
| `ProposalCooldown`     | 11   | Proposer is within the cooldown period                               |
| `ProposalNotFound`     | 12   | No proposal exists for the given ID                                  |
| `ProposalNotActive`    | 13   | Operation requires `Active` state                                    |
| `ProposalNotPassed`    | 14   | `execute` called on a non-Passed proposal                            |
| `VotingNotStarted`     | 15   | `cast_vote` called before voting period starts                       |
| `VotingPeriodEnded`    | 16   | `cast_vote` called after voting period ended                         |
| `VotingStillOpen`      | 17   | `finalise` called before voting period ends                          |
| `AlreadyVoted`         | 18   | Voter has already cast a vote on this proposal                       |
| `NoVotingPower`        | 19   | Voter has zero token balance                                         |
| `AdminVoteRestricted`  | 20   | Admin tried to vote on their own proposal with restriction enabled   |
| `InvalidNewAdmin`      | 21   | New admin address is invalid                                         |

### Token contract errors

| Error                | Code | Trigger                                              |
|----------------------|------|------------------------------------------------------|
| `AlreadyInitialized` | 1    | `initialize` called on an already-initialized contract |
| `NotAdmin`           | 2    | Caller is not the admin                              |
| `InvalidAmount`      | 3    | Amount is zero or negative                           |
| `InsufficientBalance`| 4    | Sender/source has fewer tokens than requested        |
| `AllowanceExceeded`  | 5    | Spender allowance is less than requested amount      |
| `InvalidNewAdmin`    | 6    | New admin address is invalid                         |

---

## Governance Contract ABI

### `initialize`

One-time setup. Must be called before any other function.

```
fn initialize(
    env: Env,
    admin: Address,
    voting_token: Address,
    min_proposal_balance: i128,
    proposal_cooldown: u64,
    restrict_admin_vote: bool,
) -> Result<(), ContractError>
```

| Parameter              | Type      | Description                                                       |
|------------------------|-----------|-------------------------------------------------------------------|
| `admin`                | `Address` | Privileged address (execute, cancel, pause)                       |
| `voting_token`         | `Address` | SEP-41 governance token contract address                          |
| `min_proposal_balance` | `i128`    | Minimum token balance to create proposals (`0` = no minimum)      |
| `proposal_cooldown`    | `u64`     | Seconds between proposals per address (`0` = no cooldown)         |
| `restrict_admin_vote`  | `bool`    | If `true`, admin cannot vote on proposals they created            |

**Returns:** `()` on success  
**Errors:** `AlreadyInitialized`  
**Events emitted:** `init`

**Example call (Rust):**
```rust
GovernanceContract::initialize(
    env,
    admin,
    token_address,
    1_000_000,  // min 1M tokens to propose
    86_400,     // 1-day cooldown
    true,
)?;
```

**Example call (JS):**
```js
await governance.methods
  .initialize(admin, tokenAddress, 1_000_000n, 86_400n, true)
  .simulate(server);
```

---

### `create_proposal`

Creates a new governance proposal. Proposer must meet the minimum balance and cooldown constraints.

```
fn create_proposal(
    env: Env,
    proposer: Address,
    title: String,
    description: String,
    quorum: i128,
    duration: u64,
) -> Result<u64, ContractError>
```

| Parameter     | Type      | Description                                                  |
|---------------|-----------|--------------------------------------------------------------|
| `proposer`    | `Address` | Address creating the proposal (requires auth)                |
| `title`       | `String`  | 1–128 characters                                             |
| `description` | `String`  | 1–1024 characters                                            |
| `quorum`      | `i128`    | Minimum total votes required; must be `> 0` and `<= supply` |
| `duration`    | `u64`     | Voting period in seconds; range `[60, 2_592_000]`           |

**Returns:** Proposal ID (`u64`)  
**Errors:** `InvalidTitle`, `InvalidDescription`, `InvalidQuorum`, `QuorumExceedsSupply`, `InvalidDurationRange`, `InsufficientBalance`, `ProposalCooldown`, `ContractPaused`  
**Events emitted:** `created`

**Example call (Rust):**
```rust
let id = GovernanceContract::create_proposal(
    env,
    proposer,
    String::from_slice(&env, "Increase Treasury"),
    String::from_slice(&env, "Allocate 10M tokens to treasury"),
    5_000_000,
    604_800,  // 7 days
)?;
```

**Example call (JS):**
```js
const id = await governance.methods
  .create_proposal(proposer, "Increase Treasury", "Allocate 10M tokens", 5_000_000n, 604_800n)
  .simulate(server);
```

---

### `get_proposal`

Returns the full state of a proposal.

```
fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, ContractError>
```

**Returns:** [`Proposal`](#proposal-struct)  
**Errors:** `ProposalNotFound`

---

### `proposal_count`

Returns the total number of proposals ever created.

```
fn proposal_count(env: Env) -> u64
```

**Returns:** `u64`

---

### `cast_vote`

Casts a vote on an active proposal. Vote weight equals the voter's current token balance, captured and stored immutably at vote time.

```
fn cast_vote(
    env: Env,
    voter: Address,
    proposal_id: u64,
    vote: Vote,
) -> Result<(), ContractError>
```

| Parameter     | Type      | Description                               |
|---------------|-----------|-------------------------------------------|
| `voter`       | `Address` | Address casting the vote (requires auth)  |
| `proposal_id` | `u64`     | Target proposal                           |
| `vote`        | `Vote`    | `Yes`, `No`, or `Abstain`                 |

**Returns:** `()`  
**Errors:** `ProposalNotFound`, `ProposalNotActive`, `VotingNotStarted`, `VotingPeriodEnded`, `AlreadyVoted`, `NoVotingPower`, `AdminVoteRestricted`, `ContractPaused`  
**Events emitted:** `vote`

**Example call (Rust):**
```rust
GovernanceContract::cast_vote(env, voter, proposal_id, Vote::Yes)?;
```

**Example call (JS):**
```js
await governance.methods
  .cast_vote(voter, proposalId, { tag: 'Yes' })
  .simulate(server);
```

---

### `has_voted`

Returns `true` if the given address has already voted on the proposal.

```
fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool
```

**Returns:** `bool`

---

### `get_vote`

Returns the vote type and weight snapshot for a voter on a proposal.

```
fn get_vote(
    env: Env,
    proposal_id: u64,
    voter: Address,
) -> Result<VoteRecord, ContractError>
```

**Returns:** [`VoteRecord`](#voterecord-struct)  
**Errors:** `ProposalNotFound`

---

### `finalise`

Evaluates a proposal after its voting period ends. Transitions it to `Passed` or `Rejected`. Can be called by anyone.

```
fn finalise(env: Env, proposal_id: u64) -> Result<(), ContractError>
```

**Pass condition:**
```
total_votes = votes_yes + votes_no + votes_abstain
Passed   if total_votes >= quorum AND votes_yes > votes_no
Rejected otherwise (tie counts as rejection)
```

**Returns:** `()`  
**Errors:** `ProposalNotFound`, `ProposalNotActive`, `VotingStillOpen`  
**Events emitted:** `final`

**Example call (Rust):**
```rust
GovernanceContract::finalise(env, proposal_id)?;
```

---

### `execute`

Marks a `Passed` proposal as `Executed`. Admin only.

```
fn execute(env: Env, admin: Address, proposal_id: u64) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `ProposalNotFound`, `ProposalNotPassed`, `NotAdmin`  
**Events emitted:** `executed`

**Example call (Rust):**
```rust
GovernanceContract::execute(env, admin, proposal_id)?;
```

---

### `cancel`

Cancels an `Active` proposal. Admin only.

```
fn cancel(env: Env, admin: Address, proposal_id: u64) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `ProposalNotFound`, `ProposalNotActive`, `NotAdmin`  
**Events emitted:** `cancelled`

---

### `update_quorum`

Adjusts the quorum threshold on an active proposal. Admin only. Can be called multiple times before finalization.

```
fn update_quorum(
    env: Env,
    admin: Address,
    proposal_id: u64,
    new_quorum: i128,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `ProposalNotFound`, `ProposalNotActive`, `InvalidQuorum`, `QuorumExceedsSupply`, `NotAdmin`  
**Events emitted:** `qupdate`

---

### `transfer_admin` (governance)

Transfers admin privileges to a new address. Admin only.

```
fn transfer_admin(
    env: Env,
    admin: Address,
    new_admin: Address,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `InvalidNewAdmin`  
**Events emitted:** `admxfer`

---

### `pause`

Pauses all state-changing operations. Read-only functions remain available. Admin only.

```
fn pause(env: Env, admin: Address) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `ContractPaused`  
**Events emitted:** `paused`

---

### `unpause`

Resumes normal operation. Admin only.

```
fn unpause(env: Env, admin: Address) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `NotPaused`  
**Events emitted:** `unpaused`

---

## Token Contract ABI

### `initialize`

One-time setup. Mints the entire initial supply to `admin`.

```
fn initialize(
    env: Env,
    admin: Address,
    initial_supply: i128,
) -> Result<(), ContractError>
```

| Parameter        | Type      | Description                                      |
|------------------|-----------|--------------------------------------------------|
| `admin`          | `Address` | Receives initial supply and admin privileges     |
| `initial_supply` | `i128`    | Total tokens minted to admin at initialization   |

**Returns:** `()`  
**Errors:** `AlreadyInitialized`  
**Events emitted:** `mint` (for initial supply)

**Example call (Rust):**
```rust
TokenContract::initialize(env, admin, 1_000_000_000)?;
```

---

### `total_supply`

Returns the aggregate token supply.

```
fn total_supply(env: Env) -> i128
```

**Returns:** `i128`

---

### `balance` / `balance_of`

Returns the token balance of an address. Returns `0` if the address has never held tokens.

```
fn balance(env: Env, owner: Address) -> i128
fn balance_of(env: Env, owner: Address) -> i128
```

**Returns:** `i128`

---

### `transfer`

Transfers tokens from `from` to `to`. Requires auth from `from`. Transfer to self is a no-op (auth still required).

```
fn transfer(
    env: Env,
    from: Address,
    to: Address,
    amount: i128,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `InvalidAmount`, `InsufficientBalance`  
**Events emitted:** `transfer` (not emitted for self-transfers)

**Example call (Rust):**
```rust
TokenContract::transfer(env, from, to, 1_000_000)?;
```

---

### `transfer_from`

Transfers tokens on behalf of `from` using a pre-approved allowance.

```
fn transfer_from(
    env: Env,
    spender: Address,
    from: Address,
    to: Address,
    amount: i128,
) -> Result<(), ContractError>
```

| Parameter | Type      | Description                                        |
|-----------|-----------|----------------------------------------------------|
| `spender` | `Address` | Address with spending allowance (requires auth)    |
| `from`    | `Address` | Token owner                                        |
| `to`      | `Address` | Recipient                                          |
| `amount`  | `i128`    | Tokens to transfer                                 |

**Returns:** `()`  
**Errors:** `InvalidAmount`, `InsufficientBalance`, `AllowanceExceeded`  
**Events emitted:** `transfer`

---

### `approve`

Grants `spender` the right to transfer up to `amount` tokens from `owner`. Allowances are stored in temporary storage and expire with ledger entry TTL.

```
fn approve(
    env: Env,
    owner: Address,
    spender: Address,
    amount: i128,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `InvalidAmount` (if negative)

**Example call (Rust):**
```rust
TokenContract::approve(env, owner, spender, 1_000_000)?;
```

---

### `allowance`

Returns the current spending allowance for a `(owner, spender)` pair.

```
fn allowance(env: Env, owner: Address, spender: Address) -> i128
```

**Returns:** `i128`

---

### `mint`

Mints new tokens to `to`. Increases total supply. Admin only.

```
fn mint(
    env: Env,
    admin: Address,
    to: Address,
    amount: i128,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `InvalidAmount`  
**Events emitted:** `mint`

**Example call (Rust):**
```rust
TokenContract::mint(env, admin, recipient, 500_000)?;
```

---

### `burn`

Burns tokens from `from`. Decreases total supply. Admin only.

```
fn burn(
    env: Env,
    admin: Address,
    from: Address,
    amount: i128,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `InvalidAmount`, `InsufficientBalance`  
**Events emitted:** `burn`

---

### `transfer_admin` (token)

Transfers admin privileges to a new address. Admin only.

```
fn transfer_admin(
    env: Env,
    admin: Address,
    new_admin: Address,
) -> Result<(), ContractError>
```

**Returns:** `()`  
**Errors:** `NotAdmin`, `InvalidNewAdmin`  
**Events emitted:** `admxfer`

---

## ABI Changelog

### v1.0.0 (current)

Initial public ABI. All functions listed in this document are part of the v1.0.0 ABI.

**Governance contract — public functions:**
`initialize`, `create_proposal`, `get_proposal`, `proposal_count`, `cast_vote`, `has_voted`, `get_vote`, `finalise`, `execute`, `cancel`, `update_quorum`, `transfer_admin`, `pause`, `unpause`

**Token contract — public functions:**
`initialize`, `total_supply`, `balance`, `balance_of`, `transfer`, `transfer_from`, `approve`, `allowance`, `mint`, `burn`, `transfer_admin`

**Events introduced in v1.0.0:**

*Governance:* `init`, `created`, `vote`, `final`, `executed`, `cancelled`, `qupdate`, `admxfer`, `paused`, `unpaused`, `durationupdate`

*Token:* `mint`, `transfer`, `burn`, `admxfer`

---

*For event payload schemas and indexer integration notes, see [events.md](events.md).*

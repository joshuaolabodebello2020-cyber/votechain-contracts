# Governance Glossary

A reference of governance terms used throughout the VoteChain project. Intended for contributors, integrators, and DAO participants.

---

## Core Concepts

### Proposal

A formal on-chain request for a governance action. Each proposal has a title, description, quorum threshold, and voting duration. Any address can create a proposal.

**Example:** "Increase the validator reward rate from 5% to 7%" is a proposal that token holders vote on during the active period.

### Vote

A single token-holder's expression of support or opposition to a proposal. Votes are **token-weighted** — voting power equals the voter's token balance at the time of casting.

**Example:** An address holding 1,000 governance tokens casts a "Yes" vote, contributing 1,000 votes toward the proposal's tally.

### Quorum

The minimum number of total votes (Yes + No) required for a proposal's result to be considered valid. If quorum is not met by the end of the voting period, the proposal is **Rejected** regardless of the vote ratio.

**Example:** A proposal with a quorum of 10,000 receives 8,000 total votes. Even though 7,500 voted Yes, the proposal is Rejected because quorum was not met.

### Token-Weighted Voting

A voting model where each vote's influence is proportional to the voter's governance token balance. This ties voting power to economic stake in the protocol.

### Delegation

The act of assigning one's voting power to another address (a **delegate**). The delegate votes on behalf of the delegator using the delegator's token weight. Delegation can be revoked at any time.

**Example:** Alice delegates her 5,000 tokens to Bob. When Bob votes, his vote carries his own tokens plus Alice's 5,000 delegated tokens.

---

## Proposal Lifecycle States

### Active

The proposal is open for voting. Voters can cast votes and the admin can adjust quorum. This is the only mutable state. See [Proposal Lifecycle](lifecycle.md) for the full state diagram.

### Passed

The voting period ended, quorum was met, and `votes_yes > votes_no`. The proposal is awaiting execution by an admin.

### Rejected

The voting period ended but either quorum was not met or `votes_yes <= votes_no`. This is a terminal state — no further action can be taken.

### Executed

An admin has marked a Passed proposal as executed, completing its lifecycle. Terminal state.

### Cancelled

An admin cancelled the proposal before the voting period ended. Terminal state.

---

## Lifecycle Operations

### Finalization (`finalise()`)

The process of transitioning a proposal from Active to either Passed or Rejected after the voting period ends. Finalization evaluates two conditions: (1) was quorum met? (2) did Yes votes exceed No votes?

### Execution (`execute()`)

An admin-only action that marks a Passed proposal as Executed. This represents the off-chain or on-chain fulfillment of the proposal's intent.

### Cancellation (`cancel()`)

An admin-only action that moves an Active proposal to the Cancelled state before the voting period ends.

**Example:** A proposal is discovered to contain a flawed parameter. The admin cancels it so a corrected version can be resubmitted.

---

## Configuration & Parameters

### Voting Duration

The time window (in ledger seconds) during which votes can be cast. Set at proposal creation as `end_time = ledger_timestamp + duration`. Subject to minimum and maximum limits — see [Duration Limits](../VOTING_DURATION_LIMITS_README.md).

### End Time

The ledger timestamp after which no more votes can be cast. Determined at proposal creation and immutable thereafter.

### Admin

The privileged address authorized to perform restricted operations: `execute()`, `cancel()`, and `update_quorum()`. Set at contract initialization.

---

## Token Concepts

### Governance Token

The SEP-41-compatible token contract that determines voting power. Token balances directly translate to vote weight.

### Mint / Burn

Admin operations to create or destroy governance tokens. Minting increases total supply; burning decreases it. Both affect the denominator for quorum calculations.

### Allowance

A SEP-41 mechanism that permits a third-party address to transfer tokens on the owner's behalf, up to a specified limit. Used by the SDK and frontend for transaction batching.

---

## Infrastructure Terms

### Soroban

Stellar's smart contract platform. All VoteChain contracts compile to WASM and execute on Soroban.

### Indexer

An off-chain service that listens to Soroban contract events and writes them to a queryable store. Provides fast read access for the frontend and API without hitting the chain directly.

### RPC (Remote Procedure Call)

The Stellar RPC endpoint used by the frontend, backend, and SDK to submit transactions and query contract state.

### WASM (WebAssembly)

The compilation target for Soroban contracts. Rust source code in `contracts/` compiles to `.wasm` binaries that are deployed on-chain.

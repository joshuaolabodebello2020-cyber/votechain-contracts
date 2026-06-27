# DAO Integration Guide

This guide walks a DAO team through deploying VoteChain, configuring the governance token, running proposals, and handling common issues. It assumes familiarity with the Stellar CLI and basic Soroban concepts.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Deployment](#2-deployment)
3. [Token Setup and Distribution](#3-token-setup-and-distribution)
4. [Initializing the Governance Contract](#4-initializing-the-governance-contract)
5. [Proposal Creation and Voting Workflow](#5-proposal-creation-and-voting-workflow)
6. [Finalizing and Executing Proposals](#6-finalizing-and-executing-proposals)
7. [Admin Operations](#7-admin-operations)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust | 1.75+ | `rustup update` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21.6.0 | `cargo install --locked stellar-cli@21.6.0 --features opt` |
| Funded Stellar account | — | Admin keypair with XLM for fees |

Get testnet XLM: `https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>`

---

## 2. Deployment

### 2.1 Clone and build

```bash
git clone https://github.com/Vera3289/votechain-contracts.git
cd votechain-contracts
make build
```

WASM binaries are written to `target/wasm32-unknown-unknown/release/`.

### 2.2 Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
NETWORK=testnet                          # local | testnet | mainnet
STELLAR_SECRET_KEY=S...                  # admin deployer secret key
STELLAR_PUBLIC_KEY=G...                  # corresponding public key
```

### 2.3 Deploy both contracts

```bash
NETWORK=testnet ./scripts/deploy.sh
```

The script builds, deploys the token contract, deploys the governance contract, and writes the resulting contract IDs to `.env.testnet`:

```
TOKEN_CONTRACT_ID=C...
GOVERNANCE_CONTRACT_ID=C...
```

For mainnet, use `NETWORK=mainnet ./scripts/deploy_mainnet.sh`. Review that script carefully before running — mainnet deployments are irreversible.

### 2.4 Verify deployment

```bash
source .env.testnet

stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- total_supply
```

A `0` response confirms the token contract is live and uninitialized.

---

## 3. Token Setup and Distribution

### 3.1 Initialize the token contract

```bash
stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- initialize \
  --admin "$STELLAR_PUBLIC_KEY" \
  --initial_supply 1000000000
```

This mints 1,000,000,000 tokens to the admin address and sets the admin.

> **Supply planning:** Choose a supply that accommodates your quorum targets. If you plan a quorum of 5,000,000 tokens, your total supply must be at least that large.

### 3.2 Distribute tokens to DAO members

Transfer tokens to each member's address:

```bash
stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- transfer \
  --from "$STELLAR_PUBLIC_KEY" \
  --to "G<MEMBER_ADDRESS>" \
  --amount 10000000
```

Repeat for each member. Verify balances:

```bash
stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- balance \
  --owner "G<MEMBER_ADDRESS>"
```

### 3.3 Mint additional tokens (admin only)

```bash
stellar contract invoke \
  --id "$TOKEN_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- mint \
  --admin "$STELLAR_PUBLIC_KEY" \
  --to "G<RECIPIENT>" \
  --amount 5000000
```

---

## 4. Initializing the Governance Contract

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- initialize \
  --admin "$STELLAR_PUBLIC_KEY" \
  --voting_token "$TOKEN_CONTRACT_ID" \
  --min_proposal_balance 1000000 \
  --proposal_cooldown 86400 \
  --min_duration 3600 \
  --max_duration 2592000 \
  --restrict_admin_vote true \
  --timelock_duration 0
```

**Parameter guidance:**

| Parameter | Recommended starting value | Notes |
|---|---|---|
| `min_proposal_balance` | 1,000,000 | Prevents spam; adjust to ~0.1% of supply |
| `proposal_cooldown` | 86400 (1 day) | Seconds between proposals per address |
| `min_duration` | 3600 (1 hour) | Minimum voting window |
| `max_duration` | 2592000 (30 days) | Maximum voting window |
| `restrict_admin_vote` | `true` | Prevents admin from voting on own proposals |
| `timelock_duration` | 0 or 172800 (2 days) | Delay between Passed and executable; `0` disables |

> **Important:** `initialize` can only be called once. Double-check all parameters before submitting — they cannot be changed after initialization (except `quorum` on individual proposals via `update_quorum`).

---

## 5. Proposal Creation and Voting Workflow

### 5.1 Create a proposal

Any address holding at least `min_proposal_balance` tokens can create a proposal:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --source "$PROPOSER_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- create_proposal \
  --proposer "$PROPOSER_PUBLIC_KEY" \
  --title "Increase Treasury Allocation" \
  --description "Allocate 10M tokens to the community treasury for Q3 grants." \
  --quorum 5000000 \
  --duration 604800
```

The return value is the proposal ID (e.g., `1`). Save it for subsequent calls.

**Constraints:**
- `title`: 1–128 characters, printable UTF-8 only
- `description`: 1–1024 characters, printable UTF-8 only
- `quorum`: must be > 0 and ≤ total token supply
- `duration`: must be within `[min_duration, max_duration]`

### 5.2 Inspect the proposal

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- get_proposal \
  --proposal_id 1
```

### 5.3 Cast votes

Each token holder votes once. Vote weight equals their token balance at vote time.

```bash
# Vote Yes
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --source "$VOTER_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- cast_vote \
  --voter "$VOTER_PUBLIC_KEY" \
  --proposal_id 1 \
  --vote '{"tag":"Yes"}'

# Vote No
  --vote '{"tag":"No"}'

# Abstain (counts toward quorum, not outcome)
  --vote '{"tag":"Abstain"}'
```

Check whether an address has voted:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- has_voted \
  --proposal_id 1 \
  --voter "$VOTER_PUBLIC_KEY"
```

---

## 6. Finalizing and Executing Proposals

### 6.1 Finalize after voting ends

Anyone can call `finalise` once the voting window closes:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --source "$ANY_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- finalise \
  --proposal_id 1
```

**Pass conditions:**
```
total_votes = votes_yes + votes_no + votes_abstain

Passed   if total_votes >= quorum  AND  votes_yes > votes_no
Rejected otherwise
```

A tie (`votes_yes == votes_no`) resolves as Rejected.

### 6.2 Execute a passed proposal

Only the admin can execute. If a timelock is configured, wait until `execute_after` before calling:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- execute \
  --admin "$STELLAR_PUBLIC_KEY" \
  --proposal_id 1
```

### 6.3 Proposal lifecycle summary

```
create_proposal → Active
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Passed      Rejected   Cancelled  ← cancel() (admin, Active only)
          │
          ▼
       Executed   ← execute() (admin, after timelock)
```

---

## 7. Admin Operations

### Pause / unpause

```bash
# Pause (blocks all state-changing calls)
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$STELLAR_SECRET_KEY" \
  ... -- pause --admin "$STELLAR_PUBLIC_KEY"

# Unpause
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$STELLAR_SECRET_KEY" \
  ... -- unpause --admin "$STELLAR_PUBLIC_KEY"
```

### Cancel an active proposal

```bash
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$STELLAR_SECRET_KEY" \
  ... -- cancel --admin "$STELLAR_PUBLIC_KEY" --proposal_id 1
```

### Update quorum on an active proposal

```bash
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$STELLAR_SECRET_KEY" \
  ... -- update_quorum --admin "$STELLAR_PUBLIC_KEY" --proposal_id 1 --new_quorum 3000000
```

### Transfer admin (two-step)

```bash
# Step 1: propose the transfer (48-hour acceptance window by default)
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$STELLAR_SECRET_KEY" \
  ... -- propose_admin_transfer \
  --admin "$STELLAR_PUBLIC_KEY" \
  --new_admin "G<NEW_ADMIN>" \
  --window_secs 172800

# Step 2: new admin accepts
stellar contract invoke --id "$GOVERNANCE_CONTRACT_ID" --source "$NEW_ADMIN_SECRET_KEY" \
  ... -- accept_admin_transfer --new_admin "G<NEW_ADMIN>"
```

---

## 8. Troubleshooting

### Error codes quick reference

| Code | Name | Fix |
|---|---|---|
| 1 | `AdminNotSet` | Call `initialize` first |
| 2 | `NotAdmin` | Use the admin keypair |
| 4 | `InvalidQuorum` | Quorum must be > 0 |
| 5 | `InvalidDuration` | Duration must be > 0 |
| 6 | `ProposalNotFound` | Check proposal ID with `proposal_count()` |
| 7 | `ProposalNotActive` | Proposal already settled; check state with `get_proposal` |
| 8 | `VotingPeriodEnded` | Window closed; call `finalise` |
| 9 | `VotingStillOpen` | Wait until `end_time` passes before calling `finalise` |
| 10 | `AlreadyVoted` | Address already voted; check with `has_voted` |
| 11 | `NoVotingPower` | Voter holds zero tokens |
| 12 | `ProposalNotPassed` | Proposal did not pass; cannot execute |

Full error reference: [`docs/errors.md`](errors.md)

### Common issues

**`AlreadyInitialized` on governance init**
The contract was already initialized. Redeploy a fresh contract if you need different parameters.

**`QuorumExceedsSupply` on proposal creation**
Your quorum value is larger than the total token supply. Either lower the quorum or mint more tokens first.

**`InsufficientBalance` on proposal creation**
The proposer holds fewer tokens than `min_proposal_balance`. Transfer tokens to the proposer or lower the minimum.

**`ProposalCooldown` on proposal creation**
The proposer created a proposal too recently. Wait `proposal_cooldown` seconds and retry.

**`TimelockNotExpired` on execute**
The timelock delay has not elapsed since finalization. Check `execute_after` in the proposal state and wait.

**`VotingStillOpen` on finalise**
The voting window is still open. Compare the current ledger timestamp against the proposal's `end_time`.

**Deployment fails with "insufficient balance"**
Fund the deployer account with XLM: `https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>`

**`stellar: command not found`**
Ensure `~/.cargo/bin` is on your `PATH` and Stellar CLI 21.6.0 is installed:
```bash
cargo install --locked stellar-cli@21.6.0 --features opt
```

---

## Related Documentation

- [Proposal Lifecycle](lifecycle.md) — state diagram and transition rules
- [Error Reference](errors.md) — complete error code table
- [Storage Model](storage.md) — storage tier strategy
- [Security Threat Model](security/threat-model.md) — known risks and mitigations
- [FAQ](faq.md) — frequently asked questions
- [Rust Examples](examples/rust.md) — code-level integration examples
- [JavaScript Examples](examples/javascript.md) — frontend integration examples

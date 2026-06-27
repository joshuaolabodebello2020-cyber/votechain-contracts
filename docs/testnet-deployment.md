# Testnet Deployment and Interaction Guide

This guide walks you through deploying the VoteChain governance and token contracts to the Stellar testnet and interacting with them using the Soroban CLI.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |

Verify:

```bash
rustc --version
stellar --version
```

---

## Step 1: Fund a Testnet Account

You need a Stellar testnet keypair with XLM to pay transaction fees.

```bash
# Generate a new keypair
stellar keys generate --global deployer --network testnet

# Fund it via Friendbot (testnet only)
stellar keys fund deployer --network testnet
```

Check the balance:

```bash
stellar keys address deployer
# Copy the public key, then:
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```

---

## Step 2: Build the Contracts

From the repository root:

```bash
make build
```

This produces two WASM binaries:

```
target/wasm32-unknown-unknown/release/votechain_token.wasm
target/wasm32-unknown-unknown/release/votechain_governance.wasm
```

---

## Step 3: Deploy the Token Contract

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_token.wasm \
  --source deployer \
  --network testnet
```

Save the output contract ID:

```bash
export TOKEN_ID=<CONTRACT_ID_FROM_OUTPUT>
```

### Initialize the Token Contract

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --initial_supply 1000000000
```

Verify the total supply:

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --network testnet \
  -- total_supply
```

---

## Step 4: Deploy the Governance Contract

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_governance.wasm \
  --source deployer \
  --network testnet
```

Save the output contract ID:

```bash
export GOVERNANCE_ID=<CONTRACT_ID_FROM_OUTPUT>
```

### Initialize the Governance Contract

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --voting_token "$TOKEN_ID" \
  --min_proposal_balance 0 \
  --proposal_cooldown 0 \
  --restrict_admin_vote false \
  --timelock_duration 0
```

Verify the contract state:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --network testnet \
  -- get_state
```

Expected output: `"Ready"`

---

## Step 5: Save Contract IDs

The deploy script writes contract IDs automatically:

```bash
NETWORK=testnet ./scripts/deploy.sh
```

This creates `.env.testnet`:

```
NETWORK=testnet
TOKEN_CONTRACT_ID=C...
GOVERNANCE_CONTRACT_ID=C...
```

Load them in your shell:

```bash
source .env.testnet
```

---

## Step 6: Interact with the Contracts

### Mint Tokens to a Voter

```bash
stellar contract invoke \
  --id "$TOKEN_ID" \
  --source deployer \
  --network testnet \
  -- mint \
  --admin $(stellar keys address deployer) \
  --to <VOTER_ADDRESS> \
  --amount 500000
```

### Create a Proposal

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- create_proposal \
  --proposer $(stellar keys address deployer) \
  --title "Increase Treasury Allocation" \
  --description "Allocate 10M tokens to the community treasury for Q3 grants." \
  --quorum 100000 \
  --duration 3600
```

Save the returned proposal ID:

```bash
export PROPOSAL_ID=1
```

### Check Proposal State

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --network testnet \
  -- get_proposal \
  --proposal_id "$PROPOSAL_ID"
```

### Cast a Vote

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- cast_vote \
  --voter $(stellar keys address deployer) \
  --proposal_id "$PROPOSAL_ID" \
  --vote '{"tag":"Yes","values":[]}'
```

Vote options: `'{"tag":"Yes","values":[]}'`, `'{"tag":"No","values":[]}'`, `'{"tag":"Abstain","values":[]}'`

### Check if an Address Has Voted

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --network testnet \
  -- has_voted \
  --proposal_id "$PROPOSAL_ID" \
  --voter $(stellar keys address deployer)
```

### Finalise a Proposal (after voting period ends)

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- finalise \
  --proposal_id "$PROPOSAL_ID"
```

### Execute a Passed Proposal

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- execute \
  --admin $(stellar keys address deployer) \
  --proposal_id "$PROPOSAL_ID"
```

### Cancel an Active Proposal (admin only)

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  -- cancel \
  --admin $(stellar keys address deployer) \
  --proposal_id "$PROPOSAL_ID"
```

---

## Step 7: Verify on Stellar Expert

Browse your deployed contracts on the testnet explorer:

```
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>
```

All events (votes, proposals, finalisations) are visible in the contract's event log.

---

## Troubleshooting

### `insufficient balance` on deploy

Your account needs XLM. Re-run Friendbot:

```bash
curl "https://friendbot.stellar.org?addr=$(stellar keys address deployer)"
```

### `AlreadyInitialized` error

The contract was already initialised. Each contract can only be initialised once. Deploy a fresh contract if you need a clean state.

### `VotingStillOpen` on finalise

The voting period has not ended yet. Wait until `end_time` has passed (check `get_proposal` for the `end_time` field).

### `NoVotingPower` on cast_vote

The voter has zero token balance. Mint tokens to the voter first using the token contract's `mint` function.

### Simulation vs submission

Add `--send=no` to any `stellar contract invoke` command to simulate without submitting:

```bash
stellar contract invoke \
  --id "$GOVERNANCE_ID" \
  --source deployer \
  --network testnet \
  --send=no \
  -- get_proposal \
  --proposal_id 1
```

---

## Network Configuration Reference

| Parameter | Testnet Value |
|-----------|--------------|
| RPC URL | `https://soroban-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |
| Friendbot | `https://friendbot.stellar.org` |

These values are also stored in `config/testnet.toml`.

---

## Full End-to-End Example Script

```bash
#!/usr/bin/env bash
set -euo pipefail

NETWORK=testnet
DEPLOYER=$(stellar keys address deployer)

# Build
make build

# Deploy token
TOKEN_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_token.wasm \
  --source deployer --network $NETWORK)

# Deploy governance
GOVERNANCE_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_governance.wasm \
  --source deployer --network $NETWORK)

# Initialize token (1 billion supply)
stellar contract invoke --id "$TOKEN_ID" --source deployer --network $NETWORK \
  -- initialize --admin "$DEPLOYER" --initial_supply 1000000000

# Initialize governance
stellar contract invoke --id "$GOVERNANCE_ID" --source deployer --network $NETWORK \
  -- initialize \
  --admin "$DEPLOYER" \
  --voting_token "$TOKEN_ID" \
  --min_proposal_balance 0 \
  --proposal_cooldown 0 \
  --restrict_admin_vote false \
  --timelock_duration 0

# Mint tokens to deployer for voting
stellar contract invoke --id "$TOKEN_ID" --source deployer --network $NETWORK \
  -- mint --admin "$DEPLOYER" --to "$DEPLOYER" --amount 1000000

# Create a proposal (1 hour duration)
PROPOSAL_ID=$(stellar contract invoke --id "$GOVERNANCE_ID" --source deployer --network $NETWORK \
  -- create_proposal \
  --proposer "$DEPLOYER" \
  --title "Test Proposal" \
  --description "A test proposal on testnet." \
  --quorum 500000 \
  --duration 3600)

echo "Deployed TOKEN_ID=$TOKEN_ID"
echo "Deployed GOVERNANCE_ID=$GOVERNANCE_ID"
echo "Created PROPOSAL_ID=$PROPOSAL_ID"
```

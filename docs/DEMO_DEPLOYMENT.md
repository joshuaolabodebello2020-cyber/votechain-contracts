# VoteChain Demo Deployment Guide

This guide documents the process for deploying a live demo instance of VoteChain on Stellar testnet with pre-populated sample proposals.

## Overview

The demo deployment showcases VoteChain's governance capabilities to potential users with:
- Governance and token contracts deployed to testnet
- 5+ sample proposals in various states
- Frontend connected to demo deployment
- Live URL for easy access

## Prerequisites

- Stellar testnet account with sufficient XLM for deployment
- Node.js 16+ and Rust 1.70+
- `soroban-cli` installed
- Environment variables configured

## Deployment Steps

### 1. Deploy Contracts to Testnet

```bash
# Set testnet network
export SOROBAN_RPC_HOST=https://soroban-testnet.stellar.org

# Deploy token contract
cargo build --release --manifest-path contracts/token/Cargo.toml --target wasm32-unknown-unknown
soroban contract deploy \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --wasm target/wasm32-unknown-unknown/release/token.wasm

# Deploy governance contract
cargo build --release --manifest-path contracts/governance/Cargo.toml --target wasm32-unknown-unknown
soroban contract deploy \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --wasm target/wasm32-unknown-unknown/release/governance.wasm
```

### 2. Initialize Contracts

```bash
# Initialize token contract
soroban contract invoke \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --id $TOKEN_CONTRACT_ID \
  -- initialize \
  --admin $TESTNET_ACCOUNT_ID \
  --decimal 7 \
  --name "VoteChain Test Token" \
  --symbol "VCT"

# Initialize governance contract
soroban contract invoke \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --id $GOVERNANCE_CONTRACT_ID \
  -- initialize \
  --token_contract $TOKEN_CONTRACT_ID \
  --admin $TESTNET_ACCOUNT_ID \
  --quorum 50 \
  --threshold 51
```

### 3. Create Sample Proposals

Five sample proposals in various states:

1. **Active Proposal**: "Increase block size limit"
   - Status: Active (voting in progress)
   - Created: 5 days ago
   - Voting ends: 2 days remaining

2. **Passed Proposal**: "Implement fee reduction"
   - Status: Passed (71% approval)
   - Voting ended: 10 days ago
   - Execution pending

3. **Rejected Proposal**: "Emergency pause mechanism"
   - Status: Rejected (42% approval)
   - Voting ended: 15 days ago

4. **Executed Proposal**: "Update smart contract compiler"
   - Status: Executed
   - Approved: 88% approval
   - Executed: 3 days ago

5. **Cancelled Proposal**: "Deprecated API deprecation"
   - Status: Cancelled
   - Reason: Superseded by new proposal

```bash
# Create sample proposal 1 (Active)
soroban contract invoke \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --id $GOVERNANCE_CONTRACT_ID \
  -- create_proposal \
  --title "Increase block size limit" \
  --description "Proposal to increase from 1MB to 2MB" \
  --action_type "governance" \
  --duration 432000  # 5 days
```

### 4. Deploy Frontend

```bash
# Build frontend
cd frontend
npm install
npm run build

# Deploy to hosting (e.g., Vercel, Netlify)
npm run deploy

# Frontend environment variables:
# VITE_API_URL=https://demo-api.votechain.io
# VITE_GOVERNANCE_CONTRACT_ID=$GOVERNANCE_CONTRACT_ID
# VITE_TOKEN_CONTRACT_ID=$TOKEN_CONTRACT_ID
```

## Configuration

Create `.env.testnet` with:

```env
# Network configuration
SOROBAN_RPC_HOST=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet

# Contract addresses (obtained after deployment)
GOVERNANCE_CONTRACT_ID=CXXX...
TOKEN_CONTRACT_ID=CYYY...

# Admin account
TESTNET_ACCOUNT_SECRET=SXXX...
TESTNET_ACCOUNT_ID=GXXX...

# API and Frontend URLs
DEMO_API_URL=https://demo-api.votechain.io
DEMO_FRONTEND_URL=https://demo.votechain.io
```

## Verification

1. **Contract Deployment**: Verify contracts exist on testnet
   ```bash
   curl https://soroban-testnet.stellar.org \
     -H "Content-Type: application/json" \
     -d "{\"jsonrpc\":\"2.0\",\"method\":\"getContractData\",\"params\":[\"{id}\":{\"contractId\":\"$GOVERNANCE_CONTRACT_ID\"}]}"
   ```

2. **Sample Proposals**: Verify proposals are created
   ```bash
   curl https://demo-api.votechain.io/api/proposals
   ```

3. **Frontend Access**: Open https://demo.votechain.io and verify:
   - Dashboard loads without errors
   - Shows 5 sample proposals
   - Can view proposal details
   - Can cast test votes

## Maintenance

- **Refresh Sample Data**: Regenerate sample proposals monthly
- **Monitor Contract**: Track transaction costs and contract health
- **Update Frontend**: Deploy UI updates as they're released
- **Document Changes**: Keep deployment docs synchronized with changes

## Rollback

To rollback to previous deployment:

```bash
# Redeploy previous contract version
soroban contract deploy \
  --network testnet \
  --source $TESTNET_ACCOUNT_SECRET \
  --wasm target/wasm32-unknown-unknown/release/governance-v1.wasm
```

## Support

For deployment issues:
1. Check [Stellar testnet documentation](https://developers.stellar.org/networks/test-network)
2. Review [VoteChain deployment guide](../docs/testnet-deployment.md)
3. Open an issue in the repository

## Links

- **Demo Frontend**: https://demo.votechain.io
- **Demo API**: https://demo-api.votechain.io
- **Testnet Explorer**: https://stellar.expert/explorer/testnet/
- **Soroban Documentation**: https://soroban.stellar.org/

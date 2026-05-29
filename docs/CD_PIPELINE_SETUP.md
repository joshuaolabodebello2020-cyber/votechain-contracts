# CD Pipeline Setup Guide - Testnet Deployment

This guide explains how to set up and configure the automatic Continuous Deployment (CD) pipeline for deploying VoteChain contracts to Stellar testnet.

## Overview

The CD pipeline automatically:
1. Triggers when code is pushed to the `main` branch (only if contract files changed)
2. Builds the WASM contracts
3. Deploys them to Stellar testnet
4. Verifies the deployment
5. Reports deployment status

## Prerequisites

1. **GitHub Secrets** - Configure required deployment credentials (see below)
2. **Stellar Account** - A funded testnet account for deployments
3. **GitHub Actions** - Enabled on the repository

## Setting Up Secrets

To enable the deployment pipeline, you must configure GitHub Actions secrets with Stellar credentials:

### 1. Create a Stellar Testnet Account

If you don't have a testnet account:

```bash
# Using Stellar CLI
stellar keys generate --network testnet my-deployment-account

# Or use Friendbot to fund the account
curl "https://friendbot.stellar.org/?addr=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:

**Repository Settings** → **Secrets and variables** → **Actions**

#### Required Secrets:

**Name:** `SOROBAN_ACCOUNT`
- **Value:** Your Stellar public key (starting with G)
- **Example:** `GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Description:** The account that will deploy and own the contracts

**Name:** `SOROBAN_SECRET_KEY`
- **Value:** Your Stellar secret key (starting with S)
- **Example:** `SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- **Description:** Private key for signing deployment transactions
- **Security Note:** This is sensitive - never commit to the repo!

### 3. Generate Deployment Keys (Recommended)

For production deployments, create a dedicated account for deployments:

```bash
# 1. Generate new keypair
stellar keys generate --network testnet deployment-account

# 2. Transfer some XLM to the new account for gas
# (Use your main account or Friendbot)

# 3. Use the new keypair for GitHub secrets
```

## Configuring the Pipeline

### Trigger Conditions

The deployment pipeline triggers when:
- Code is pushed to the `main` branch
- AND one of these files is modified:
  - `contracts/**` (any contract file)
  - `Cargo.toml` or `Cargo.lock` (dependencies)
  - `.github/workflows/deploy-testnet.yml` (workflow itself)
  - `scripts/deploy.sh` (deployment script)

### Environment Configuration

The pipeline uses the testnet configuration in `config/testnet.toml`:

```toml
# config/testnet.toml
rpc_url = "https://soroban-testnet.stellar.org"
network_passphrase = "Test SDF Network ; September 2015"
```

## How the Pipeline Works

### Stage 1: Build

```
✓ Checkout code
✓ Install Rust toolchain + WASM target
✓ Build contracts to WASM
✓ Verify binary sizes
✓ Upload artifacts for 30 days
```

### Stage 2: Deploy

```
✓ Build contracts
✓ Configure Stellar CLI
✓ Deploy token contract
✓ Deploy governance contract
✓ Report deployment status
```

### Stage 3: Verify

```
✓ Query deployed contracts on testnet
✓ Verify contract state
✓ Log verification results
```

### Stage 4: Notify

```
✓ Create deployment summary
✓ Report final status
```

## Monitoring Deployments

### View Deployment Logs

1. Go to **Actions** tab in your GitHub repository
2. Click **"Deploy to Testnet"** workflow
3. Select the latest run
4. View logs and artifacts

### Check Contract Status on Testnet

After successful deployment, view your contracts:

```bash
# Using stellar-expert
https://testnet.stellar.expert/search?q=<YOUR_ACCOUNT_ADDRESS>

# Or using Stellar CLI
export SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
export SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

stellar contract info --id <CONTRACT_ID>
```

### View Artifacts

GitHub stores deployment artifacts (logs, reports) for 30 days:

1. Go to **Actions** → **Deploy to Testnet** workflow run
2. Scroll to **Artifacts** section
3. Download:
   - `wasm-contracts-*` - Built WASM binaries
   - `deployment-logs-*` - Deployment logs and reports

## Troubleshooting

### Deployment Fails: "SOROBAN_ACCOUNT secret not configured"

**Solution:**
1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Add `SOROBAN_ACCOUNT` secret
3. Verify the value is a valid Stellar public key (starts with G)

### Deployment Fails: "Insufficient balance"

**Solution:**
1. Your deployment account needs XLM for transaction fees
2. Fund the account via Friendbot: https://friendbot.stellar.org
3. Add more XLM if making multiple deployments

```bash
# Check account balance
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_ACCOUNT>"
```

### Deployment Fails: "Network unreachable"

**Solution:**
- Check testnet RPC status: https://status.stellar.org
- Verify network connectivity
- Try again after a few minutes

### Workflow Doesn't Trigger

**Possible causes:**
1. Secrets not configured - check **Settings** → **Secrets**
2. No relevant files changed - workflow only triggers on changes to:
   - `contracts/**`
   - `Cargo.toml` / `Cargo.lock`
   - `.github/workflows/deploy-testnet.yml`
   - `scripts/deploy.sh`
3. Branch is not `main` - workflow only runs on main branch

### Cannot Find Deployed Contracts

**Solution:**
1. Wait a few seconds for blockchain confirmation
2. Use the deployment account address to search
3. Check deployment logs for actual contract IDs
4. Visit Stellar Expert: https://testnet.stellar.expert

## Manual Deployment

To deploy manually without CI/CD:

```bash
# 1. Set credentials
export SOROBAN_SECRET_KEY="S..."
export SOROBAN_ACCOUNT="G..."

# 2. Deploy to testnet
NETWORK=testnet ./scripts/deploy.sh
```

## Security Best Practices

1. **Use Deployment-Specific Keys**
   - Create a separate account just for deployments
   - Rotate keys regularly

2. **Limit Secret Access**
   - Restrict secret access to necessary workflows only
   - Use GitHub environments to control deployment approval

3. **Audit Deployments**
   - Review deployment logs after each push to main
   - Monitor contract interactions on testnet

4. **Never Hardcode Secrets**
   - Always use GitHub Secrets
   - Never commit private keys to the repository
   - Add secrets to `.gitignore`

## Mainnet Deployment

To add mainnet deployments:

1. Create `config/mainnet.toml` with mainnet RPC URL
2. Create `.github/workflows/deploy-mainnet.yml` (similar to testnet)
3. Add approval requirement:
   ```yaml
   environment:
     name: mainnet
     url: https://stellar.expert
     ```
4. Add secrets: `SOROBAN_MAINNET_ACCOUNT`, `SOROBAN_MAINNET_SECRET_KEY`
5. Require manual approval via GitHub environments

## Next Steps

1. ✅ Configure GitHub secrets
2. ✅ Fund testnet deployment account
3. ✅ Push changes to main branch to trigger deployment
4. ✅ Monitor deployment logs
5. ✅ Verify contracts on testnet explorer
6. 🔮 Set up mainnet deployment (production)
7. 🔮 Add integration test stage after deployment

## References

- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Stellar CLI Documentation](https://developers.stellar.org/tools/stellar-cli)
- [Soroban Documentation](https://developers.stellar.org/learn/getting-started/write-smart-contracts)
- [Stellar Testnet](https://developers.stellar.org/learn/networks)
- [Friendbot Faucet](https://friendbot.stellar.org)

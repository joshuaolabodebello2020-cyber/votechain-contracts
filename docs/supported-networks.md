# Supported Stellar Networks and CLI Versions

This document lists the exact Stellar CLI version required to build and deploy VoteChain, the supported network endpoints, and compatibility notes for local development versus production environments.

---

## Required Stellar CLI Version

VoteChain pins a specific Stellar CLI version to ensure reproducible builds and deterministic WASM output.

| Tool | Required version |
|------|----------------|
| **Stellar CLI** | **21.6.0** |
| Rust | 1.75+ (stable) |
| WASM target | `wasm32-unknown-unknown` |

The required version is defined in two places and must stay in sync:

- `Makefile` — `STELLAR_CLI_VERSION := 21.6.0`
- `.github/workflows/ci.yml` — `STELLAR_CLI_VERSION: "21.6.0"`

### Installing the pinned version

```bash
cargo install --locked stellar-cli@21.6.0 --features opt
```

### Verifying the installed version

```bash
stellar --version
# Expected output: stellar 21.6.0
```

Or use the Makefile target:

```bash
make check-stellar-cli
# Output: stellar-cli 21.6.0 OK
```

If the wrong version is installed, `make check-stellar-cli` exits with a non-zero status and prints the install command.

---

## Upgrading the Stellar CLI

When the project moves to a new pinned version, these three files must be updated together in a single commit:

1. `Makefile` — update `STELLAR_CLI_VERSION`
2. `.github/workflows/ci.yml` — update the `STELLAR_CLI_VERSION` env var
3. `docs/supported-networks.md` (this file) — update the version table above

Then verify locally:

```bash
cargo install --locked stellar-cli@<NEW_VERSION> --features opt
make check-stellar-cli
make build
make test
```

Do not change the CLI version in only one of the files — a mismatch between the Makefile and CI will cause build inconsistencies.

---

## Supported Network Endpoints

VoteChain supports three network environments. Select the environment by setting the `NETWORK` environment variable before running deploy scripts.

### Local development

| Property | Value |
|----------|-------|
| `NETWORK` value | `local` |
| RPC URL | `http://localhost:8000/soroban/rpc` |
| Network passphrase | `Standalone Network ; February 2017` |
| Config file | `config/local.toml` |

The local node is provided by the `stellar-node` Docker service in `docker-compose.yml`. It runs a standalone Stellar network accessible only from your machine.

Start the local environment:

```bash
docker compose up
```

Deploy to local:

```bash
./scripts/deploy.sh
# or explicitly:
NETWORK=local ./scripts/deploy.sh
```

**Compatibility notes:**
- The local network has no persistent history between restarts.
- Friendbot is available at `http://localhost:8000/friendbot` for funding accounts.
- Network passphrase differs from Testnet and Mainnet — ensure your code or SDK is configured correctly when switching environments.

---

### Testnet

| Property | Value |
|----------|-------|
| `NETWORK` value | `testnet` |
| RPC URL | `https://soroban-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Config file | `config/testnet.toml` |
| Horizon URL | `https://horizon-testnet.stellar.org` |
| Friendbot | `https://friendbot.stellar.org?addr=<PUBLIC_KEY>` |
| Explorer | `https://stellar.expert/explorer/testnet` |

Deploy to Testnet:

```bash
NETWORK=testnet ./scripts/deploy.sh
```

Fund a new account on Testnet:

```bash
stellar keys generate --global deployer --network testnet
stellar keys fund deployer --network testnet
```

**Compatibility notes:**
- Testnet is reset periodically by the Stellar Development Foundation. Deployed contract addresses become invalid after a reset.
- Use Testnet for integration testing and demos. Do not store real value here.
- The network passphrase is identical across all Testnet resets.

---

### Mainnet

| Property | Value |
|----------|-------|
| `NETWORK` value | `mainnet` |
| RPC URL | `https://mainnet.stellar.validationcloud.io/v1/<YOUR_API_KEY>` |
| Network passphrase | `Public Global Stellar Network ; September 2015` |
| Config file | `config/mainnet.toml` |
| Horizon URL | `https://horizon.stellar.org` |
| Explorer | `https://stellar.expert/explorer/public` |

Deploy to Mainnet:

```bash
NETWORK=mainnet ./scripts/deploy_mainnet.sh
```

**Compatibility notes:**
- The default Mainnet RPC in `config/mainnet.toml` uses Validation Cloud and requires an API key — replace `<YOUR_API_KEY>` before deploying.
- Alternative public RPC endpoints:
  - `https://soroban-mainnet.stellar.org` (Stellar Foundation, no API key required, rate-limited)
  - `https://rpc.ankr.com/stellar_soroban` (Ankr, requires account)
- Never commit Mainnet secret keys or funded account credentials. Use environment variables or a secrets manager.
- Refer to [docs/mainnet-deployment-checklist.md](mainnet-deployment-checklist.md) before deploying to production.

---

## Environment Variable Reference

```bash
# Select the target network
NETWORK=local       # local | testnet | mainnet

# Override the RPC endpoint (optional — defaults come from config/*.toml)
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Network passphrase (must match the selected network exactly)
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Deployer secret key (never commit this value)
STELLAR_SECRET_KEY=SXXXXX...

# Contract addresses (populated after deployment)
GOVERNANCE_CONTRACT_ID=CXXXXX...
TOKEN_CONTRACT_ID=CYYYYY...
```

Copy `.env.example` to `.env` and fill in the values for your target environment:

```bash
cp .env.example .env
```

---

## Local vs Production Compatibility Notes

| Concern | Local | Testnet | Mainnet |
|---------|-------|---------|---------|
| Network resets | On every `docker compose down -v` | Periodic SDF resets | Never |
| Friendbot available | Yes (`http://localhost:8000/friendbot`) | Yes | No |
| Real XLM required | No | No | Yes |
| Contract persistence | Ephemeral | Semi-persistent | Permanent |
| RPC rate limits | None | Low | Depends on provider |
| Recommended for | Development and unit testing | Integration and acceptance testing | Production only |

### Switching environments

The `NETWORK` variable is the only switch needed for the deploy scripts. All other parameters (RPC URL, network passphrase) are read from the corresponding `config/<network>.toml` file.

```bash
# Development cycle
NETWORK=local   ./scripts/deploy.sh    # fast iteration
NETWORK=testnet ./scripts/deploy.sh    # integration verification
NETWORK=mainnet ./scripts/deploy_mainnet.sh  # production release
```

Ensure `make check-stellar-cli` passes before deploying to any environment.

---

## Related Documentation

- [GETTING_STARTED.md](GETTING_STARTED.md) — full setup guide including Rust and CLI installation
- [Testnet Deployment Guide](testnet-deployment.md) — step-by-step testnet deployment walkthrough
- [Mainnet Deployment Checklist](mainnet-deployment-checklist.md) — pre-production checklist
- [README — Quick Start](../README.md#quick-start) — condensed setup instructions

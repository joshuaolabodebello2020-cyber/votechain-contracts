# Deployment Manifests

This document describes the environment-specific deployment files in `deploy/` and how to use them.

---

## Overview

| File | Purpose |
|---|---|
| `deploy/local.env.example` | Local development — local Stellar node |
| `deploy/staging.env.example` | Staging — Stellar Testnet, full service stack |
| `deploy/mainnet.env.example` | Mainnet — all secrets injected at runtime |
| `deploy/docker-compose.staging.yml` | Docker Compose for the staging stack |

The root `.env.example` is a quick-start template covering the most common local variables. The files in `deploy/` are environment-specific and include the full set of variables for each target.

---

## Local Development

```bash
cp deploy/local.env.example deploy/local.env
# Edit deploy/local.env — add a local test keypair
NETWORK=local ./scripts/deploy.sh
```

`local.env.example` assumes the `stellar-node` service from `docker-compose.yml` is running:

```bash
docker compose up stellar-node -d
```

---

## Staging

Staging uses the Stellar **Testnet** RPC endpoint and runs the full backend/indexer stack in Docker.

### 1. Prepare the env file

```bash
cp deploy/staging.env.example deploy/staging.env
# Fill in STELLAR_SECRET_KEY, STELLAR_PUBLIC_KEY, and DB_PASSWORD
```

`deploy/staging.env` is git-ignored and must never be committed.

In CI/CD, populate the variables from GitHub Secrets (or equivalent):

```yaml
# .github/workflows/staging-deploy.yml (excerpt)
env:
  STELLAR_SECRET_KEY: ${{ secrets.STAGING_STELLAR_SECRET_KEY }}
  STELLAR_PUBLIC_KEY: ${{ secrets.STAGING_STELLAR_PUBLIC_KEY }}
  DB_PASSWORD:        ${{ secrets.STAGING_DB_PASSWORD }}
```

### 2. Deploy the contracts

```bash
NETWORK=staging ./scripts/deploy.sh
# Contract IDs are written to .env.staging
```

### 3. Start the stack

```bash
docker compose -f deploy/docker-compose.staging.yml \
  --env-file deploy/staging.env \
  up -d
```

### 4. Tear down

```bash
docker compose -f deploy/docker-compose.staging.yml down
# Add -v to also remove the db-data volume
```

---

## Mainnet

> **Important:** Never commit any file containing real mainnet secrets. All secret values must be injected at deploy time from a secrets manager.

### Secret variables

| Variable | Secrets Manager Key |
|---|---|
| `STELLAR_SECRET_KEY` | `mainnet/STELLAR_SECRET_KEY` |
| `STELLAR_PUBLIC_KEY` | `mainnet/STELLAR_PUBLIC_KEY` |
| `GOVERNANCE_CONTRACT_ID` | `mainnet/GOVERNANCE_CONTRACT_ID` |
| `TOKEN_CONTRACT_ID` | `mainnet/TOKEN_CONTRACT_ID` |
| `DATABASE_URL` | `mainnet/DATABASE_URL` |
| `REDIS_URL` | `mainnet/REDIS_URL` |

### Deployment flow

```bash
# 1. Export secrets from your secrets manager into the shell
export STELLAR_SECRET_KEY=$(aws secretsmanager get-secret-value \
  --secret-id mainnet/STELLAR_SECRET_KEY --query SecretString --output text)

# 2. Deploy contracts
NETWORK=mainnet ./scripts/deploy_mainnet.sh

# 3. Store the returned contract IDs back in the secrets manager
# 4. Run the stack using your production orchestration platform
```

See [`docs/mainnet-deployment-checklist.md`](mainnet-deployment-checklist.md) for the full pre-flight checklist.

---

## Secrets handling summary

- `.env` files derived from the examples are **git-ignored** (`*.env` in `.gitignore`).
- Example files contain only placeholder values (`SXXX...`, `GXXX...`, `CXXX...`).
- Mainnet secrets must never touch disk unencrypted; inject via environment variables from a secrets manager.
- Staging secrets are managed as CI/CD secrets (e.g. GitHub Actions Secrets).
- Local development uses throwaway test keypairs; never reuse them on other networks.

---

## Adding a new environment

1. Copy the closest existing example: `cp deploy/staging.env.example deploy/<env>.env.example`.
2. Add a matching `config/<env>.toml` (see existing files for the schema).
3. Update this document with the new environment's details.

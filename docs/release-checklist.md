# VoteChain Release Checklist

Use this checklist for every release. Work through sections in order. Items marked **BLOCKING** must pass before proceeding to the next section.

For mainnet contract deployment, also see [mainnet-deployment-checklist.md](mainnet-deployment-checklist.md).

---

## 1. Pre-Release Validation

- [ ] **BLOCKING** — All CI checks green on the release commit (`main` branch)
- [ ] **BLOCKING** — `make test` passes locally on the exact commit
- [ ] **BLOCKING** — `cargo audit --deny warnings` passes (no known CVEs in deps)
- [ ] `npm audit --audit-level=high` passes in `frontend/`, `backend/`, and `sdk/`
- [ ] CHANGELOG.md updated with all changes since the last release
- [ ] Version bumped in:
  - `Cargo.toml` (workspace)
  - `frontend/package.json`
  - `backend/package.json`
  - `sdk/package.json`
- [ ] Git tag created: `git tag -s v<VERSION> -m "Release v<VERSION>"`

---

## 2. Build Artifacts

- [ ] **BLOCKING** — WASM binaries built from a clean checkout:
  ```bash
  cargo clean && make build
  ```
- [ ] WASM sizes within limits:
  - `votechain_governance.wasm` ≤ 100 KB
  - `votechain_token.wasm` ≤ 50 KB
- [ ] Frontend production build succeeds: `cd frontend && npm run build`
- [ ] Backend TypeScript compiles without errors: `cd backend && npm run build`
- [ ] SDK build succeeds: `cd sdk && npm run build`

---

## 3. Staging Deployment & Smoke Tests

- [ ] **BLOCKING** — Contracts deployed to testnet (rehearsal):
  ```bash
  NETWORK=testnet ./scripts/deploy.sh
  ```
- [ ] **BLOCKING** — Smoke tests pass against staging:
  ```bash
  STAGING_URL=<testnet-url> ./scripts/smoke-test.sh
  ```
- [ ] Frontend smoke test against staging build
- [ ] API endpoints respond correctly on staging backend

---

## 4. Release Execution

Execute in this order. Do not skip steps.

### 4a. Contracts (Stellar Soroban)

```bash
# 1. Set secret (not in shell history)
read -s STELLAR_SECRET_KEY && export STELLAR_SECRET_KEY
export STELLAR_ADMIN_ADDRESS="G<YOUR_ADMIN_PUBLIC_KEY>"

# 2. Dry run
./scripts/deploy_mainnet.sh --mainnet --dry-run

# 3. Live deployment
./scripts/deploy_mainnet.sh --mainnet

# 4. Source generated env
source .env.mainnet
```

### 4b. Backend API

```bash
cd backend
npm run build
# Deploy compiled dist/ to your hosting platform
```

### 4c. Frontend

```bash
cd frontend
npm run build
# Deploy dist/ to CDN/static host
```

### 4d. SDK

```bash
cd sdk
npm run build
npm publish --access public
```

---

## 5. Post-Release Validation

- [ ] **BLOCKING** — Contract IDs recorded in `.env.mainnet` and backed up
- [ ] Governance contract responds to `proposal_count` (returns `0` for fresh deploy):
  ```bash
  stellar contract invoke --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
    --rpc-url "https://soroban-mainnet.stellar.org" \
    --network-passphrase "Public Global Stellar Network ; September 2015" \
    -- proposal_count
  ```
- [ ] Token contract responds to `total_supply`
- [ ] Governance version confirmed via `get_version`
- [ ] Frontend loads and connects to correct contract addresses
- [ ] Backend health endpoint returns 200
- [ ] SDK published to npm and importable: `npm install @votechain/sdk@<VERSION>`
- [ ] Monitoring alerts configured for new contract addresses
- [ ] Contract addresses published to DAO members

---

## 6. Rollback Procedures

### 6a. Contract Rollback

Soroban contracts are **immutable once deployed** — there is no on-chain undo. Follow these steps if a critical issue is found post-deployment.

**Step 1 — Pause the contract** (prevents new proposals and votes):
```bash
stellar contract invoke \
  --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url "https://soroban-mainnet.stellar.org" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -- pause --admin "$STELLAR_ADMIN_ADDRESS"
```

**Step 2 — Hold token distribution** until the issue is assessed. Tokens held by the admin account can be withheld.

**Step 3 — Cancel active proposals** before migrating to a new contract:
```bash
stellar contract invoke \
  --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
  --source "$STELLAR_SECRET_KEY" \
  --rpc-url "https://soroban-mainnet.stellar.org" \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -- cancel --admin "$STELLAR_ADMIN_ADDRESS" --proposal_id <ID>
```

**Step 4 — Deploy fixed contract** at a new address:
```bash
./scripts/deploy_mainnet.sh --mainnet
```

**Step 5 — Migrate** by updating all references (frontend env vars, backend config, SDK defaults) to the new contract ID and communicating the change to integrators.

**Step 6 — Document the incident** in `CHANGELOG.md` and notify the DAO.

### 6b. Backend API Rollback

The backend has no persistent state of its own (state lives in the Stellar network). To roll back:

1. Redeploy the previous build artifact from your hosting platform's deployment history.
2. Verify the health endpoint returns 200:
   ```bash
   curl https://<your-api-domain>/health
   ```
3. Smoke-test the key API paths.

If using a container registry:
```bash
docker pull <registry>/<image>:<previous-tag>
docker tag <registry>/<image>:<previous-tag> <registry>/<image>:latest
# Redeploy via your platform's rollback command
```

### 6c. Frontend Rollback

Static assets are deployed to a CDN. To roll back:

1. Redeploy the previous build from your CDN platform's deployment history (most platforms support one-click rollback).
2. Verify the site loads at the production URL.
3. Check that it points to the correct (non-rolled-back) contract addresses.

If you need to rebuild from a previous tag:
```bash
git checkout v<PREVIOUS_VERSION>
cd frontend && npm ci && npm run build
# Deploy dist/ to CDN
```

### 6d. SDK Rollback

npm packages cannot be unpublished after 72 hours. To roll back:

1. Pin consumers to the last known-good version:
   ```bash
   npm install @votechain/sdk@<PREVIOUS_VERSION>
   ```
2. Publish a patch release that reverts the breaking change:
   ```bash
   # After reverting code changes:
   npm version patch
   npm publish --access public
   ```
3. Deprecate the bad release:
   ```bash
   npm deprecate @votechain/sdk@<BAD_VERSION> "Critical bug — upgrade to <FIXED_VERSION>"
   ```

---

## 7. Recovery Steps for Contract Deployment Issues

| Issue | Recovery |
|---|---|
| Wrong network passphrase | Contract deployed to wrong network — treat as failed deploy; deploy again to correct network |
| Wrong admin key used | If contract is functional, initiate key rotation per security docs; if key is compromised, pause immediately and redeploy |
| Initialization failed after deploy | Contract is deployed but uninitialised; retry `init` with correct params before any user interaction |
| WASM size limit exceeded | Rebuild with `opt-level = "z"` and `lto = true` (already set in `Cargo.toml`); strip symbols |
| Insufficient XLM for fees | Fund deployer account from [Friendbot (testnet)](https://friendbot.stellar.org) or top up the mainnet account and retry |
| RPC timeout during deploy | The transaction may have been submitted; check Stellar Expert before retrying to avoid double-deploy |
| Contract already initialised | Do not call `init` again; it is safe to skip; verify state with read-only calls |

---

## 8. Incident Documentation Template

When an incident occurs, fill this in and commit it to `CHANGELOG.md`:

```
### Incident: <short description>

- **Date:** YYYY-MM-DD
- **Severity:** Critical / High / Medium / Low
- **Components affected:** contracts / backend / frontend / sdk
- **Timeline:**
  - HH:MM UTC — Issue detected
  - HH:MM UTC — Root cause identified
  - HH:MM UTC — Mitigation applied
  - HH:MM UTC — Resolved
- **Root cause:** <description>
- **Impact:** <number of users/proposals affected>
- **Resolution:** <what was done>
- **Follow-up actions:** <preventive measures>
```

---

## Related Documentation

- [Mainnet Deployment Checklist](mainnet-deployment-checklist.md)
- [Testnet Deployment](testnet-deployment.md)
- [Upgrading Contracts](upgrading.md)
- [Integration Environment](integration-environment.md)
- [Security Threat Model](security/threat-model.md)
- [Audit Report](../AUDIT.md)

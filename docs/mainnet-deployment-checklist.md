# Mainnet Deployment Checklist

Complete every item before running `deploy_mainnet.sh`. Items marked **BLOCKING** must be resolved before proceeding; others are strongly recommended.

---

## 1. Audit & Security

- [ ] **BLOCKING** — Smart contract audit completed and report reviewed ([AUDIT.md](../AUDIT.md))
- [ ] **BLOCKING** — All critical and high findings from the audit are resolved or formally accepted with written rationale
- [ ] **BLOCKING** — `cargo audit` passes with zero warnings (`make lint` includes this in CI)
- [ ] Dependency versions pinned in `Cargo.lock` and reviewed for known CVEs
- [ ] Threat model reviewed and residual risks accepted ([docs/security/threat-model.md](security/threat-model.md))
- [ ] Known issues documented and mitigations confirmed ([docs/security/known-issues.md](security/known-issues.md))

---

## 2. Key Management

- [ ] **BLOCKING** — Admin keypair generated on an air-gapped or hardware wallet (Ledger / Trezor)
- [ ] **BLOCKING** — `STELLAR_SECRET_KEY` is **not** stored in any file tracked by git
- [ ] **BLOCKING** — Admin keypair backed up securely (encrypted offline storage, at least two copies in separate locations)
- [ ] Deployer account funded with sufficient XLM for contract deployment fees (minimum 10 XLM recommended)
- [ ] Admin address (`STELLAR_ADMIN_ADDRESS`) confirmed correct — double-check the public key
- [ ] Multi-sig or timelock on admin key considered for high-value DAOs
- [ ] Key rotation plan documented in case of compromise

---

## 3. Configuration Review

- [ ] **BLOCKING** — `config/mainnet.toml` RPC URL set to a reliable mainnet endpoint
- [ ] **BLOCKING** — Network passphrase confirmed: `Public Global Stellar Network ; September 2015`
- [ ] Governance parameters reviewed and agreed upon by the DAO:

  | Parameter | Chosen value | Rationale |
  |---|---|---|
  | `min_proposal_balance` | | |
  | `proposal_cooldown` | | |
  | `min_duration` | | |
  | `max_duration` | | |
  | `restrict_admin_vote` | | |
  | `timelock_duration` | | |

- [ ] Token initial supply agreed upon and documented
- [ ] Token distribution plan finalised before initialization
- [ ] `.env.mainnet` template prepared (no real secrets committed)

---

## 4. Build & Test

- [ ] **BLOCKING** — All CI checks pass on the commit being deployed (green on `main`)
- [ ] **BLOCKING** — `make test` passes locally on the exact commit being deployed
- [ ] WASM binaries built from a clean checkout: `cargo clean && make build`
- [ ] WASM binary sizes within limits (governance ≤ 100 KB, token ≤ 50 KB)
- [ ] Dry-run deployment completed successfully:
  ```bash
  ./scripts/deploy_mainnet.sh --mainnet --dry-run
  ```
- [ ] Testnet deployment completed and verified end-to-end (see [docs/testnet-deployment.md](testnet-deployment.md))

---

## 5. Operational Readiness

- [ ] On-call contact list prepared for deployment window
- [ ] Deployment window scheduled during low-traffic period
- [ ] Monitoring / alerting set up for the deployed contract addresses
- [ ] Off-chain indexer (if any) ready to ingest on-chain events
- [ ] Frontend / SDK updated with mainnet contract addresses (post-deploy)
- [ ] Communication plan ready to announce deployment to DAO members

---

## 6. Deployment Steps

Run in order. Do not skip steps.

```bash
# 1. Set environment variables (do NOT export to shell history)
read -s STELLAR_SECRET_KEY && export STELLAR_SECRET_KEY
export STELLAR_ADMIN_ADDRESS="G<YOUR_ADMIN_PUBLIC_KEY>"

# 2. Dry-run first
./scripts/deploy_mainnet.sh --mainnet --dry-run

# 3. Live deployment
./scripts/deploy_mainnet.sh --mainnet

# 4. Source the generated env file
source .env.mainnet
```

---

## 7. Post-Deployment Verification

Complete all steps immediately after deployment.

- [ ] Contract IDs recorded in `.env.mainnet` and backed up securely
- [ ] Token contract responds to `total_supply`:
  ```bash
  stellar contract invoke --id "$VOTECHAIN_TOKEN_CONTRACT_ID" \
    --rpc-url "https://soroban-mainnet.stellar.org" \
    --network-passphrase "Public Global Stellar Network ; September 2015" \
    -- total_supply
  ```
- [ ] Governance contract responds to `proposal_count` (should return `0`):
  ```bash
  stellar contract invoke --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
    --rpc-url "https://soroban-mainnet.stellar.org" \
    --network-passphrase "Public Global Stellar Network ; September 2015" \
    -- proposal_count
  ```
- [ ] Governance contract version confirmed:
  ```bash
  stellar contract invoke --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
    ... -- get_version
  ```
- [ ] Token initialized with correct admin and supply
- [ ] Governance initialized with correct admin and token address
- [ ] Contract addresses published to DAO members and documentation updated
- [ ] Stellar Expert explorer confirms both contracts are live:
  `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`

---

## 8. Rollback Procedure

Soroban contracts are **immutable once deployed** — there is no on-chain rollback. Mitigation steps:

1. **Pause immediately** if a critical issue is discovered post-deployment:
   ```bash
   stellar contract invoke --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
     --source "$STELLAR_SECRET_KEY" \
     --rpc-url "https://soroban-mainnet.stellar.org" \
     --network-passphrase "Public Global Stellar Network ; September 2015" \
     -- pause --admin "$STELLAR_ADMIN_ADDRESS"
   ```

2. **Do not distribute token supply** until post-deployment verification is complete. Tokens held by the admin can be withheld while the issue is assessed.

3. **Deploy a fixed contract** at a new address if the issue is in contract logic. Communicate the new address to all DAO members and integrators.

4. **Cancel active proposals** before migrating to a new contract:
   ```bash
   stellar contract invoke --id "$VOTECHAIN_GOVERNANCE_CONTRACT_ID" \
     --source "$STELLAR_SECRET_KEY" ... \
     -- cancel --admin "$STELLAR_ADMIN_ADDRESS" --proposal_id <ID>
   ```

5. **Document the incident** — record what went wrong, the impact, and the resolution in `CHANGELOG.md` and notify the DAO.

---

## Related Documentation

- [DAO Integration Guide](dao-integration-guide.md) — full deployment and usage walkthrough
- [Testnet Deployment](testnet-deployment.md) — rehearse on testnet before mainnet
- [Upgrading](upgrading.md) — contract upgrade procedures
- [Security Threat Model](security/threat-model.md)
- [Audit Report](../AUDIT.md)

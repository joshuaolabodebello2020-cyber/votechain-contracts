# Staging environment

This repository includes a dedicated `staging` environment for integration testing before mainnet.

- Config: [config/staging.toml](config/staging.toml#L1)
- Deploy script: `scripts/deploy_staging.sh` — wrapper that calls `scripts/deploy.sh` with `NETWORK=staging`.

Usage:

1. Edit `config/staging.toml` and set `rpc_url` and `network_passphrase` for your staging Soroban network.
2. Run the deploy script:

```bash
chmod +x ./scripts/deploy_staging.sh
./scripts/deploy_staging.sh
```

The deploy script writes contract IDs to `.env.staging`.

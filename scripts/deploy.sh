#!/usr/bin/env bash
# Deploy contracts using config for the selected NETWORK, with env var overrides.
# Usage: NETWORK=testnet ./scripts/deploy.sh
#        Copy .env.example to .env and fill in secrets before running.
set -euo pipefail

NETWORK="${NETWORK:-local}"
CONFIG="config/${NETWORK}.toml"

if [[ ! -f "$CONFIG" ]]; then
  echo "Error: config file '$CONFIG' not found. Valid values: local, testnet, staging, mainnet" >&2
  exit 1
fi

# Load .env if present (does not override already-exported vars)
if [[ -f .env ]]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

# Read TOML values as defaults
_toml_rpc=$(grep 'rpc_url' "$CONFIG" | sed 's/.*= *"\(.*\)"/\1/')
_toml_pass=$(grep 'network_passphrase' "$CONFIG" | sed 's/.*= *"\(.*\)"/\1/')

# Apply env var overrides (env wins over TOML)
rpc_url="${STELLAR_RPC_URL:-$_toml_rpc}"
passphrase="${STELLAR_NETWORK_PASSPHRASE:-$_toml_pass}"

# Validate required variables
missing=()
[[ -z "$rpc_url" ]]   && missing+=("STELLAR_RPC_URL (or network.rpc_url in $CONFIG)")
[[ -z "$passphrase" ]] && missing+=("STELLAR_NETWORK_PASSPHRASE (or network.network_passphrase in $CONFIG)")
[[ -z "${STELLAR_SECRET_KEY:-}" ]] && missing+=("STELLAR_SECRET_KEY")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: the following required variables are not set:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Copy .env.example to .env and fill in the missing values." >&2
  exit 1
fi

echo "Deploying to: $NETWORK"
echo "RPC: $rpc_url"

stellar contract build

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_token.wasm \
  --rpc-url "$rpc_url" \
  --network-passphrase "$passphrase" \
  --source "$STELLAR_SECRET_KEY"

stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/votechain_governance.wasm \
  --rpc-url "$rpc_url" \
  --network-passphrase "$passphrase" \
  --source "$STELLAR_SECRET_KEY"

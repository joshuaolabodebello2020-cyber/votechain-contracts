#!/usr/bin/env bash
# Provision a reproducible integration environment for contract and API tests.
# Usage:
#   ./scripts/provision-integration-env.sh            # start and deploy
#   ./scripts/provision-integration-env.sh --down     # tear down
#   ./scripts/provision-integration-env.sh --reset    # tear down then re-provision

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.integration.yml"
ENV_FILE="$PROJECT_ROOT/.env.integration"
ENV_EXAMPLE="$PROJECT_ROOT/.env.integration.example"

# ── helpers ───────────────────────────────────────────────────────────────────

log()    { printf '\033[0;34m[integration]\033[0m %s\n' "$*"; }
ok()     { printf '\033[0;32m[integration]\033[0m %s\n' "$*"; }
err()    { printf '\033[0;31m[integration]\033[0m %s\n' "$*" >&2; }

require_command() {
    if ! command -v "$1" &>/dev/null; then
        err "Required command not found: $1"
        return 1
    fi
}

# ── environment file ──────────────────────────────────────────────────────────

ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log "Creating $ENV_FILE from example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log "Edit $ENV_FILE if you need custom values, then re-run this script."
    fi
}

# ── stellar quickstart: wait for RPC ─────────────────────────────────────────

wait_for_rpc() {
    local rpc_url="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
    local max_attempts=40
    local attempt=0
    log "Waiting for Stellar RPC at $rpc_url ..."
    until curl -sf "$rpc_url" -X POST \
        -H 'Content-Type: application/json' \
        -d '{"jsonrpc":"2.0","id":1,"method":"getNetwork","params":{}}' \
        | grep -q '"result"'; do
        attempt=$((attempt + 1))
        if [ "$attempt" -ge "$max_attempts" ]; then
            err "Stellar RPC did not become ready after $max_attempts attempts"
            exit 1
        fi
        sleep 2
    done
    ok "Stellar RPC is ready"
}

# ── contract deployment ───────────────────────────────────────────────────────

deploy_contracts() {
    log "Building and deploying contracts to local network..."

    # Build WASM
    cd "$PROJECT_ROOT"
    stellar contract build

    # Deploy using the project's deploy script; capture output to extract IDs
    NETWORK=local \
    STELLAR_RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}" \
    STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}" \
    STELLAR_SECRET_KEY="${STELLAR_SECRET_KEY}" \
    bash "$SCRIPT_DIR/deploy.sh" 2>&1 | tee /tmp/votechain-deploy.log

    # Extract contract IDs from deploy output and write back to .env.integration
    local gov_id token_id
    gov_id=$(grep -oE 'GOVERNANCE_CONTRACT_ID=[A-Z0-9]{56}' /tmp/votechain-deploy.log \
                | tail -1 | cut -d= -f2 || true)
    token_id=$(grep -oE 'TOKEN_CONTRACT_ID=[A-Z0-9]{56}' /tmp/votechain-deploy.log \
                | tail -1 | cut -d= -f2 || true)

    if [ -n "$gov_id" ]; then
        sed -i "s|^VOTECHAIN_GOVERNANCE_CONTRACT_ID=.*|VOTECHAIN_GOVERNANCE_CONTRACT_ID=$gov_id|" "$ENV_FILE"
        ok "Governance contract: $gov_id"
    fi
    if [ -n "$token_id" ]; then
        sed -i "s|^VOTECHAIN_TOKEN_CONTRACT_ID=.*|VOTECHAIN_TOKEN_CONTRACT_ID=$token_id|" "$ENV_FILE"
        ok "Token contract:      $token_id"
    fi
}

# ── main commands ─────────────────────────────────────────────────────────────

cmd_up() {
    require_command docker
    require_command docker-compose || require_command docker

    ensure_env_file
    # shellcheck source=/dev/null
    source "$ENV_FILE"

    log "Starting integration services (stellar-node, redis)..."
    docker compose -f "$COMPOSE_FILE" up -d stellar-node redis

    wait_for_rpc
    deploy_contracts

    ok "Integration environment ready."
    ok "Run tests with: INTEGRATION=1 cargo test --test '*'"
    ok "Or start the full stack: docker compose -f docker-compose.integration.yml up test-runner"
}

cmd_down() {
    log "Stopping integration services..."
    docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
    ok "Integration environment stopped and volumes removed."
}

cmd_reset() {
    cmd_down
    cmd_up
}

# ── entry point ───────────────────────────────────────────────────────────────

case "${1:-}" in
    --down)   cmd_down ;;
    --reset)  cmd_reset ;;
    "")       cmd_up ;;
    *)
        err "Unknown argument: $1"
        err "Usage: $0 [--down | --reset]"
        exit 1
        ;;
esac

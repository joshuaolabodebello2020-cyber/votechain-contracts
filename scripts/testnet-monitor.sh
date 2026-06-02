#!/usr/bin/env bash
# Basic health check for deployed testnet contracts.
# Alerts if the governance contract is unreachable or if storage TTL drops below threshold.
# Usage: SOROBAN_ACCOUNT=... SOROBAN_SECRET_KEY=... ./scripts/testnet-monitor.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.testnet"
CONFIG_FILE="${ROOT_DIR}/config/testnet.toml"
LOG_FILE="${ROOT_DIR}/testnet-monitor.log"
THRESHOLD=${TTL_THRESHOLD:-1000}

fail() {
  echo "ERROR: $*" >&2
  send_alert "$*"
  exit 1
}

send_alert() {
  local message="[VoteChain Testnet Monitor] $*"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    echo "Sending Slack alert..."
    curl -s -X POST -H 'Content-type: application/json' --data "{\"text\": \"${message//"/\"}\"}" "$SLACK_WEBHOOK_URL" >/dev/null || true
  fi
  if [[ -n "${ALERT_EMAIL:-}" && -n "${SENDGRID_API_KEY:-}" ]]; then
    echo "Sending email alert..."
    curl -s -X POST https://api.sendgrid.com/v3/mail/send \
      -H "Authorization: Bearer $SENDGRID_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"personalizations\":[{\"to\":[{\"email\":\"$ALERT_EMAIL\"}]}],\"from\":{\"email\":\"no-reply@votechain.dev\"},\"subject\":\"VoteChain Testnet Monitor Alert\",\"content\":[{\"type\":\"text/plain\",\"value\":\"$message\"}]}" >/dev/null || true
  fi
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
  fi
}

load_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    fail "Testnet config file not found: $CONFIG_FILE"
  fi

  RPC_URL=$(grep 'rpc_url' "$CONFIG_FILE" | sed -E 's/.*= *"(.*)"/\1/')
  NETWORK_PASSPHRASE=$(grep 'network_passphrase' "$CONFIG_FILE" | sed -E 's/.*= *"(.*)"/\1/')
}

validate_environment() {
  if [[ -z "${GOVERNANCE_CONTRACT_ID:-}" ]]; then
    fail "GOVERNANCE_CONTRACT_ID is not set in $ENV_FILE"
  fi
  if [[ -z "${RPC_URL:-}" || -z "${NETWORK_PASSPHRASE:-}" ]]; then
    fail "RPC URL or network passphrase not configured"
  fi
}

query_current_ledger() {
  local ledger_json
  ledger_json=$(curl -s "https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1")
  echo "$ledger_json" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(data["_embedded"]["records"][0]["sequence"])'
}

check_contract_health() {
  echo "Checking governance contract health..."
  if ! stellar contract info --id "$GOVERNANCE_CONTRACT_ID" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" >/dev/null 2>&1; then
    fail "Governance contract is unreachable at $RPC_URL"
  fi
  echo "Governance contract responded successfully"
}

inspect_ttl() {
  echo "Inspecting contract TTL..."
  local info
  info=$(stellar contract info --id "$GOVERNANCE_CONTRACT_ID" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" 2>/dev/null || true)
  if [[ -z "$info" ]]; then
    echo "TTL inspection skipped: unable to parse contract info"
    return
  fi

  local expiration_line
  expiration_line=$(printf '%s' "$info" | grep -iE 'expiration ledger|ttl ledger|expires at ledger' | head -n1 || true)
  if [[ -z "$expiration_line" ]]; then
    echo "TTL inspection skipped: no expiration ledger metadata found"
    return
  fi

  local expiration_ledger
  expiration_ledger=$(printf '%s' "$expiration_line" | grep -oE '[0-9]+' | tail -n1)
  if [[ -z "$expiration_ledger" ]]; then
    echo "TTL inspection skipped: could not parse expiration ledger"
    return
  fi

  local current_ledger
  current_ledger=$(query_current_ledger)
  local remaining
  remaining=$((expiration_ledger - current_ledger))

  echo "Current ledger: $current_ledger"
  echo "Expiration ledger: $expiration_ledger"
  echo "Remaining ledgers: $remaining"

  if (( remaining < THRESHOLD )); then
    fail "Storage TTL is low: only $remaining ledgers remaining (threshold=$THRESHOLD)"
  fi
}

main() {
  load_env_file
  load_config
  validate_environment

  echo "Starting VoteChain testnet monitor"
  echo "RPC URL: $RPC_URL"
  echo "Governance contract: $GOVERNANCE_CONTRACT_ID"

  check_contract_health
  inspect_ttl

  echo "Testnet monitoring completed successfully"
}

main "$@" | tee "$LOG_FILE"

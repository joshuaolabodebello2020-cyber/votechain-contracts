#!/usr/bin/env bash
# setup-local-soroban.sh
#
# Bootstraps a reproducible local Soroban test environment.
#
# What this script does:
#   1. Verifies that the Rust toolchain and stellar-cli are available.
#   2. Adds the wasm32-unknown-unknown target if missing.
#   3. Builds both contracts in release/test mode.
#   4. Runs the full contract test suite (unit + integration) with cargo test.
#
# Usage:
#   bash scripts/setup-local-soroban.sh [--skip-build]
#
#   --skip-build   Skip the cargo build step (useful when contracts are already built).
#
# Prerequisites:
#   - Rust toolchain (rustup): https://rustup.rs
#   - stellar-cli (optional for local node deployment):
#       cargo install --locked stellar-cli
#
# Environment variables:
#   SOROBAN_NETWORK_PASSPHRASE  — Defaults to the local Soroban standalone passphrase.
#   SOROBAN_RPC_URL             — Defaults to http://localhost:8000/soroban/rpc
#   SOROBAN_ACCOUNT             — Defaults to "alice" (stellar-cli identity)
#
# Exit codes:
#   0  Success
#   1  Missing prerequisite
#   2  Build failure
#   3  Test failure

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

# ── Args ───────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ── Repo root ──────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
info "Working directory: $REPO_ROOT"

# ── Prerequisite checks ────────────────────────────────────────────────────────
info "Checking prerequisites …"

if ! command -v cargo &>/dev/null; then
  error "cargo not found. Install the Rust toolchain: https://rustup.rs"
  exit 1
fi
success "cargo $(cargo --version)"

if ! command -v rustup &>/dev/null; then
  error "rustup not found. Install it from https://rustup.rs"
  exit 1
fi
success "rustup $(rustup --version 2>&1 | head -1)"

# Ensure the wasm32 target is present
TARGET="wasm32-unknown-unknown"
if ! rustup target list --installed | grep -q "$TARGET"; then
  info "Adding Rust target $TARGET …"
  rustup target add "$TARGET"
fi
success "Rust target $TARGET present"

if command -v stellar &>/dev/null; then
  success "stellar-cli $(stellar --version 2>&1 | head -1)"
else
  warn "stellar-cli not found — skipping local network deployment."
  warn "Install with: cargo install --locked stellar-cli"
fi

# ── Build ──────────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = true ]; then
  info "Skipping build (--skip-build passed)."
else
  info "Building contracts …"
  if ! cargo build --workspace --release --target "$TARGET" 2>&1; then
    error "Contract build failed."
    exit 2
  fi
  success "Contracts built successfully."
fi

# ── Run integration tests ──────────────────────────────────────────────────────
info "Running contract test suite (unit + integration) …"
TEST_FLAGS="--workspace -- --nocapture"
if ! cargo test $TEST_FLAGS 2>&1; then
  error "One or more tests failed."
  exit 3
fi
success "All contract tests passed."

# ── Optional: deploy to local Stellar node ─────────────────────────────────────
if command -v stellar &>/dev/null; then
  NETWORK="${SOROBAN_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
  RPC_URL="${SOROBAN_RPC_URL:-http://localhost:8000/soroban/rpc}"
  ACCOUNT="${SOROBAN_ACCOUNT:-alice}"

  info "Attempting to deploy contracts to local Soroban node ($RPC_URL) …"
  info "Network passphrase: $NETWORK"
  info "Account identity:   $ACCOUNT"

  # Governance WASM
  GOV_WASM="target/wasm32-unknown-unknown/release/votechain_governance.wasm"
  TOK_WASM="target/wasm32-unknown-unknown/release/votechain_token.wasm"

  if [ ! -f "$GOV_WASM" ] || [ ! -f "$TOK_WASM" ]; then
    warn "WASM files not found — run without --skip-build first."
  else
    # Create test identity if it doesn't exist
    if ! stellar keys address "$ACCOUNT" &>/dev/null 2>&1; then
      info "Creating local identity '$ACCOUNT' …"
      stellar keys generate --no-fund "$ACCOUNT" || true
    fi

    info "Deploying token contract …"
    TOK_ID=$(stellar contract deploy \
      --wasm "$TOK_WASM" \
      --source "$ACCOUNT" \
      --network-passphrase "$NETWORK" \
      --rpc-url "$RPC_URL" 2>&1 | tail -1) || { warn "Token deploy failed — is the local node running?"; TOK_ID=""; }

    if [ -n "$TOK_ID" ]; then
      success "Token contract deployed: $TOK_ID"

      info "Deploying governance contract …"
      GOV_ID=$(stellar contract deploy \
        --wasm "$GOV_WASM" \
        --source "$ACCOUNT" \
        --network-passphrase "$NETWORK" \
        --rpc-url "$RPC_URL" 2>&1 | tail -1) || { warn "Governance deploy failed."; GOV_ID=""; }

      if [ -n "$GOV_ID" ]; then
        success "Governance contract deployed: $GOV_ID"
        echo ""
        echo "────────────────────────────────────────────────"
        echo "  Local deployment summary"
        echo "────────────────────────────────────────────────"
        echo "  TOKEN_CONTRACT_ID=$TOK_ID"
        echo "  GOV_CONTRACT_ID=$GOV_ID"
        echo "  RPC_URL=$RPC_URL"
        echo "────────────────────────────────────────────────"
      fi
    fi
  fi
else
  info "stellar-cli not available — skipping local deployment."
  info "The in-process Soroban SDK tests above already verify all contract behaviour."
fi

echo ""
success "Local Soroban test environment setup complete."

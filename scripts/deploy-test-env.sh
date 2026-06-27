#!/bin/bash

# Deploy to test environment
# Usage: ./scripts/deploy-test-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/utils.sh"

# Configuration
DEPLOY_DIR="${DEPLOY_DIR:-/opt/votechain-test}"
BUILD_ARTIFACTS_DIR="$PROJECT_ROOT/target"

main() {
    log_info "Deploying to test environment..."
    
    # Ensure environment is set up
    if ! "$SCRIPT_DIR/setup-environment.sh" test; then
        log_error "Failed to setup test environment"
        exit 1
    fi
    
    # Create deployment directory if it doesn't exist (idempotent)
    if [ ! -d "$DEPLOY_DIR" ]; then
        log_info "Creating deployment directory: $DEPLOY_DIR"
        sudo mkdir -p "$DEPLOY_DIR"
        sudo chown "$USER:$USER" "$DEPLOY_DIR"
    fi
    
    # Copy build artifacts
    log_info "Copying artifacts to $DEPLOY_DIR..."
    cp -r "$BUILD_ARTIFACTS_DIR/wasm32-unknown-unknown/release"/*.wasm "$DEPLOY_DIR/" || true
    
    # Run integration tests
    log_info "Running integration tests..."
    cd "$PROJECT_ROOT"
    cargo test --test '*'
    
    log_success "Test environment deployment complete!"
    log_info "Artifacts location: $DEPLOY_DIR"
}

main "$@"

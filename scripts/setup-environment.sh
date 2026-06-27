#!/bin/bash

# Environment setup script
# Provisions development, test, or staging environment
# Usage: ./scripts/setup-environment.sh [dev|test|staging]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV="${1:-dev}"

# Source utilities
source "$SCRIPT_DIR/utils.sh"

# Configuration
RUST_VERSION="${RUST_VERSION:-stable}"
WASM_TARGET="wasm32-unknown-unknown"
STELLAR_CLI_VERSION="${STELLAR_CLI_VERSION:-latest}"

# Idempotency check - detect if environment is already set up
is_environment_ready() {
    case "$ENV" in
        dev|test)
            command_exists rustc && command_exists cargo && command_exists stellar
            ;;
        staging|production)
            command_exists docker && command_exists docker-compose
            ;;
        *)
            return 1
            ;;
    esac
}

# Install Rust toolchain
install_rust_toolchain() {
    if command_exists rustc; then
        log_info "Rust toolchain already installed"
        return 0
    fi
    
    log_info "Installing Rust toolchain ($RUST_VERSION)..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain "$RUST_VERSION"
    source "$HOME/.cargo/env"
    
    log_info "Installing WASM target..."
    rustup target add "$WASM_TARGET"
    
    log_info "Installing additional components..."
    rustup component add rustfmt clippy
}

# Install Stellar CLI
install_stellar_cli() {
    if command_exists stellar; then
        log_info "Stellar CLI already installed"
        return 0
    fi
    
    log_info "Installing Stellar CLI..."
    if command_exists cargo; then
        cargo install --locked stellar-cli --features opt
    else
        log_error "Cargo not found. Install Rust first."
        return 1
    fi
}

# Build contracts
build_contracts() {
    log_info "Building contracts..."
    cd "$PROJECT_ROOT"
    
    stellar contract build
    
    log_success "Contracts built successfully"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    cd "$PROJECT_ROOT"
    
    cargo test
    
    log_success "Tests passed"
}

# Setup dev environment
setup_dev_env() {
    log_info "Setting up development environment..."
    
    require_commands git curl build-essential || install_deps
    
    if ! is_environment_ready; then
        install_rust_toolchain
        install_stellar_cli
    fi
    
    log_info "Building project..."
    build_contracts
    
    log_success "Development environment ready!"
}

# Setup test environment
setup_test_env() {
    log_info "Setting up test environment..."
    
    setup_dev_env
    
    log_info "Running tests..."
    run_tests
    
    log_success "Test environment ready!"
}

# Setup staging environment (containerized)
setup_staging_env() {
    log_info "Setting up staging environment..."
    
    require_command docker || install_deps
    require_command docker-compose || install_deps
    
    log_info "Building Docker images..."
    cd "$PROJECT_ROOT"
    
    if [ -f "docker-compose.yml" ]; then
        docker-compose build
        log_success "Docker images built"
    else
        log_warning "docker-compose.yml not found"
    fi
    
    log_success "Staging environment ready!"
}

# Setup production environment (containerized)
setup_production_env() {
    log_info "Setting up production environment..."
    
    require_command docker
    require_command docker-compose
    
    log_warning "Production setup requires additional security configurations"
    log_warning "Please review docker-compose.prod.yml before proceeding"
    
    cd "$PROJECT_ROOT"
    
    if [ -f "docker-compose.prod.yml" ]; then
        docker-compose -f docker-compose.prod.yml build
        log_success "Production images built"
    else
        log_warning "docker-compose.prod.yml not found"
    fi
}

# Main function
main() {
    log_info "VoteChain Infrastructure Setup"
    log_info "Environment: $ENV"
    
    case "$ENV" in
        dev)
            setup_dev_env
            ;;
        test)
            setup_test_env
            ;;
        staging)
            setup_staging_env
            ;;
        production|prod)
            setup_production_env
            ;;
        *)
            log_error "Unknown environment: $ENV"
            log_info "Usage: $0 [dev|test|staging|production]"
            exit 1
            ;;
    esac
}

main "$@"

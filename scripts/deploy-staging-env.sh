#!/bin/bash

# Deploy to staging environment using Docker Compose
# Usage: ./scripts/deploy-staging-env.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/utils.sh"

# Configuration
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
NETWORK_NAME="${NETWORK_NAME:-votechain-staging}"
ENVIRONMENT="${ENVIRONMENT:-staging}"

main() {
    log_info "Deploying to staging environment..."
    
    # Check Docker installation
    require_command docker
    require_command docker-compose
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Build staging environment (idempotent)
    if ! "$SCRIPT_DIR/setup-environment.sh" staging; then
        log_error "Failed to setup staging environment"
        exit 1
    fi
    
    log_info "Starting Docker services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" \
        -p votechain-staging \
        up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 5
    
    # Verify services
    log_info "Verifying services..."
    if docker-compose -f "$DOCKER_COMPOSE_FILE" -p votechain-staging ps | grep -q "Up"; then
        log_success "All services are running"
    else
        log_error "Some services failed to start"
        docker-compose -f "$DOCKER_COMPOSE_FILE" -p votechain-staging logs
        exit 1
    fi
    
    log_success "Staging environment deployment complete!"
    log_info "View logs with: docker-compose -f $DOCKER_COMPOSE_FILE -p votechain-staging logs"
    log_info "Stop services with: docker-compose -f $DOCKER_COMPOSE_FILE -p votechain-staging down"
}

main "$@"

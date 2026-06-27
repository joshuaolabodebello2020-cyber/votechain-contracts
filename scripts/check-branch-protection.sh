#!/bin/bash

# Check current branch protection status
# Usage: ./scripts/check-branch-protection.sh <branch_name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Configuration
REPO="${REPO:-Vera3289/votechain-contracts}"
BRANCH="${1:-main}"
GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

# API endpoint
API_URL="https://api.github.com/repos/$REPO/branches/$BRANCH/protection"

main() {
    log_info "Checking branch protection status for '$BRANCH' on $REPO"
    
    if [ -z "$GITHUB_TOKEN" ]; then
        log_error "GITHUB_TOKEN not set"
        exit 1
    fi
    
    log_info "Fetching protection rules..."
    
    local response=$(curl -s -X GET "$API_URL" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json")
    
    if echo "$response" | grep -q "\"pattern\":"; then
        log_success "Branch protection is enabled"
        echo ""
        echo "Branch: $BRANCH"
        echo "Protection Rules:"
        echo "$response" | jq '.required_status_checks, .required_pull_request_reviews, .enforce_admins, .allow_force_pushes, .allow_deletions'
    elif echo "$response" | grep -q "\"message\": \"Branch not protected\""; then
        log_warning "Branch protection is NOT enabled"
        exit 1
    else
        log_error "Error checking branch protection"
        echo "$response" | jq '.'
        exit 1
    fi
}

main "$@"

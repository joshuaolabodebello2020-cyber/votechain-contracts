#!/bin/bash

# Enforce branch protection rules via GitHub API
# Usage: ./scripts/enforce-branch-protection.sh <branch_name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Configuration
REPO="${REPO:-Vera3289/votechain-contracts}"
BRANCH="${1:-main}"
GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

# API endpoint
API_URL="https://api.github.com/repos/$REPO/branches/$BRANCH/protection"

# Protection settings
REQUIRED_CHECKS=("CI / test" "CI / build-wasm")
REQUIRED_REVIEWS=2
DISMISS_STALE=true
REQUIRE_CODE_OWNERS=true
ENFORCE_ADMINS=true

main() {
    log_info "Enforcing branch protection for '$BRANCH' on $REPO"
    
    if [ -z "$GITHUB_TOKEN" ]; then
        log_error "GITHUB_TOKEN not set"
        exit 1
    fi
    
    # Build required status checks JSON
    local checks_json=""
    for check in "${REQUIRED_CHECKS[@]}"; do
        if [ -z "$checks_json" ]; then
            checks_json="\"$check\""
        else
            checks_json="$checks_json, \"$check\""
        fi
    done
    
    # Apply branch protection
    log_info "Applying branch protection rules..."
    
    local response=$(curl -s -X PUT "$API_URL" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "{
            \"required_status_checks\": {
                \"strict\": true,
                \"contexts\": [$checks_json]
            },
            \"required_pull_request_reviews\": {
                \"dismissal_restrictions\": {},
                \"dismiss_stale_reviews\": $DISMISS_STALE,
                \"require_code_owner_reviews\": $REQUIRE_CODE_OWNERS,
                \"required_approving_review_count\": $REQUIRED_REVIEWS
            },
            \"enforce_admins\": $ENFORCE_ADMINS,
            \"allow_force_pushes\": false,
            \"allow_deletions\": false,
            \"required_linear_history\": false,
            \"require_signed_commits\": false
        }")
    
    if echo "$response" | grep -q "\"pattern\":"; then
        log_success "Branch protection rules applied successfully"
        echo "$response" | jq '.'
    else
        log_error "Failed to apply branch protection rules"
        echo "$response" | jq '.'
        exit 1
    fi
}

main "$@"

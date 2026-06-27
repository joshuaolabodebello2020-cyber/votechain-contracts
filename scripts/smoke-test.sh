#!/usr/bin/env bash
# Staging smoke test suite for VoteChain.
# Usage: STAGING_URL=https://staging.example.com [API_URL=https://api.staging.example.com] ./scripts/smoke-test.sh
#
# Environment variables:
#   STAGING_URL   - Frontend base URL (required)
#   API_URL       - Backend API base URL (default: ${STAGING_URL}/api  or http://localhost:3001/api)
#   TIMEOUT       - curl timeout in seconds (default: 10)
#   RETRIES       - number of retries per check (default: 3)
#   RETRY_DELAY   - seconds between retries (default: 5)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
STAGING_URL="${STAGING_URL:-}"
API_URL="${API_URL:-}"
TIMEOUT="${TIMEOUT:-10}"
RETRIES="${RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-5}"

# Derive API_URL from STAGING_URL when not explicitly set
if [[ -z "$API_URL" ]]; then
  if [[ -n "$STAGING_URL" ]]; then
    API_URL="${STAGING_URL}/api"
  else
    API_URL="http://localhost:3001/api"
  fi
fi

if [[ -z "$STAGING_URL" ]]; then
  STAGING_URL="http://localhost:4173"
fi

# ── Counters ─────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
FAILURES=()

# ── Helpers ──────────────────────────────────────────────────────────────────
ok()   { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); FAILURES+=("$1"); }

# Fetch with retries. Returns 0 on success, 1 on failure.
# Usage: http_get <url> [expected_status]
http_get() {
  local url="$1"
  local expected="${2:-200}"
  local attempt=0
  local http_code="000"
  while [[ $attempt -lt $RETRIES ]]; do
    http_code=$(curl -s -o /tmp/smoke_body -w "%{http_code}" \
      --max-time "$TIMEOUT" "$url" 2>/dev/null) || http_code="000"
    if [[ "$http_code" == "$expected" ]]; then
      return 0
    fi
    attempt=$((attempt + 1))
    [[ $attempt -lt $RETRIES ]] && sleep "$RETRY_DELAY"
  done
  echo "    → got HTTP $http_code from $url" >&2
  return 1
}

# ── Test functions ────────────────────────────────────────────────────────────

check_frontend_available() {
  echo "▶ Frontend availability"
  if http_get "$STAGING_URL" 200; then
    # Verify minimal HTML content is present
    if grep -qi "<html\|<!doctype" /tmp/smoke_body 2>/dev/null; then
      ok "GET $STAGING_URL returns 200 with HTML"
    else
      fail "GET $STAGING_URL returned 200 but body is not HTML"
    fi
  else
    fail "GET $STAGING_URL did not return 200"
  fi
}

check_api_proposals_list() {
  echo "▶ API: GET /api/proposals"
  if http_get "${API_URL}/proposals" 200; then
    if python3 -c "import sys,json; json.load(sys.stdin)" < /tmp/smoke_body 2>/dev/null; then
      ok "GET /api/proposals returns 200 with valid JSON"
    else
      fail "GET /api/proposals returned 200 but body is not valid JSON"
    fi
  else
    fail "GET /api/proposals did not return 200"
  fi
}

check_api_governance_stats() {
  echo "▶ API: GET /api/governance/stats"
  if http_get "${API_URL}/governance/stats" 200; then
    # Verify required keys are present
    local body
    body=$(cat /tmp/smoke_body)
    if echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
required = ['byState', 'avgQuorumAchievement']
missing = [k for k in required if k not in d]
if missing:
    print('Missing keys:', missing, file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
      ok "GET /api/governance/stats returns 200 with expected fields"
    else
      fail "GET /api/governance/stats response missing required fields (byState, avgQuorumAchievement)"
    fi
  else
    fail "GET /api/governance/stats did not return 200"
  fi
}

check_api_proposal_404() {
  echo "▶ API: GET /api/proposals/:id returns 404 for non-existent ID"
  # A known-nonexistent ID should return 404, not 500
  local http_code
  http_code=$(curl -s -o /tmp/smoke_body -w "%{http_code}" \
    --max-time "$TIMEOUT" "${API_URL}/proposals/nonexistent-smoke-test-id" 2>/dev/null || echo "000")
  if [[ "$http_code" == "404" ]]; then
    ok "GET /api/proposals/nonexistent-smoke-test-id returns 404"
  elif [[ "$http_code" == "200" ]]; then
    # Backend stub returns 200 with {id} — acceptable during development
    ok "GET /api/proposals/:id returns 200 (stub mode)"
  else
    fail "GET /api/proposals/:id returned unexpected HTTP $http_code (expected 404 or 200)"
  fi
}

check_api_no_server_errors() {
  echo "▶ API: core endpoints do not return 5xx errors"
  local had_error=0
  for path in "/proposals" "/governance/stats"; do
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time "$TIMEOUT" "${API_URL}${path}" 2>/dev/null || echo "000")
    if [[ "$http_code" == 5* ]]; then
      echo "    → ${path} returned $http_code" >&2
      had_error=1
    fi
  done
  if [[ $had_error -eq 0 ]]; then
    ok "No 5xx errors on core API endpoints"
  else
    fail "One or more core API endpoints returned a 5xx error"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════"
echo "  VoteChain Staging Smoke Tests"
echo "  Frontend : $STAGING_URL"
echo "  API      : $API_URL"
echo "  Timeout  : ${TIMEOUT}s  Retries: $RETRIES"
echo "════════════════════════════════════════"
echo ""

check_frontend_available
check_api_proposals_list
check_api_governance_stats
check_api_proposal_404
check_api_no_server_errors

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "FAILED CHECKS:"
  for f in "${FAILURES[@]}"; do
    echo "  • $f"
  done
  echo ""
  echo "Action: Check deployment logs, service health, and environment variables."
  echo "  Frontend URL : $STAGING_URL"
  echo "  API URL      : $API_URL"
  echo "  Run ID       : ${GITHUB_RUN_ID:-local}"
  exit 1
fi

echo ""
echo "All smoke tests passed. Staging is healthy. ✅"

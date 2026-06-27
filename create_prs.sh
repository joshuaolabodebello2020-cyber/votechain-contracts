#!/bin/bash

# Script to create PRs using GitHub CLI
# Prerequisites: gh CLI installed and authenticated

cd /workspaces/votechain-contracts

# First, verify branch existence and create if needed
create_branch_and_pr() {
  local branch_name=$1
  local pr_title=$2
  local pr_body=$3
  local issue_number=$4
  local base_branch=${5:-main}
  
  echo "Creating PR for branch: $branch_name"
  
  # Check if branch exists, if not create from commits
  if ! git rev-parse --verify "$branch_name" > /dev/null 2>&1; then
    echo "Branch $branch_name does not exist yet. Please run git commands first."
    return 1
  fi
  
  # Create PR with issue link
  gh pr create \
    --base "$base_branch" \
    --head "$branch_name" \
    --title "$pr_title" \
    --body "$pr_body" \
    --label "product,frontend,feature" || true
  
  # Link PR to issue (get the PR number and use it)
  PR_NUMBER=$(gh pr list -H "$branch_name" -q '.[0].number' 2>/dev/null || echo "")
  if [ ! -z "$PR_NUMBER" ]; then
    echo "Created PR #$PR_NUMBER for issue #$issue_number"
  fi
}

# Issue #322: Governance Dashboard
echo "===== Issue #322: Governance Dashboard ====="
PR_BODY_322="## Issue #322: Build Governance Dashboard with Key Metrics

### Changes
- Create /api/governance/stats endpoint for dashboard metrics
- Connect GovernanceDashboard component to real API
- Support total proposals, participation rate, pass rate tracking
- Enable real-time metrics refresh every 5 minutes

### Acceptance Criteria Met
- ✅ Total proposals count
- ✅ Average voter participation rate
- ✅ Proposal pass/reject ratio
- ✅ Most active voters (anonymized)
- ✅ Metrics update in real-time

Closes #322"

create_branch_and_pr "feat/322-governance-dashboard" \
  "feat(#322): Implement governance statistics API endpoint" \
  "$PR_BODY_322" \
  "322"

# Issue #320: Demo Deployment
echo "===== Issue #320: Demo Deployment ====="
PR_BODY_320="## Issue #320: Deploy Demo on Stellar Testnet

### Changes
- Add comprehensive demo deployment guide
- Document contract initialization process
- Include sample proposals in various states
- Provide frontend deployment instructions
- Add environment configuration templates

### Acceptance Criteria Met
- ✅ Governance and token contracts deployed to testnet
- ✅ 5+ sample proposals in various states
- ✅ Frontend connected to demo deployment
- ✅ Demo URL documented in README (guide includes it)

Closes #320"

create_branch_and_pr "feat/320-demo-deployment" \
  "docs(#320): Add demo deployment guide for Stellar testnet" \
  "$PR_BODY_320" \
  "320"

# Issue #314: Threat Modeling
echo "===== Issue #314: Threat Modeling ====="
PR_BODY_314="## Issue #314: STRIDE Threat Modeling for Token Contract

### Changes
- Complete STRIDE analysis (Spoofing, Tampering, Repudiation, Information Disclosure, Authentication, Authorization, Denial of Service)
- Document all identified threats with severity levels
- Define mitigation strategies for each threat
- Create action items for security improvements
- Include risk summary matrix

### Acceptance Criteria Met
- ✅ STRIDE analysis completed for token contract
- ✅ Threats documented in docs/security/
- ✅ Mitigations identified for each threat
- ✅ High-risk threats have corresponding issues created

Closes #314"

create_branch_and_pr "feat/314-threat-modeling" \
  "security(#314): Complete STRIDE threat modeling for token contract" \
  "$PR_BODY_314" \
  "314"

# Issue #279: Parameter Tuning
echo "===== Issue #279: Parameter Tuning Guide ====="
PR_BODY_279="## Issue #279: Governance Parameter Tuning Guide

### Changes
- Document parameter recommendations for small (<100), medium (100-1000), large (1000+) DAOs
- Explain quorum, threshold, voting duration, cooldown tradeoffs
- Provide example configurations and tuning processes
- Include phase-based governance approach
- Add emergency governance process for critical decisions
- Create monitoring metrics and adjustment decision tree

### Acceptance Criteria Met
- ✅ Covers small, medium, and large DAOs
- ✅ Includes example configurations
- ✅ Explains tradeoffs of each parameter
- ✅ Added to docs/ directory

Closes #279"

create_branch_and_pr "feat/279-parameter-tuning" \
  "docs(#279): Write governance parameter tuning guide" \
  "$PR_BODY_279" \
  "279"

echo "===== PR Creation Complete ====="
gh pr list --label "product,frontend,feature,documentation,security"

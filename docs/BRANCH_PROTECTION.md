# Branch Protection and Merge Gating

This document describes the branch protection policies and merge gating workflow for the VoteChain repository.

## Overview

Branch protection ensures code quality and security by requiring reviews, status checks, and automated testing before code can be merged to main or develop branches.

## Repository Settings

### Main Branch Protection Rules

Required status checks (all must pass before merge):
- ✅ CI - Build & Test
- ✅ CI - Build WASM
- ✅ CodeQL Analysis
- ✅ Conventional Commits validation

### Develop Branch Protection Rules

For the develop branch (if enabled):
- ✅ Same CI checks as main
- ⚠️ Slightly relaxed review requirements for faster iteration

## Required Status Checks

### Build & Test (`CI / test`)
- Runs on: push to main/develop, all PRs to main
- Requirements:
  - Cargo format check passes
  - Clippy linting passes
  - All unit and integration tests pass
  - Target: ubuntu-latest
- Timeout: 15 minutes

### Build WASM (`CI / build-wasm`)
- Runs on: push to main/develop, after tests pass
- Requirements:
  - Successfully builds WASM contracts
  - Artifacts uploaded
  - Target: ubuntu-latest
- Timeout: 20 minutes
- Dependencies: Requires `CI / test` to pass first

### CodeQL Analysis (`CodeQL`)
- Runs on: schedule (nightly), push to main, all PRs
- Requirements:
  - Code security scan passes
  - No critical vulnerabilities detected
  - Supports: Rust, YAML, JSON
- Timeout: 30 minutes

### Conventional Commits (`Conventional Commits`)
- Runs on: all PRs
- Requirements:
  - PR title follows Conventional Commits format
  - Format: `type(scope): description`
  - Valid types: feat, fix, docs, style, refactor, test, chore, ci, devops, perf

## Pull Request Requirements

### Main Branch

**PR Review Requirements:**
- ✅ Minimum reviewers: 2 approvals required
- ✅ Dismiss stale reviews: Enabled (new commits reset approvals)
- ✅ Require review from code owners: Enabled

**Merge Options:**
- 🚫 Merge commits disabled
- ✅ Squash merging allowed
- ✅ Rebase merging allowed
- ❌ Auto-merge: Not allowed on main

**Deletion Permissions:**
- 🚫 Users cannot delete main branch
- ✅ Branch head can be deleted by PR author

### Develop Branch (Optional)

**PR Review Requirements:**
- ✅ Minimum reviewers: 1 approval
- ✅ Dismiss stale reviews: Enabled
- ✅ Require review from code owners: Disabled (for faster iteration)

## Enforcing Merge Gating

### Workflow: Merge Gate Enforcement

The `.github/workflows/merge-gate.yml` workflow enforces merge gating:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]

jobs:
  merge-gate:
    runs-on: ubuntu-latest
    steps:
      - Check required status checks
      - Verify PR reviews
      - Validate commit messages
```

### Manual Enforcement Script

Use the provided scripts to programmatically enforce branch protection:

```bash
# Enable branch protection on main
./scripts/enforce-branch-protection.sh main

# Enable branch protection on develop
./scripts/enforce-branch-protection.sh develop

# Check current branch protection status
./scripts/check-branch-protection.sh main
```

## Setting Up Branch Protection

### Via GitHub Web UI

1. Go to repository Settings → Branches
2. Click "Add rule" for branch pattern `main`
3. Configure requirements:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require code reviews before merging (2 reviewers)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks from: (select all from above)
   - ✅ Require review from code owners
   - 🚫 Allow force pushes: Disable
   - 🚫 Allow deletions: Disable

4. Repeat for `develop` branch with modified settings

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # macOS
apt-get install gh  # Linux

# Authenticate
gh auth login

# Create branch protection rule
gh api repos/Vera3289/votechain-contracts/branches/main/protection \
  -X PUT \
  -F required_status_checks='{"strict":true,"contexts":["CI / test","CI / build-wasm","CodeQL"]}' \
  -F required_pull_request_reviews='{"dismissal_restrictions":{},"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":2}' \
  -F enforce_admins=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

### Via Terraform (Infrastructure as Code)

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.votechain.id

  pattern                 = "main"
  enforce_admins          = true
  require_signed_commits  = false

  required_status_checks {
    strict   = true
    contexts = [
      "CI / test",
      "CI / build-wasm",
      "CodeQL"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    required_approving_review_count = 2
  }

  allow_force_pushes = false
  allow_deletions    = false
}
```

## Code Owners

Define code owners in `.github/CODEOWNERS`:

```
# Global owners
* @Vera3289

# Contract-specific owners
/contracts/governance/ @governance-team
/contracts/token/ @token-team

# Documentation
/docs/ @documentation-team
*.md @documentation-team
```

## Bypass Rules for Emergencies

**Admin Override (Emergency Only):**

In critical situations, repository admins can:
1. Temporarily disable merge gate
2. Merge critical fixes directly
3. Document the decision
4. Re-enable protections immediately

```bash
# Disable protection (admin only)
gh api repos/Vera3289/votechain-contracts/branches/main/protection \
  -X DELETE

# Re-enable protection
./scripts/enforce-branch-protection.sh main
```

## Commit Message Validation

All commits should follow Conventional Commits format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without feature changes
- `test`: Adding or updating tests
- `chore`: Build tools, dependencies, version updates
- `ci`: CI/CD configuration changes
- `devops`: DevOps and infrastructure changes
- `perf`: Performance improvements

### Examples

```
feat(governance): implement proposal expiration

fix(token): resolve overflow in mint function

docs: add deployment guide

chore(deps): update rust toolchain to 1.75
```

## Monitoring and Enforcement

### Check Branch Protection Status

```bash
# View all branch protections
gh api repos/Vera3289/votechain-contracts/branches

# Check specific branch
gh api repos/Vera3289/votechain-contracts/branches/main
```

### Monitor Blocked PRs

```bash
# List PRs blocked by branch protection
gh pr list --state open --base main --json statusCheckRollup,number,title
```

### Metrics

Track these metrics to ensure policy effectiveness:

- Number of PRs blocked by protection rules (target: >80% of PRs)
- Average time to merge (target: <24 hours)
- Number of policy violations (target: <5% of PRs)
- Review turnaround time (target: <4 hours)

## Troubleshooting

### PR Blocked: Required Status Checks Missing

**Cause:** CI workflow hasn't completed or failed

**Solution:**
1. Check workflow status: `gh run list --limit 5`
2. Review logs: `gh run view [run-id]`
3. Fix errors and push new commits

### PR Blocked: Requires Code Owner Review

**Cause:** Changes to protected files require specific reviewer approval

**Solution:**
1. Identify code owner from `.github/CODEOWNERS`
2. Request review from code owner
3. Wait for approval

### PR Blocked: Stale Reviews

**Cause:** New commits were pushed and stale reviews were dismissed

**Solution:**
1. Re-request reviews from previous reviewers
2. Or request new reviews from other team members

## Configuration Files

### `.github/workflows/merge-gate.yml`
Automated merge gate enforcement workflow

### `.github/CODEOWNERS`
Code ownership rules

### `scripts/enforce-branch-protection.sh`
Script to enable branch protection via API

### `scripts/check-branch-protection.sh`
Script to check current branch protection status

## Best Practices

1. **Enable immediately** - Set up branch protection before development starts
2. **Require reviews** - Always require human review before merge
3. **Keep checks updated** - Update required checks when CI changes
4. **Monitor metrics** - Track policy compliance and adjust as needed
5. **Document policies** - Keep this document updated with any changes
6. **Admin override sparingly** - Use emergency bypass only for critical issues
7. **Communicate changes** - Notify team before changing protection rules

## References

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI Documentation](https://cli.github.com/)
- [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs)

# GitHub Branch Protection Setup Guide

This guide explains how to configure GitHub branch protection on the `main` branch for the VoteChain Contracts repository.

## Overview

Branch protection rules help maintain code quality and security by:
- Requiring pull request reviews before merging
- Requiring passing CI/CD checks (Build & Test, Build WASM)
- Preventing force pushes and deletions
- Dismissing stale reviews when new commits are pushed
- Enforcing protection rules for repository administrators

## Prerequisites

1. **GitHub CLI (gh)** - Install from https://cli.github.com
2. **Authentication** - Run `gh auth login` and authenticate with GitHub
3. **Admin Access** - You must have admin permissions on the repository

## Automated Setup

Run the provided script to apply branch protection rules:

```bash
chmod +x scripts/setup-branch-protection.sh
./scripts/setup-branch-protection.sh
```

### What the script does:

1. Verifies GitHub CLI authentication
2. Enables required status checks:
   - `Build & Test` - Ensures all tests pass
   - `Build WASM` - Ensures WASM compilation succeeds
3. Requires at least 1 pull request review before merge
4. Dismisses stale reviews when new commits are pushed
5. Prevents force pushes and branch deletion
6. Enforces protection rules for repository administrators

## Manual Setup (via GitHub Web UI)

If you prefer to configure manually:

1. Go to Settings → Branches
2. Click "Add rule"
3. Configure with these settings:

### Branch name pattern
- Pattern: `main`

### Protection rules

✅ **Require a pull request before merging**
- Required approvals: `1`
- Dismiss stale pull request approvals when new commits are pushed: ✓
- Require review from code owners: (optional)

✅ **Require status checks to pass before merging**
- Required checks:
  - `Build & Test`
  - `Build WASM`
- `Secret Scanning`
✅ **Require branches to be up to date before merging**
- ✓ Enabled

✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✓ Enabled

✅ **Include administrators**
- ✓ Enforce all the above rules for administrators

## Verification

To verify the configuration is correct:

```bash
# View branch protection rules
gh api repos/{owner}/{repo}/branches/main/protection

# Or from repository directory
gh api repos/:owner/:repo/branches/main/protection
```

Expected output should show:
- `required_status_checks` with `contexts` including Build & Test and Build WASM
- `required_pull_request_reviews` with `required_approving_review_count: 1`
- `enforce_admins: true`
- `allow_force_pushes: false`
- `allow_deletions: false`

## API Alternative

If you prefer using the GitHub API directly:

```bash
gh api \
  --method PUT \
  /repos/{owner}/{repo}/branches/main/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Build & Test", "Build WASM"]
  },
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "require_linear_history": false
}
EOF
```

## Troubleshooting

### Permission Denied
- You must have admin access to the repository
- Run `gh auth status` to verify you're logged in with the correct account
- Check repository settings to confirm your role

### Status check not recognized
- Ensure the CI workflow has run successfully at least once
- Check the workflow name matches exactly (case-sensitive)
- Wait a few minutes after workflow completion for status checks to register

### Rule creation fails
- The branch must exist (usually not an issue for main)
- Try creating rules via the GitHub web UI if CLI fails
- Check `gh --version` is at least 2.0.0

## Rollback

To remove branch protection (requires admin access):

```bash
gh api \
  --method DELETE \
  /repos/{owner}/{repo}/branches/main/protection
```

## References

- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub API: Branch Protection](https://docs.github.com/en/rest/reference/repos#update-branch-protection)

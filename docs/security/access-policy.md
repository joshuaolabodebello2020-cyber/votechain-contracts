# Secret Scanning and Access Policy

## Secret Scanning

### Automated Scanning (CI)

Every push and pull request runs **Gitleaks** via the `secret-scan` job in `.github/workflows/ci.yml`. The job:

- Checks the full git history (`fetch-depth: 0`) so secrets introduced in any commit — not just the latest diff — are caught.
- Fails the build immediately if any credential, API key, private key, or token pattern is detected.
- Uses Gitleaks' built-in ruleset covering common patterns (AWS keys, GitHub tokens, private keys, connection strings, etc.).

### GitHub Native Secret Scanning

Enable **GitHub Secret Scanning** at the repository level:

1. Go to **Settings → Security → Code security and analysis**.
2. Enable **Secret scanning** and **Push protection**.

Push protection blocks secrets from entering the repository at push time, before any CI run. This is a required control for production repositories.

### No Hardcoded Secrets Policy

The following must never appear in source control:

- Private keys or mnemonics (Stellar, SSH, PGP, etc.)
- API tokens or credentials (GitHub PATs, cloud keys, webhook secrets)
- Environment-specific secrets or connection strings

Config files under `config/` (`local.toml`, `testnet.toml`, `mainnet.toml`) contain **only non-secret, environment-specific parameters** (RPC URLs, contract IDs, network passphrases). Secret values must be injected at runtime via environment variables or a secrets manager and must never be committed.

If a secret is accidentally committed, treat it as compromised: rotate it immediately, then remove it from history using `git filter-repo` or BFG Repo Cleaner.

---

## Access Permission Review

### Cadence

Repository access permissions must be reviewed **quarterly** (every 3 months). The review is owned by the repository admin.

### Review Checklist

For each review cycle:

- [ ] List all collaborators and teams with write or admin access (`Settings → Collaborators and teams`).
- [ ] Remove or downgrade access for anyone who no longer actively contributes.
- [ ] Verify that branch protection rules are still in place on `main` (require PR, require status checks, dismiss stale reviews).
- [ ] Audit GitHub Actions secrets (`Settings → Secrets and variables → Actions`): remove unused secrets, rotate any that are older than 6 months.
- [ ] Review third-party OAuth apps and GitHub Apps connected to the repository (`Settings → Integrations`): revoke apps that are no longer needed.
- [ ] Confirm CodeQL and Gitleaks CI jobs are still active and passing.

### Principle of Least Privilege

- Contributors should have **write** access at most; **admin** should be restricted to maintainers.
- Automation (bots, CI tokens) should use fine-grained Personal Access Tokens scoped to the minimum required permissions and a short expiry.
- GitHub Actions workflows use `GITHUB_TOKEN` where possible rather than long-lived PATs.

### Escalation

If a review uncovers an unauthorised access grant or a leaked credential, notify the repository admin immediately and follow the incident response steps in [SECURITY.md](../../SECURITY.md).

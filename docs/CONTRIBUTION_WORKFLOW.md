# Contribution Workflow and Branching Policy

This document describes how contributors should branch, open pull requests, apply labels, and get work merged into VoteChain. For the full contributor guide see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Branch Naming Conventions

All work happens in short-lived topic branches that target `main`. Branch names must follow this pattern:

```
<prefix>/<short-kebab-description>
```

| Prefix | When to use | Example |
|--------|------------|---------|
| `feature/` | New functionality or contract function | `feature/vote-delegation` |
| `fix/` | Bug fixes | `fix/double-vote-edge-case` |
| `docs/` | Documentation-only changes | `docs/add-lifecycle-diagram` |
| `test/` | New or improved tests | `test/quorum-boundary-cases` |
| `chore/` | Maintenance, CI, tooling, dependencies | `chore/bump-soroban-sdk-22` |
| `security/` | Security fixes or hardening | `security/reinit-guard` |
| `refactor/` | Code restructuring without behaviour change | `refactor/storage-helpers` |

**Rules:**

- Branch from the latest `main` (`git checkout -b <branch> main`).
- One logical change per branch — keep scope focused.
- Use lowercase letters, numbers, and hyphens only (no spaces or slashes beyond the prefix separator).
- Delete the branch after it is merged. GitHub can be configured to do this automatically.
- Direct commits to `main` are blocked by branch protection. All changes must go through a PR.

---

## Opening a Pull Request

### Step-by-step

1. Push your branch to the remote:
   ```bash
   git push -u origin <branch-name>
   ```

2. Open a PR on GitHub targeting `main`.

3. Fill in the PR template:
   - **Title** — concise imperative summary, ≤ 70 characters (e.g. `feat: add vote delegation to governance contract`).
   - **Description** — explain *why* the change is needed, not just what was changed.
   - **Linked issue** — reference the issue this PR closes (e.g. `Closes #42`).
   - **Checklist** — tick every box or explain why an item does not apply.

4. Apply the appropriate labels (see [Label Usage](#label-usage) below).

5. Open as a **draft PR** if the implementation is not yet complete but you want early design feedback.

6. Mark the PR **ready for review** once:
   - All CI status checks are green.
   - The PR checklist is complete.
   - Self-review is done (read your own diff).

### PR checklist

- [ ] `make fmt` run locally (no formatting diff)
- [ ] `make test` passes
- [ ] `make lint` passes (no Clippy warnings)
- [ ] Events emitted for every state-changing operation
- [ ] New public functions have at least one test
- [ ] `README.md` updated if observable behaviour changed
- [ ] `CHANGELOG.md` `[Unreleased]` section updated for user-visible changes

---

## Review and Merge Process

### Review requirements

| Rule | Detail |
|------|--------|
| Required approvals | At least **1** approving review from a maintainer |
| Stale review dismissal | Approval is invalidated when new commits are pushed |
| CI must pass | `test`, `fmt-check`, `lint`, and `audit` jobs must all be green |
| Up-to-date branch | Branch must be up to date with `main` before merge |

### Review etiquette

**Authors:**
- Annotate non-obvious decisions with inline PR comments so reviewers don't have to reverse-engineer intent.
- Respond to review comments promptly. Mark threads resolved once addressed by a code change.
- Do not force-push after requesting review — it invalidates in-progress review comments.

**Reviewers:**
- Distinguish **blocking** concerns (must fix before merge) from **suggestions** (nice to have).
- Check: correct logic, tests present, events emitted, `no_std` preserved, no floating-point arithmetic.
- Approve once all blocking concerns are resolved; do not hold a merge over optional style preferences.

### Merge strategy

- **Squash and merge** is the default for feature and fix branches — keeps `main` history linear.
- **Merge commit** may be used for long-running branches where individual commit history matters (agree with maintainers first).
- Rebase is used only to bring a branch up to date with `main` before merging.
- Force-pushes to `main` are disabled.

---

## Label Usage

Labels categorise issues and PRs to make triage and filtering easier. Apply labels when opening an issue or PR.

### Type labels

| Label | Colour | When to apply |
|-------|--------|--------------|
| `type: feature` | `#0075ca` | New functionality |
| `type: bug` | `#d73a4a` | Something is broken |
| `type: docs` | `#0052cc` | Documentation changes only |
| `type: test` | `#e4e669` | New or improved tests |
| `type: chore` | `#e4e669` | Maintenance, CI, tooling |
| `type: security` | `#b60205` | Security fix or hardening |
| `type: refactor` | `#cfd3d7` | Code restructuring, no behaviour change |

### Priority labels

| Label | Colour | Meaning |
|-------|--------|---------|
| `priority: critical` | `#b60205` | Blocks a release or causes data loss |
| `priority: high` | `#e99695` | Should be addressed in the current cycle |
| `priority: medium` | `#f9d0c4` | Normal priority |
| `priority: low` | `#fef2c0` | Nice to have, no urgency |

### Status labels

| Label | Colour | Meaning |
|-------|--------|---------|
| `status: needs-triage` | `#e4e669` | Newly opened, not yet reviewed by a maintainer |
| `status: in-progress` | `#0075ca` | Actively being worked on |
| `status: blocked` | `#d93f0b` | Cannot proceed — waiting on a dependency or decision |
| `status: needs-review` | `#0052cc` | PR is ready for maintainer review |
| `status: wont-fix` | `#cfd3d7` | Acknowledged but out of scope or intentionally not fixed |

### Area labels

| Label | Colour | Meaning |
|-------|--------|---------|
| `area: governance` | `#c2e0c6` | Governance contract |
| `area: token` | `#bfd4f2` | Token contract |
| `area: ci` | `#f9d0c4` | CI/CD and GitHub Actions |
| `area: docs` | `#d4c5f9` | Documentation |
| `area: security` | `#b60205` | Security-related work |

### Applying labels

- Any contributor may apply type, priority, and area labels to their own issues and PRs.
- Maintainers apply and adjust `status:` labels during triage.
- A PR should have at least one `type:` label and one `area:` label.
- An issue should have at least one `type:` label and a `priority:` label after triage.

---

## Quick Reference for New Contributors

```
1. git checkout main && git pull
2. git checkout -b <prefix>/<description>
3. ... make changes ...
4. make fmt && make test && make lint
5. git commit -m "<type>(<scope>): <summary>"
6. git push -u origin <branch>
7. Open PR → fill template → add labels → mark ready for review
8. Address review feedback
9. Maintainer approves + merges
10. Delete your branch
```

For detailed commit message guidelines and changelog requirements see [CONTRIBUTING.md](../CONTRIBUTING.md).

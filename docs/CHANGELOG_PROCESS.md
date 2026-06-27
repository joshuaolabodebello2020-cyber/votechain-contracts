# Changelog Process

This document explains how contributors add changelog entries, how releases are cut, and how commit and PR labels align with changelog requirements.

## Daily Contribution

Every PR that changes observable behaviour must include a changelog entry under `## [Unreleased]` in `CHANGELOG.md`.

### Which changes need an entry?

| Change type | Needs entry? |
|-------------|-------------|
| New feature or function | Yes — `Added` |
| Behaviour change | Yes — `Changed` |
| Deprecation | Yes — `Deprecated` |
| Removal | Yes — `Removed` |
| Bug fix | Yes — `Fixed` |
| Security fix | Yes — `Security` |
| Internal refactor (no observable change) | No |
| Test-only change | No |
| CI/tooling update | No |

### Format

```
## [Unreleased]

### Added
- Short imperative description of the change. ([#<issue>](https://github.com/Vera3289/votechain-contracts/issues/<issue>))
```

Rules:
- Imperative mood: "Add", "Fix", "Remove" — not "Added" or "Fixes".
- One bullet per logical change.
- Link the issue or PR at the end of the line.
- Keep it to one or two sentences.

## Commit and PR Labels

Commit messages use a type prefix that maps directly to changelog sections:

| Commit type | Changelog section |
|-------------|------------------|
| `feat:` | Added |
| `fix:` | Fixed |
| `security:` | Security |
| `refactor:` | (no entry) |
| `docs:` | (no entry unless it adds user-facing docs) |
| `test:` | (no entry) |
| `ci:` | (no entry) |
| `chore:` | (no entry) |

PR labels (applied by maintainers) mirror the same convention and are used by the release workflow to categorise entries automatically.

## Release Process

1. Create a release PR from `main` titled `Release vX.Y.Z`.
2. Move all entries from `## [Unreleased]` to a new versioned heading:
   ```
   ## [X.Y.Z] - YYYY-MM-DD
   ```
3. Update the comparison links at the bottom of `CHANGELOG.md`:
   ```
   [Unreleased]: https://github.com/Vera3289/votechain-contracts/compare/vX.Y.Z...HEAD
   [X.Y.Z]: https://github.com/Vera3289/votechain-contracts/compare/vX.Y.(Z-1)...vX.Y.Z
   ```
4. Tag the release: `git tag vX.Y.Z && git push origin vX.Y.Z`
5. The release workflow (`.github/workflows/release.yml`) publishes WASM artifacts to GitHub Releases automatically.
6. Copy the release notes from `CHANGELOG.md` into the GitHub Release description using the template below.

## Release Note Template

See `docs/RELEASE_TEMPLATE.md` for the GitHub Release description template.

## Automated Checks

The changelog workflow (`.github/workflows/changelog.yml`) checks that every PR targeting `main` includes a changelog entry. If your PR intentionally skips an entry (refactor, test-only, CI), add the label `skip-changelog` to bypass the check.

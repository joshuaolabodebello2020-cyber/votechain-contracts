# Release Tagging & Semantic Versioning Policy

This document defines how releases are tagged and versions are managed across VoteChain repositories.

---

## Versioning Scheme

VoteChain follows [Semantic Versioning 2.0.0](https://semver.org/):

```
vMAJOR.MINOR.PATCH
```

| Component | When to increment |
|-----------|-------------------|
| **MAJOR** | Breaking changes to contract interfaces, storage layout migrations, or API-incompatible changes that require consumer updates. |
| **MINOR** | New features, new contract functions, or new API endpoints that are backward-compatible. |
| **PATCH** | Bug fixes, documentation updates, performance improvements, and CI changes with no interface impact. |

**Examples:**

- `v1.0.0 → v2.0.0` — `create_proposal()` signature changes (breaking).
- `v1.0.0 → v1.1.0` — New `get_vote_history()` function added (backward-compatible feature).
- `v1.1.0 → v1.1.1` — Fix quorum rounding edge case (bug fix).

---

## Tagging Process

### Automatic Patch Tags

The `tag.yml` workflow automatically creates a patch version tag on every push to `main`. It finds the latest `v*.*.*` tag and increments the patch number.

- First ever tag: `v0.1.0`
- Subsequent pushes: `v0.1.1`, `v0.1.2`, etc.

### Manual Minor and Major Tags

For minor or major releases, maintainers create the tag manually:

```bash
git tag v1.2.0
git push origin v1.2.0
```

This triggers the `release.yml` workflow, which builds WASM artifacts, generates checksums, and publishes the release.

### Pre-release Tags

For release candidates and pre-releases, use a hyphenated suffix:

```bash
git tag v1.2.0-rc.1
git push origin v1.2.0-rc.1
```

Pre-release tags do not trigger the release workflow by default.

---

## Per-Component Versioning

| Component | Version Source | Notes |
|-----------|--------------|-------|
| **Contracts** | Git tag (`v*.*.*`) | The canonical version. WASM artifacts are tagged with this version. |
| **Frontend** | `frontend/package.json` | Should match the latest compatible contract version. |
| **Backend** | `backend/package.json` | Should match the latest compatible API version. |
| **SDK** | `sdk/package.json` | Published to npm as `@votechain/sdk@<version>`. Must stay compatible with the deployed contract. |
| **API spec** | `api/openapi.yaml` `info.version` | Tracks the backend API version. |

### Keeping Versions in Sync

When cutting a minor or major release:

1. Update `Cargo.toml` version fields for contracts.
2. Update `package.json` version fields for frontend, backend, and SDK.
3. Update `api/openapi.yaml` `info.version`.
4. Add a `## [vX.Y.Z]` section to `CHANGELOG.md` (see [Changelog Process](CHANGELOG_PROCESS.md)).
5. Commit with message: `release: vX.Y.Z`.
6. Tag and push.

---

## Release Artifacts

Each tagged release (`v*.*.*`) produces:

| Artifact | Location |
|----------|----------|
| `votechain_governance.wasm` | GitHub Release assets |
| `votechain_token.wasm` | GitHub Release assets |
| `SHA256SUMS.txt` | GitHub Release assets |
| TypeScript SDK bindings | `sdk/governance/`, `sdk/token/` |
| GitHub Actions artifact | Retained for 90 days |

---

## Compatibility Matrix

Consumers can determine compatible releases using this convention:

| Contract Version | Compatible SDK | Compatible Frontend | Compatible Backend |
|-----------------|----------------|--------------------|--------------------|
| `v1.x.x` | `@votechain/sdk@1.x.x` | `frontend@1.x.x` | `backend@1.x.x` |
| `v2.x.x` | `@votechain/sdk@2.x.x` | `frontend@2.x.x` | `backend@2.x.x` |

**Rule:** Components sharing the same MAJOR version are compatible. A MAJOR bump in contracts requires a corresponding MAJOR bump in all consumers.

---

## CI Integration

- **`tag.yml`** — Runs on every push to `main`. Auto-increments patch version.
- **`release.yml`** — Runs on any `v*` tag push. Builds WASM, generates checksums, publishes release.
- **`merge-gate.yml`** — Blocks merges that would break semver (e.g., removing a public function without a MAJOR bump). Relies on changelog labels.

---

## Checklist for Cutting a Release

- [ ] All tests pass on `main` (`make test`)
- [ ] `CHANGELOG.md` has a `## [vX.Y.Z]` section with all changes
- [ ] Version fields updated in `Cargo.toml`, `package.json` files, and `openapi.yaml`
- [ ] Tag created and pushed: `git tag vX.Y.Z && git push origin vX.Y.Z`
- [ ] Release workflow completed successfully
- [ ] Release notes published on GitHub
- [ ] SDK published to npm (if applicable)

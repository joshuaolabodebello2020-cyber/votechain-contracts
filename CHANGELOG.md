# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Entry Format

Every entry belongs under a release heading and one of the following subsection types (omit types that have no entries):

```markdown
## [Unreleased]

### Added
- Short description of a new feature or function. ([#<issue>](https://github.com/Vera3289/votechain-contracts/issues/<issue>))

### Changed
- Short description of a change to existing behaviour.

### Deprecated
- Short description of a feature that will be removed in a future release.

### Removed
- Short description of a removed feature.

### Fixed
- Short description of a bug fix.

### Security
- Short description of a security fix or hardening measure.
```

> For the full contribution and release process see [docs/CHANGELOG_PROCESS.md](docs/CHANGELOG_PROCESS.md).

**Rules:**
- Use plain English, present tense, imperative mood: "Add", "Fix", "Remove".
- Each bullet is one logical change; keep it to one or two sentences.
- Link the related issue or PR at the end of the bullet: `([#42](...))`.
- Add entries to `[Unreleased]` as you work; they are moved to a versioned heading at release time.
- Do **not** document internal refactors or test-only changes unless they affect observable behaviour.

---

## [Unreleased]

### Added
- ADR-007: document vote delegation design decision (deferred). ([#273](https://github.com/Vera3289/votechain-contracts/issues/273))

## [0.1.0] - 2026-04-27

### Added

- Governance contract with `initialize`, `create_proposal`, `cast_vote`, `finalise`,
  `execute`, `cancel`, `get_proposal`, `has_voted`, and `proposal_count`
- `update_quorum` — admin function to adjust the quorum threshold on an active proposal
- `get_version` on both contracts returning a `(major, minor, patch)` semver tuple
- Token contract with `initialize`, `transfer`, `approve`, `transfer_from`, `mint`,
  `burn`, `total_supply`, and `balance`
- Three-way voting model: Yes / No / Abstain
- Token-weighted voting using the voter's live on-chain balance at vote time (no snapshots)
- Double-vote prevention via persistent `HasVoted(proposal_id, voter)` storage key
- Proposal lifecycle: Active → Passed / Rejected → Executed, or Active → Cancelled
- On-chain events for all state transitions: `created`, `vote`, `final`, `qupdate`
- `ContractError` enum with 14 typed revert conditions and `#[contracterror]`
- `VoteTallyOverflow` protection using `checked_add` on all vote accumulators
- Spam prevention: configurable minimum proposer token balance and per-address
  proposal cooldown at initialisation time
- Re-initialisation guard — `AlreadyInitialized` error on any duplicate `initialize` call
- Makefile targets: `build`, `test`, `fmt`, `fmt-check`, `lint`, `clean`, `deploy-testnet`
- Docker Compose development environment with a local Stellar node (Soroban RPC)
- GitHub Actions CI: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`,
  `cargo audit`, WASM build, and binary-size enforcement (governance ≤ 100 KB, token ≤ 50 KB)
- WASM validity smoke-test workflow (`scripts/test_wasm.sh`)
- Automated semver patch-bump tagging on every push to `main`
- Release workflow publishing WASM artifacts to GitHub Releases
- Environment config files (`config/local.toml`, `config/testnet.toml`, `config/mainnet.toml`)
- Deploy scripts (`scripts/deploy.sh`, `scripts/deploy_mainnet.sh`)
- Property-based tests (`prop_tests.rs`) and deterministic test snapshots
- Architecture Decision Records: ADR-001 through ADR-005
- Documentation: lifecycle state diagram, FAQ, upgrading guide, error reference,
  getting-started guide, roadmap
- Security documentation: threat model, audit scope, known-issues register,
  `SECURITY.md` responsible-disclosure policy, and `AUDIT.md` checklist
- `cargo doc` API documentation for every public function in both contracts
- `CONTRIBUTING.md` development guide
- `CHANGELOG.md` following Keep a Changelog format with automated release updates

[Unreleased]: https://github.com/Vera3289/votechain-contracts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Vera3289/votechain-contracts/releases/tag/v0.1.0

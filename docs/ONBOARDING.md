# Contributor Onboarding Guide

Welcome to VoteChain! This guide gets you from zero to your first pull request.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21.6.0 (pinned) | `cargo install --locked stellar-cli@21.6.0 --features opt` |
| Docker (optional) | 20+ | [docs.docker.com](https://docs.docker.com/get-docker/) |

Verify your setup:
```bash
rustc --version          # rustc 1.75.0 or later
stellar --version        # 21.6.0
rustup target list | grep wasm32-unknown-unknown  # installed
```

---

## Repo Structure

```
votechain-contracts/
├── contracts/
│   ├── governance/src/
│   │   ├── lib.rs           # Contract entry points
│   │   ├── types.rs         # Error types, Vote, Proposal structs
│   │   ├── storage.rs       # Storage key definitions and accessors
│   │   ├── events.rs        # Event emission helpers
│   │   ├── test.rs          # Unit tests (40+ tests)
│   │   ├── test_helpers.rs  # setup_env(), create_test_proposal(), mint_and_vote()
│   │   └── prop_tests.rs    # Property-based tests (proptest)
│   └── token/src/           # SEP-41 governance token contract
├── docs/                    # Architecture docs, ADRs, FAQ, examples
├── .github/workflows/       # CI pipeline (ci.yml)
├── Makefile                 # Common dev commands
└── CONTRIBUTING.md          # Code style and PR process
```

Key files to read first:
1. `contracts/governance/src/lib.rs` — all public contract functions
2. `contracts/governance/src/types.rs` — `ContractError`, `Vote`, `Proposal`, `ProposalState`
3. `contracts/governance/src/test_helpers.rs` — reusable test utilities

---

## Running Tests

```bash
# Run all tests
make test

# Run with stdout (useful for debugging)
cargo test -- --nocapture

# Run a single test by name
cargo test test_create_proposal -- --nocapture

# Run only governance contract tests
cargo test -p votechain-governance

# Run property-based tests
cargo test prop_
```

The test suite uses `soroban-sdk`'s built-in test environment (`Env::default()` + `mock_all_auths()`). No running node is required.

### Writing a new test

Use the helpers in `test_helpers.rs`:

```rust
#[test]
fn test_my_feature() {
    let t = setup_env();                                      // deploy + init both contracts
    let proposal_id = create_test_proposal(&t, &t.admin.clone());
    mint_and_vote(&t, &Address::generate(&t.env), proposal_id, Vote::Yes, 1_000);
    // assert ...
}
```

---

## Development Workflow

```bash
# Format code
make fmt

# Lint (must pass with zero warnings)
make lint

# Build WASM binaries
make build

# Full check before opening a PR
make fmt && make lint && make test
```

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/proposal-cooldown` |
| Bug fix | `fix/<issue-id>-<description>` | `fix/123-double-vote` |
| Test | `test/<issue-id>-<description>` | `test/294-concurrent-voting` |
| Docs | `docs/<issue-id>-<description>` | `docs/286-onboarding` |
| CI/DevOps | `ci/<description>` or `fix/<id>-<description>` | `fix/267-rust-cache` |

---

## Code Review Expectations

- **All CI checks must pass** before a review is requested (format, lint, tests, license headers).
- **Every new function needs a test.** Bug fixes should include a regression test.
- **Keep PRs focused.** One logical change per PR. Split unrelated changes into separate PRs.
- **Commit messages** follow the format: `type: short description (#issue-id)`. Types: `feat`, `fix`, `test`, `docs`, `ci`, `refactor`.
- **License header** — every new `.rs` file must start with the Apache 2.0 header (copy from any existing file).
- Reviewers aim to respond within **2 business days**. Address all comments before re-requesting review.

---

## Good First Issues

Look for issues labelled [`good first issue`](https://github.com/Vera3289/votechain-contracts/issues?q=is%3Aopen+label%3A%22good+first+issue%22) on GitHub. Typical starter tasks:

- **Documentation** — expand FAQ entries, fix typos, add code examples
- **Tests** — add edge-case tests for existing contract functions using `test_helpers.rs`
- **Error messages** — improve error variants in `types.rs` with clearer names or docs
- **Makefile targets** — add convenience targets (e.g., `make test-governance`)

Before starting, comment on the issue to let maintainers know you're working on it.

---

## Getting Help

- **GitHub Discussions** — ask questions, propose ideas
- **GitHub Issues** — report bugs or request features
- **Code comments** — inline `// SAFETY:` and `// INVARIANT:` comments explain non-obvious decisions
- **ADRs** — `docs/adr/` explains every major architectural decision with context and trade-offs

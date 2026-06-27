# Testing Guide

This document describes VoteChain's testing strategy, the responsibilities of each test layer, how to run tests locally, what CI enforces, and how to set up the test environment.

---

## Testing Strategy Overview

VoteChain uses a layered testing approach. Each layer has a specific responsibility; together they provide confidence that the contracts behave correctly from individual logic all the way through realistic end-to-end scenarios.

| Layer | Location | Responsibility |
|-------|----------|---------------|
| Unit tests | `contracts/*/src/test.rs` | Verify individual functions and error paths in isolation |
| Integration tests | `contracts/governance/src/integration_tests.rs` | Verify full proposal lifecycle end-to-end against compiled WASM |
| Property-based tests | `contracts/governance/src/prop_tests.rs` | Assert invariants hold across randomly generated inputs |
| Storage TTL tests | `contracts/governance/src/test_ttl.rs` | Verify persistent storage entries are TTL-bumped correctly |
| Load tests | `contracts/governance/src/load_tests.rs` | Verify arithmetic and storage correctness under high volume |

All test layers run inside the Soroban SDK test environment (`soroban_sdk::testutils`) — an in-process Stellar emulator. No live network is required.

---

## Test Environment Setup

### Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Rust (stable) | 1.75+ | Compiler and test runner |
| `wasm32-unknown-unknown` target | — | Required for `soroban-sdk` compilation |
| `proptest` | 1.6.0 | Property-based test generation (already in `Cargo.toml`) |

### Installing dependencies

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM target
rustup target add wasm32-unknown-unknown
```

No external services (databases, nodes, Docker) are needed to run the test suite. The Soroban test environment is entirely in-process.

### Optional: Docker

For a fully reproducible environment without a local Rust installation:

```bash
docker compose run --rm dev make test
```

---

## Running Tests

### Run the full test suite

```bash
make test
# equivalent to: cargo test
```

### Run tests for a specific contract

```bash
cargo test -p votechain-governance
cargo test -p votechain-token
```

### Run a specific test by name

```bash
cargo test test_create_proposal
cargo test test_cast_vote_and_finalise_passed
```

### Run tests with console output

```bash
cargo test -- --nocapture
```

### Run only property-based tests

```bash
cargo test prop_
```

### Run only integration tests

```bash
cargo test -p votechain-governance integration
```

### Run only load tests

```bash
cargo test -p votechain-governance load
```

### Run with a single thread (useful for snapshot tests)

```bash
cargo test -- --test-threads=1 --nocapture
```

---

## Test Layers

### Unit tests

**Files:** `contracts/governance/src/test.rs` (~3 200 lines, 40+ tests), `contracts/token/src/test.rs` (~570 lines, 20+ tests)

**What they cover:**

*Governance contract:*
- Initialization and re-initialization guard
- Proposal creation — valid inputs, validation errors (`InvalidTitle`, `InvalidDescription`, `InvalidQuorum`, `InvalidDurationRange`, `InsufficientBalance`, `ProposalCooldown`)
- Voting — yes/no/abstain vote paths, double-vote prevention, zero-balance rejection, admin vote restriction
- Vote weight snapshots — balance captured at vote time
- Finalization — passed/rejected outcomes, quorum boundary conditions, ties
- Admin operations — execute, cancel, update quorum, pause/unpause, transfer admin
- Access control — all `NotAdmin` error paths
- Contract pause — state-changing operations rejected when paused, read-only operations allowed

*Token contract:*
- Initialization and supply management
- Transfers — valid, insufficient balance, self-transfer
- `transfer_from` — allowance enforcement
- Mint and burn — admin-only, amount validation
- Allowances — approve and overwrite
- Event emission

**Running unit tests:**

```bash
cargo test -p votechain-governance
cargo test -p votechain-token
```

---

### Integration tests

**File:** `contracts/governance/src/integration_tests.rs`

**What they cover:**

These tests register the compiled contract in the Soroban test environment (`env.register()`) and walk through the three required end-to-end scenarios:

1. `create → vote → finalise as Passed → execute`
2. `create → vote → finalise as Rejected`
3. `create → vote (mid-vote) → cancel`

Each scenario crosses the full contract boundary: the governance contract calls into the token contract to read balances, mimicking production behaviour.

**Running integration tests:**

```bash
cargo test -p votechain-governance integration
```

---

### Property-based tests

**File:** `contracts/governance/src/prop_tests.rs`

**What they cover:**

Uses `proptest` to generate random vote tallies and verify that the pass/reject formula is always evaluated correctly:

- `total_votes >= quorum AND votes_yes > votes_no` → Passed
- Any other combination → Rejected
- Arithmetic invariants hold regardless of the magnitude of individual vote weights
- Contract-level properties (`AC-1`, `AC-2`, `AC-3`) verified end-to-end in the Soroban environment

The `MAX_SUPPLY` constant (`i128::MAX / 4`) caps generated values to a realistic range and prevents `i128` overflow.

**Running property-based tests:**

```bash
cargo test prop_
```

To increase the number of generated cases (default is 256):

```bash
PROPTEST_CASES=1000 cargo test prop_
```

---

### Storage TTL tests

**File:** `contracts/governance/src/test_ttl.rs`

**What they cover:**

Soroban persistent storage entries expire if their TTL is not bumped. These tests verify that:

- Proposal, vote, and vote-record entries have their TTL extended on every read/write
- Entries survive the expected number of ledgers
- Read-only operations do not cause unnecessary TTL bumps

**Running TTL tests:**

```bash
cargo test -p votechain-governance ttl
```

---

### Load tests

**File:** `contracts/governance/src/load_tests.rs`

**What they cover:**

- 1 000 sequential proposal creations — verifies counter integrity and absence of storage key collisions at scale
- 10 000 votes across a single proposal — verifies tally arithmetic and double-vote prevention under high voter counts

Because the Soroban test environment runs entirely in-process, these tests complete in milliseconds.

**Running load tests:**

```bash
cargo test -p votechain-governance load
```

---

## Test Helpers

**File:** `contracts/governance/src/test_helpers.rs`

Shared utilities used across all governance test files:

```rust
use test_helpers::*;

#[test]
fn example() {
    let env = Env::default();
    // Set up governance + token contracts, admin, and a voter in one call
    let (governance, token, admin, voter) = setup_env(&env);

    // Create a proposal with sensible defaults
    let proposal_id = create_test_proposal(&env, &governance, &admin);

    // Mint tokens to voter and cast a vote
    mint_and_vote(&env, &token, &governance, &voter, proposal_id, Vote::Yes);
}
```

Use `test_helpers` instead of duplicating boilerplate. If a new setup pattern is needed by multiple tests, add it to `test_helpers.rs`.

---

## Coverage

### Coverage threshold

CI enforces an **80% line coverage minimum** for each contract package. A build that drops below this threshold fails.

### Generating a coverage report locally

Install `cargo-llvm-cov`:

```bash
cargo install --locked cargo-llvm-cov
```

Generate an HTML report:

```bash
cargo llvm-cov --all-features --workspace --html --output-dir coverage/
open coverage/index.html
```

Generate an LCOV report (consumed by CI):

```bash
cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info
```

Check per-package coverage summary:

```bash
cargo llvm-cov --package votechain-governance --all-features --summary-only
cargo llvm-cov --package votechain-token     --all-features --summary-only
```

---

## CI Integration

All test jobs are defined in `.github/workflows/ci.yml` and run on every push to `main`/`develop` and on every pull request targeting those branches.

### CI jobs

| Job | Command | What it checks |
|-----|---------|---------------|
| `test` | `cargo test` | Full test suite passes |
| `fmt-check` | `cargo fmt --check` | Code is formatted |
| `lint` | `cargo clippy --all-targets -- -D warnings` | No Clippy warnings |
| `coverage` | `cargo llvm-cov` | ≥ 80% line coverage per package |
| `security-audit` | `cargo audit --deny warnings` | Zero known advisories |
| `build-wasm` | `stellar contract build` | WASM compiles; governance ≤ 100 KB, token ≤ 50 KB |
| `wasm-validity` | `bash scripts/test_wasm.sh` | WASM binaries are structurally valid |

### CI requirements for merging

A pull request cannot be merged into `main` until **all** of these jobs are green:

- `test`
- `fmt-check`
- `lint`
- `security-audit`

The `coverage`, `build-wasm`, and `wasm-validity` jobs provide additional signal but are informational in the current configuration.

---

## Writing New Tests

### Rules

- Every new public function in either contract requires at least one test in `test.rs`.
- Every bug fix must include a regression test that would have caught the bug.
- Use `test_helpers.rs` for shared setup — do not duplicate boilerplate.
- Tests must not use floating-point arithmetic or `std` — the contracts are `no_std`.
- Use `env.mock_all_auths()` in unit tests to avoid authorization boilerplate unless the test is specifically checking auth behaviour.

### Test naming convention

```
test_<function_name>_<scenario>

Examples:
  test_create_proposal_invalid_title
  test_cast_vote_double_vote_rejected
  test_finalise_passed_meets_quorum
  test_cancel_not_admin
```

### Example unit test

```rust
#[test]
fn test_create_proposal_duration_too_short() {
    let env = Env::default();
    env.mock_all_auths();
    let (gov, _token, admin, _voter) = setup_env(&env);

    let result = gov.try_create_proposal(
        &admin,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &1_000_000,
        &59,   // below minimum of 60 seconds
    );

    assert_eq!(result, Err(Ok(ContractError::InvalidDurationRange)));
}
```

### Example property-based test

```rust
proptest! {
    #[test]
    fn prop_pass_requires_quorum_met(
        yes in 0i128..MAX_SUPPLY,
        no  in 0i128..MAX_SUPPLY,
        abs in 0i128..MAX_SUPPLY,
        q   in 1i128..MAX_SUPPLY,
    ) {
        let total = yes.saturating_add(no).saturating_add(abs);
        let should_pass = total >= q && yes > no;
        // ... verify against contract logic
        prop_assert_eq!(result_passed, should_pass);
    }
}
```

---

## Test Snapshots

Regression snapshots are stored in `contracts/*/test_snapshots/` and capture the serialised output of key contract calls. They guard against unintentional changes to on-chain data formats.

To update snapshots after an intentional change:

```bash
cargo test -- --test-threads=1 --nocapture
```

Commit updated snapshot files alongside the code change. A snapshot diff in a PR signals a potentially breaking change to stored data formats — reviewers should scrutinise it carefully.

---

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution guidelines including test requirements
- [GETTING_STARTED.md](GETTING_STARTED.md) — environment setup
- [Supported Networks](supported-networks.md) — CLI version and network configuration
- [Storage Model](storage.md) — persistent storage and TTL strategy
- [Errors](errors.md) — complete `ContractError` reference

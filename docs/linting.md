# Lint Rules

VoteChain enforces strict compile-time linting so that common bugs are caught
before code reaches review.

## Quick start

```bash
# Must pass with zero warnings before pushing
cargo clippy --workspace -- -D warnings
```

## Where rules live

| File | What it controls |
|---|---|
| `Cargo.toml` `[workspace.lints.*]` | Rust and Clippy lint levels (deny / warn) |
| `.clippy.toml` | Numeric thresholds (complexity, arg count) |
| Each crate's `Cargo.toml` `[lints] workspace = true` | Inherits workspace rules |

## Denied lints (build-breaking)

### Rust compiler

- **`unsafe_code`** — no `unsafe` blocks in contracts.
- **`unused_must_use`** — `Result` values must be handled.
- **`unused_imports`** — dead imports are not allowed.
- **`unreachable_patterns`** — every match arm must be reachable.

### Clippy

- **`enum_glob_use`** — always qualify enum variants (`Vote::Yes`, not `Yes`).
- **`cast_possible_truncation`** / **`cast_sign_loss`** / **`cast_possible_wrap`** — explicit casts that silently lose data are denied. Use `try_into()` or `checked_*` instead.
- **`integer_arithmetic`** — bare `+`, `-`, `*`, `/` on integers is denied. Use `checked_add`, `saturating_sub`, etc.
- **`unwrap_used`** / **`expect_used`** / **`panic`** — never panic in contract code; return `ContractError` instead.

### Clippy (warnings)

- **`needless_pass_by_value`** — prefer `&T` when ownership isn't needed.
- **`redundant_closure_for_method_calls`** — simplify `|x| x.foo()` to `T::foo`.
- **`manual_let_else`** — use `let … else { return }` pattern.
- **`cloned_instead_of_copied`** — use `.copied()` for `Copy` types.
- **`implicit_clone`** — prefer explicit `.clone()`.

## Thresholds (`.clippy.toml`)

| Threshold | Value | Effect |
|---|---|---|
| `cognitive-complexity-threshold` | 10 | Functions above this are flagged |
| `too-many-arguments-threshold` | 9 | Functions with more args are flagged |
| `enum-variant-size-threshold` | 200 | Large enum variants are flagged |

## CI enforcement

The merge-gate workflow runs `cargo clippy --workspace -- -D warnings`.
Any new violation fails the build.

## Suppressing a lint

If a specific lint is a false positive, suppress it at the narrowest scope:

```rust
#[allow(clippy::integer_arithmetic)] // SEC-007: counter is bounded by u64::MAX check above
let n = current + 1;
```

Always add a comment explaining *why* the suppression is safe.

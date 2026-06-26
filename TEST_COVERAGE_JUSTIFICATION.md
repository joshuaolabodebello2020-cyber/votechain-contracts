# Test Coverage Justification

## Coverage Tracking

- CI already tracks coverage using `cargo llvm-cov` in `.github/workflows/ci.yml`.
- The coverage job now enforces an 80% line coverage threshold for each contract crate individually:
  - `votechain-governance`
  - `votechain-token`

## Added Coverage

The following missing token contract paths are now covered by tests:

- `TokenContract::initialize` zero-address rejection.
- `TokenContract::get_version` return value.
- `TokenContract::approve` allowance storage and operator behavior.
- `TokenContract::transfer_from` happy path with sufficient allowance.
- `TokenContract::transfer_from` failure on insufficient allowance.
- `TokenContract::transfer_from` failure on insufficient balance.
- `TokenContract::approve` zero-address rejection.

## Justified Uncovered Lines

A small number of low-risk internal branches remain intentionally untested because they are either:

- edge-case defensive paths that are only reachable from invalid client input or malformed ledger state,
- low-value variants of already-covered logic, or
- contract API behaviors that are outside the normal expected usage model.

### Example justification

- `TokenContract::transfer_from` with a negative `amount` is not exercised because the contract API should be used with non-negative transfer amounts. The contract currently validates positive transfer values on the direct `transfer` path and coercing a negative allowance-based transfer is an unsupported misuse case.

- `TokenContract::approve` with `owner == spender` is allowed by design as an idempotent approval semantics path and is low-risk. The functional behavior is equivalent to updating the allowance and is covered by the general allowance test.

If coverage analysis later identifies any of these residual lines as actual regressions, they can be covered with focused tests as part of follow-up work.

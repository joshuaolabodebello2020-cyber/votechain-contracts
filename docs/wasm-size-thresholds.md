# WASM Binary Size Thresholds

## Enforced Limits

| Contract | File | Limit | Rationale |
| --- | --- | --- | --- |
| Governance | `votechain_governance.wasm` | **100 KB** | Governance logic is inherently more complex (proposals, voting, quorum, lifecycle state machine). 100 KB provides headroom for future features while guarding against unintentional bloat. |
| Token | `votechain_token.wasm` | **50 KB** | Token contract is intentionally minimal (transfer, mint, burn, allowance). 50 KB is generous for this surface area; a significantly larger binary signals unnecessary dependencies have been introduced. |

CI enforces these limits in the `build-wasm` job. A build that exceeds either threshold will fail with an error annotation pointing to the contract source file.

## Size History

Every CI run that passes the WASM build step uploads a `wasm-size-history` artifact containing a timestamped append-only log (`sizes.log`). Download this artifact from the GitHub Actions run page to track binary size trends over time.

## Regression Response

When a PR causes a size regression:

1. **Diagnose** — run `stellar contract build` locally and compare the new size against the limits above.
2. **Inspect new dependencies** — `cargo tree -p votechain-governance` or `cargo tree -p votechain-token` to identify newly pulled-in crates.
3. **Reduce or justify** — remove unnecessary features/crates, or open a PR updating the threshold with a written justification.

## Updating a Threshold

Thresholds should only be raised when:
- A deliberate feature addition genuinely requires the space, **and**
- The change has been reviewed and merged to `main`.

To raise a threshold, update both:
- The shell variables `GOV_LIMIT` / `TOK_LIMIT` in `.github/workflows/ci.yml` (`build-wasm` job), and
- The table above.

Include the rationale in the commit message.

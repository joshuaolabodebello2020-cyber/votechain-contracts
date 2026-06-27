# Performance Benchmarks

Automated benchmarks for the VoteChain governance contract and backend API.

---

## How to run locally

### Contract benchmarks (Criterion)

```bash
# Run all benchmarks
cargo bench -p votechain-governance

# Save a named baseline (e.g. on a clean main checkout)
cargo bench -p votechain-governance -- --save-baseline main

# Compare future runs against that baseline
cargo bench -p votechain-governance -- --baseline main
```

HTML reports are written to `target/criterion/` and can be opened in a browser.

### API benchmarks

The backend server must be running first.

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2 — run benchmark only
cd backend && npm run bench

# Run benchmark then check against thresholds
cd backend && npm run bench:check
```

Environment variables for `backend/bench/api-bench.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001` | Backend base URL |
| `ITERATIONS` | `50` | Requests per endpoint |
| `CONCURRENCY` | `1` | Parallel requests per batch |
| `OUT_FILE` | `perf/api-results.json` | Path for JSON results |

---

## Baseline expectations

### API endpoints (stub mode, GitHub-hosted runner)

| Endpoint | p95 target |
|----------|-----------|
| `GET /api/proposals` | ≤ 200 ms |
| `GET /api/proposals/:id` | ≤ 100 ms |
| `GET /api/governance/stats` | ≤ 200 ms |
| `GET /metrics/cache` | ≤ 50 ms |

These will need updating once the backend is connected to live Stellar RPC calls.

### Contract operations (Soroban in-process)

| Operation | p99 target |
|-----------|-----------|
| `create_proposal` | ≤ 5 ms |
| `cast_vote` | ≤ 5 ms |
| `finalise` | ≤ 5 ms |

---

## Threshold configuration

All thresholds live in `perf/thresholds.json`. A run fails when **either** condition holds:

1. **Absolute ceiling** — p95 exceeds `absolute_max_ms[endpoint]`
2. **Regression multiplier** — p95 exceeds `baseline_p95 × regression_multiplier` (requires a stored baseline)

Edit `perf/thresholds.json` and commit to change limits for all future runs.

---

## Baseline management

`perf/api-results.json` is written each run and gitignored.  
`perf/api-baseline.json` is committed and used for regression comparison.

**Update the baseline locally:**

```bash
node perf/check-regression.js --update-baseline
git add perf/api-baseline.json && git commit -m "perf: update api baseline"
```

**Update via CI:**

```bash
gh workflow run perf.yml -f update_baseline=true
```

The workflow commits `api-baseline.json` automatically with `[skip ci]`.

---

## CI integration

Workflow: `.github/workflows/perf.yml`

- **Schedule**: every Monday 03:00 UTC
- **Trigger**: `workflow_dispatch` (Actions tab, optional `update_baseline` input)
- **Blocking**: `continue-on-error: true` on both jobs — failures produce `::warning` annotations and appear in the job summary but **do not block merges**

Artifacts:

| Name | Retention | Contents |
|------|-----------|---------|
| `criterion-report-<run_id>` | 30 days | Criterion HTML report |
| `api-bench-results-<run_id>` | 90 days | `perf/api-results.json` |

---

## Diagnosing failures

**API regression output:**

```
❌ GET /api/governance/stats   p95=480ms  ← p95 480ms > 2x baseline 110ms (limit: 220ms)
```

Steps:
1. Reproduce locally: `cd backend && npm run bench`
2. Check Redis is healthy: `redis-cli ping`
3. Add timing logs to the slow route middleware
4. If the regression is intentional: `node perf/check-regression.js --update-baseline`
5. If the limit itself needs raising: edit `perf/thresholds.json`

**Criterion regression output:**

Criterion prints `change: [+X% +Y%]` lines. A `>` marker means a statistically significant slowdown. Use `--baseline main` to isolate which commit caused it.

---

## File map

```
perf/
  thresholds.json          Absolute caps + regression multiplier
  check-regression.js      Reads api-results.json, applies thresholds
  api-results.json         Latest run output (gitignored)
  api-baseline.json        Committed baseline for regression detection

backend/bench/
  api-bench.js             API benchmark runner (Node.js built-ins only)

contracts/governance/benches/
  governance_bench.rs      Criterion benchmarks for contract operations

.github/workflows/
  perf.yml                 Scheduled + on-demand CI pipeline
```

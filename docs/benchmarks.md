# Performance Benchmarks

This document describes VoteChain's benchmark suite, baseline expectations, threshold configuration, and how to investigate failures.

---

## Overview

Two benchmark layers cover different concerns:

| Layer | Tool | What it measures |
|-------|------|-----------------|
| **Contract** | [Criterion](https://bheisler.github.io/criterion.rs/) | CPU time for `create_proposal`, `cast_vote`, `finalise` in the Soroban in-process test env |
| **API** | Node.js (`http` / `perf_hooks`) | HTTP p50/p95/p99 response times for critical backend endpoints |

Both run via the `Performance Benchmarks` GitHub Actions workflow (`.github/workflows/perf.yml`) on a weekly schedule and on demand.

---

## Running Locally

### Contract benchmarks

```bash
# Run all three criterion benchmarks
cargo bench -p votechain-governance

# Save a named baseline (e.g. after a clean main checkout)
cargo bench -p votechain-governance -- --save-baseline main

# Compare current results against that baseline
cargo bench -p votechain-governance -- --baseline main
```

HTML reports are written to `target/criterion/` and can be opened in a browser.

### API benchmarks

The backend server must be running before you run the benchmark.

```bash
# Terminal 1 — start the server (requires Redis on localhost:6379)
cd backend && npm run dev

# Terminal 2 — run the benchmark
cd backend && npm run bench

# Or run the benchmark and immediately check against thresholds:
cd backend && npm run bench:check
```

Environment variables accepted by `backend/bench/api-bench.js`:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001` | Base URL of the running backend |
| `ITERATIONS` | `50` | Number of requests per endpoint |
| `CONCURRENCY` | `1` | Parallel requests per batch |
| `OUT_FILE` | `perf/api-results.json` | Path to write JSON results |

---

## Baseline Expectations

The table below describes the performance expectations for typical stub-mode responses on CI hardware (GitHub-hosted `ubuntu-latest`). These will need to be adjusted as the backend is connected to live Stellar RPC / indexer calls.

### API endpoints

| Endpoint | p95 target |
|----------|-----------|
| `GET /api/proposals` | ≤ 200 ms |
| `GET /api/proposals/:id` | ≤ 100 ms |
| `GET /api/governance/stats` | ≤ 200 ms |
| `GET /metrics/cache` | ≤ 50 ms |

### Contract operations (Soroban in-process)

| Operation | p99 target |
|-----------|-----------|
| `create_proposal` | ≤ 5 ms |
| `cast_vote` | ≤ 5 ms |
| `finalise` | ≤ 5 ms |

---

## Threshold Configuration

Thresholds live in `perf/thresholds.json`:

```json
{
  "api": {
    "regression_multiplier": 2.0,
    "absolute_max_ms": {
      "GET /api/proposals":        200,
      "GET /api/proposals/:id":    100,
      "GET /api/governance/stats": 200,
      "GET /metrics/cache":         50
    }
  },
  "contract": {
    "regression_multiplier": 2.0,
    "absolute_max_us": { ... }
  }
}
```

A run fails when **either** condition is met:

1. **Absolute ceiling** — measured p95 exceeds `absolute_max_ms[endpoint]` regardless of any baseline.
2. **Regression multiplier** — measured p95 exceeds `baseline_p95 × regression_multiplier` (requires a stored baseline).

Edit `thresholds.json` and commit the change to adjust limits for all future runs.

---

## Baseline Management

Results from each run are written to `perf/api-results.json`. A stored baseline in `perf/api-baseline.json` enables regression detection across runs.

### Update the baseline

After a confirmed performance improvement or threshold change:

```bash
# Locally
node perf/check-regression.js --update-baseline

# Via CI — trigger the workflow with update_baseline = true
gh workflow run perf.yml -f update_baseline=true
```

When triggered with `update_baseline=true` the workflow commits the new `perf/api-baseline.json` with a `[skip ci]` commit message.

---

## CI Integration

The workflow is defined in `.github/workflows/perf.yml`.

- **Schedule**: every Monday at 03:00 UTC.
- **Trigger**: `workflow_dispatch` (manual run from the Actions tab).
- **Blocking**: `continue-on-error: true` on both jobs — failures produce `::warning` annotations and appear in the job summary but **do not block merges**. This prevents flaky infrastructure timings from blocking unrelated PRs.

To make benchmarks a hard gate, set the repository variable `PERF_BLOCKING` to `true` and change `continue-on-error` in `perf.yml`.

### Artifacts

| Artifact | Retention | Contents |
|----------|-----------|---------|
| `criterion-report-<run_id>` | 30 days | Criterion HTML report (`target/criterion/`) |
| `api-bench-results-<run_id>` | 90 days | `perf/api-results.json` |

---

## Interpreting Failures

### API regression output

```
❌ GET /api/proposals          p95 432ms  ← p95 432ms > 2x baseline 110ms (limit: 220ms)
```

Diagnosis steps:
1. Run `npm run bench` locally to reproduce.
2. Check Redis is healthy (`redis-cli ping`).
3. Profile the slow handler — add timing logs, check middleware overhead.
4. If the slowdown is expected (new feature, heavier queries), update the baseline:
   ```bash
   node perf/check-regression.js --update-baseline
   ```
5. If absolute limits need adjusting, edit `perf/thresholds.json`.

### Criterion regression output

Criterion prints `change: [+X% +Y%]` lines. A `>` symbol indicates a statistically significant slowdown. Compare with the saved `--baseline main` to isolate the commit that introduced the regression.

---

## File Map

```
perf/
  thresholds.json         — absolute caps + regression multiplier
  check-regression.js     — regression checker (reads api-results.json)
  api-results.json        — latest benchmark run (gitignored)
  api-baseline.json       — committed baseline for regression detection

backend/bench/
  api-bench.js            — API benchmark runner (pure Node.js)

contracts/governance/benches/
  governance_bench.rs     — Criterion benchmarks for contract operations

.github/workflows/
  perf.yml                — CI workflow (scheduled + on demand)
```

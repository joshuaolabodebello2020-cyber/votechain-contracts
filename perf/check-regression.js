#!/usr/bin/env node
/**
 * VoteChain performance regression checker.
 *
 * Reads perf/api-results.json (written by backend/bench/api-bench.js) and
 * compares each endpoint's p95 against:
 *   1. The absolute maximum defined in perf/thresholds.json
 *   2. A stored baseline (perf/api-baseline.json) multiplied by regression_multiplier
 *
 * Usage:
 *   node perf/check-regression.js [--update-baseline]
 *
 * Flags:
 *   --update-baseline   Persist current results as the new baseline and exit 0.
 *                       Use this after intentional performance improvements.
 *
 * Exit codes:
 *   0  No regressions detected
 *   1  One or more regressions detected (or results file missing)
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const PERF_DIR    = path.join(__dirname);
const RESULTS     = path.join(PERF_DIR, "api-results.json");
const BASELINE    = path.join(PERF_DIR, "api-baseline.json");
const THRESHOLDS  = path.join(PERF_DIR, "thresholds.json");

// ── Load files ────────────────────────────────────────────────────────────────

function load(file, required = true) {
  if (!fs.existsSync(file)) {
    if (required) { console.error(`ERROR: ${file} not found. Run the benchmark first.`); process.exit(1); }
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const results    = load(RESULTS);
const thresholds = load(THRESHOLDS);
const baseline   = load(BASELINE, false);

// ── --update-baseline flag ────────────────────────────────────────────────────

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(BASELINE, JSON.stringify(results, null, 2));
  console.log(`Baseline updated: ${BASELINE}`);
  console.log(`  Timestamp : ${results.timestamp}`);
  for (const r of results.results) {
    console.log(`  ${r.endpoint.padEnd(35)} p95=${r.p95}ms`);
  }
  process.exit(0);
}

// ── Check ─────────────────────────────────────────────────────────────────────

const absMax      = thresholds.api.absolute_max_ms;
const multiplier  = thresholds.api.regression_multiplier;
const regressions = [];

console.log(`\nVoteChain API Regression Check`);
console.log(`  Results   : ${results.timestamp}`);
console.log(`  Baseline  : ${baseline ? baseline.timestamp : "none (absolute thresholds only)"}`);
console.log(`  Multiplier: ${multiplier}x\n`);

for (const r of results.results) {
  const name      = r.endpoint;
  const p95       = r.p95;
  const absLimit  = absMax[name];
  let   passed    = true;
  const issues    = [];

  // 1. Absolute hard ceiling
  if (absLimit !== undefined && p95 > absLimit) {
    issues.push(`p95 ${p95}ms > absolute max ${absLimit}ms`);
    passed = false;
  }

  // 2. Baseline regression
  if (baseline) {
    const bEntry = baseline.results.find((b) => b.endpoint === name);
    if (bEntry) {
      const limit = +(bEntry.p95 * multiplier).toFixed(2);
      if (p95 > limit) {
        issues.push(`p95 ${p95}ms > ${multiplier}x baseline ${bEntry.p95}ms (limit: ${limit}ms)`);
        passed = false;
      }
    }
  }

  const symbol = passed ? "✅" : "❌";
  const detail = passed ? `p95=${p95}ms` : `p95=${p95}ms  ← ${issues.join("; ")}`;
  console.log(`  ${symbol} ${name.padEnd(35)} ${detail}`);

  if (!passed) regressions.push({ name, p95, issues });
}

console.log("");

if (regressions.length > 0) {
  console.error(`REGRESSION DETECTED: ${regressions.length} endpoint(s) exceeded thresholds.\n`);
  for (const reg of regressions) {
    console.error(`  • ${reg.name}`);
    for (const issue of reg.issues) {
      console.error(`      ${issue}`);
    }
  }
  console.error(`\nDiagnosis steps:`);
  console.error(`  1. Run 'node backend/bench/api-bench.js' locally to reproduce.`);
  console.error(`  2. Profile the slow endpoint (add timing logs, check Redis status).`);
  console.error(`  3. If the slowdown is intentional, update the baseline:`);
  console.error(`       node perf/check-regression.js --update-baseline`);
  console.error(`  4. Adjust thresholds in perf/thresholds.json if needed.\n`);
  process.exit(1);
}

console.log("No regressions detected. ✅");

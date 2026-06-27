#!/usr/bin/env node
// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * VoteChain API regression checker.
 *
 * Reads perf/api-results.json and checks each endpoint's p95 against:
 *   1. absolute_max_ms from perf/thresholds.json  (always applied)
 *   2. baseline_p95 × regression_multiplier       (when perf/api-baseline.json exists)
 *
 * Usage:
 *   node perf/check-regression.js               # check current results
 *   node perf/check-regression.js --update-baseline  # save results as new baseline
 *
 * Exit: 0 = no regression, 1 = regression detected or results missing.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const DIR       = __dirname;
const RESULTS   = path.join(DIR, "api-results.json");
const BASELINE  = path.join(DIR, "api-baseline.json");
const THRESHOLDS= path.join(DIR, "thresholds.json");

function load(file, required) {
  if (!fs.existsSync(file)) {
    if (required) { console.error(`Missing: ${file} — run the benchmark first.`); process.exit(1); }
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const results    = load(RESULTS, true);
const thresholds = load(THRESHOLDS, true);
const baseline   = load(BASELINE, false);

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(BASELINE, JSON.stringify(results, null, 2));
  console.log(`Baseline saved → ${BASELINE}  (${results.timestamp})`);
  for (const r of results.results) console.log(`  ${r.endpoint.padEnd(35)} p95=${r.p95}ms`);
  process.exit(0);
}

const absMax     = thresholds.api.absolute_max_ms;
const multiplier = thresholds.api.regression_multiplier;
const failures   = [];

console.log(`\nVoteChain Regression Check`);
console.log(`  Results  : ${results.timestamp}`);
console.log(`  Baseline : ${baseline ? baseline.timestamp : "none — absolute limits only"}`);
console.log(`  Limit    : ${multiplier}x baseline\n`);

for (const r of results.results) {
  const issues = [];

  const cap = absMax[r.endpoint];
  if (cap !== undefined && r.p95 > cap)
    issues.push(`p95 ${r.p95}ms > absolute max ${cap}ms`);

  if (baseline) {
    const b = baseline.results.find((x) => x.endpoint === r.endpoint);
    if (b) {
      const limit = +(b.p95 * multiplier).toFixed(2);
      if (r.p95 > limit)
        issues.push(`p95 ${r.p95}ms > ${multiplier}x baseline ${b.p95}ms (limit: ${limit}ms)`);
    }
  }

  const ok = issues.length === 0;
  console.log(`  ${ok ? "✅" : "❌"} ${r.endpoint.padEnd(35)} p95=${r.p95}ms${ok ? "" : "  ← " + issues.join("; ")}`);
  if (!ok) failures.push({ endpoint: r.endpoint, issues });
}

console.log("");

if (failures.length > 0) {
  console.error(`REGRESSION: ${failures.length} endpoint(s) exceeded thresholds\n`);
  for (const f of failures) {
    console.error(`  • ${f.endpoint}`);
    for (const i of f.issues) console.error(`      ${i}`);
  }
  console.error(`\nDiagnosis:`);
  console.error(`  1. Reproduce locally: cd backend && npm run bench`);
  console.error(`  2. Check Redis health and middleware timing logs`);
  console.error(`  3. To accept the new baseline: node perf/check-regression.js --update-baseline`);
  console.error(`  4. To raise limits: edit perf/thresholds.json\n`);
  process.exit(1);
}

console.log("All endpoints within thresholds. ✅");

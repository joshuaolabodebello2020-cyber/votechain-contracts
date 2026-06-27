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
 * VoteChain API performance benchmark.
 *
 * Measures p50 / p95 / p99 response times for critical backend endpoints.
 * Uses only Node.js built-ins — no additional dependencies required.
 *
 * Environment variables:
 *   API_URL      Base URL  (default: http://localhost:3001)
 *   ITERATIONS   Requests per endpoint (default: 50)
 *   CONCURRENCY  Parallel requests per batch (default: 1)
 *   OUT_FILE     JSON output path (default: perf/api-results.json)
 *
 * Exit: 0 on success, 1 if server unreachable.
 */

"use strict";

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const { performance } = require("perf_hooks");

const API_URL    = (process.env.API_URL    || "http://localhost:3001").replace(/\/$/, "");
const ITERATIONS = parseInt(process.env.ITERATIONS  || "50", 10);
const CONCURRENCY= parseInt(process.env.CONCURRENCY || "1",  10);
const OUT_FILE   = process.env.OUT_FILE || path.join(__dirname, "../../perf/api-results.json");

const ENDPOINTS = [
  { name: "GET /api/proposals",        path: "/api/proposals" },
  { name: "GET /api/proposals/:id",    path: "/api/proposals/1" },
  { name: "GET /api/governance/stats", path: "/api/governance/stats" },
  { name: "GET /metrics/cache",        path: "/api/metrics/cache" },
];

function request(url) {
  return new Promise((resolve, reject) => {
    const lib   = url.startsWith("https") ? https : http;
    const start = performance.now();
    const req   = lib.get(url, { timeout: 10_000 }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, ms: performance.now() - start }));
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
  });
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const pct  = (p) => +s[Math.max(0, Math.ceil(p / 100 * s.length) - 1)].toFixed(2);
  return { mean: +mean.toFixed(2), p50: pct(50), p95: pct(95), p99: pct(99),
           min: +s[0].toFixed(2), max: +s[s.length - 1].toFixed(2), count: s.length };
}

async function benchEndpoint(ep) {
  const url = `${API_URL}${ep.path}`;
  const samples = [];
  let errors = 0;
  for (let i = 0; i < ITERATIONS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, ITERATIONS - i);
    const results = await Promise.allSettled(Array.from({ length: batch }, () => request(url)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.status < 500) samples.push(r.value.ms);
      else errors++;
    }
  }
  return { endpoint: ep.name, url, ...stats(samples), errors };
}

async function run() {
  console.log(`\nVoteChain API Benchmark  ${new Date().toISOString()}`);
  console.log(`  ${API_URL}  iterations=${ITERATIONS}  concurrency=${CONCURRENCY}\n`);

  const results = [];
  let failed = false;

  for (const ep of ENDPOINTS) {
    process.stdout.write(`  ${ep.name.padEnd(35)} `);
    const r = await benchEndpoint(ep);
    results.push(r);
    if (r.count === 0) {
      console.log(`FAILED (${r.errors} errors)`);
      failed = true;
    } else {
      console.log(`p50=${r.p50}ms  p95=${r.p95}ms  p99=${r.p99}ms  (n=${r.count})`);
    }
  }

  const out = { timestamp: new Date().toISOString(), api_url: API_URL,
                iterations: ITERATIONS, concurrency: CONCURRENCY, results };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`\n  Results → ${OUT_FILE}`);

  if (failed) {
    console.error("\n  ERROR: endpoints unreachable. Is the backend running?");
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });

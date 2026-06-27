#!/usr/bin/env node
/**
 * VoteChain API performance benchmark.
 *
 * Measures p50/p95/p99 response times for critical backend endpoints.
 * Uses only Node.js built-ins (http, https, perf_hooks) — no extra dependencies.
 *
 * Usage:
 *   node backend/bench/api-bench.js [options]
 *
 * Options (env vars):
 *   API_URL      Base URL of the API  (default: http://localhost:3001)
 *   ITERATIONS   Requests per endpoint (default: 50)
 *   CONCURRENCY  Parallel requests     (default: 1)
 *   OUT_FILE     Path to write JSON results (default: perf/api-results.json)
 *
 * Exit codes:
 *   0  All endpoints measured successfully
 *   1  One or more endpoints failed to respond
 */

"use strict";

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const { performance } = require("perf_hooks");

const API_URL     = (process.env.API_URL    || "http://localhost:3001").replace(/\/$/, "");
const ITERATIONS  = parseInt(process.env.ITERATIONS  || "50", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "1",  10);
const OUT_FILE    = process.env.OUT_FILE || path.join(__dirname, "../../perf/api-results.json");

/** Endpoints to benchmark. */
const ENDPOINTS = [
  { name: "GET /api/proposals",        path: "/api/proposals" },
  { name: "GET /api/proposals/:id",    path: "/api/proposals/1" },
  { name: "GET /api/governance/stats", path: "/api/governance/stats" },
  { name: "GET /metrics/cache",        path: "/api/metrics/cache" },
];

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(urlStr) {
  return new Promise((resolve, reject) => {
    const url   = new URL(urlStr);
    const lib   = url.protocol === "https:" ? https : http;
    const start = performance.now();

    const req = lib.get(urlStr, { timeout: 10_000 }, (res) => {
      res.resume(); // drain
      res.on("end", () => {
        resolve({ status: res.statusCode, ms: performance.now() - start });
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error",   reject);
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return +sorted[Math.max(0, idx)].toFixed(2);
}

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    mean:  +mean.toFixed(2),
    p50:   percentile(s, 50),
    p95:   percentile(s, 95),
    p99:   percentile(s, 99),
    min:   +s[0].toFixed(2),
    max:   +s[s.length - 1].toFixed(2),
    count: s.length,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function benchEndpoint(endpoint) {
  const url     = `${API_URL}${endpoint.path}`;
  const samples = [];
  let   errors  = 0;

  // Run in batches of CONCURRENCY
  for (let i = 0; i < ITERATIONS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, ITERATIONS - i);
    const results = await Promise.allSettled(
      Array.from({ length: batch }, () => request(url))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.status < 500) {
        samples.push(r.value.ms);
      } else {
        errors++;
      }
    }
  }

  return { endpoint: endpoint.name, url, ...stats(samples), errors };
}

async function run() {
  console.log(`\nVoteChain API Benchmark`);
  console.log(`  Base URL    : ${API_URL}`);
  console.log(`  Iterations  : ${ITERATIONS}`);
  console.log(`  Concurrency : ${CONCURRENCY}`);
  console.log(`  Timestamp   : ${new Date().toISOString()}\n`);

  const results = [];
  let   failed  = false;

  for (const ep of ENDPOINTS) {
    process.stdout.write(`  Benchmarking ${ep.name} ... `);
    const r = await benchEndpoint(ep);
    results.push(r);

    if (r.count === 0) {
      console.log(`FAILED (${r.errors} errors — is the server running?)`);
      failed = true;
    } else {
      console.log(`p50=${r.p50}ms  p95=${r.p95}ms  p99=${r.p99}ms  (${r.count} samples, ${r.errors} errors)`);
    }
  }

  // Write JSON results
  const output = {
    timestamp:   new Date().toISOString(),
    api_url:     API_URL,
    iterations:  ITERATIONS,
    concurrency: CONCURRENCY,
    results,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n  Results written to: ${OUT_FILE}`);

  if (failed) {
    console.error("\n  ERROR: One or more endpoints failed to respond. Is the server running?");
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });

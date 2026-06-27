# VoteChain Load Testing

Load tests for the VoteChain backend API and indexer services using [k6](https://k6.io).

## Tool

[k6](https://k6.io) — open-source load testing tool with JavaScript scripting.

Install:
```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Services Under Test

| Service  | Port | Base URL                  |
|----------|------|---------------------------|
| Backend  | 3001 | http://localhost:3001      |
| Indexer  | 4000 | http://localhost:4000      |

### Backend Endpoints (Express)

| Method | Path                          | Description            |
|--------|-------------------------------|------------------------|
| GET    | /api/proposals                | List all proposals     |
| GET    | /api/proposals/:id            | Get proposal by ID     |
| POST   | /api/proposals/invalidate     | Invalidate cache       |
| GET    | /api/metrics/cache            | Cache metrics          |

### Indexer Endpoints (Rust/axum)

| Method | Path                          | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | /events                       | List all events              |
| GET    | /events/proposals/:id         | Events for a proposal        |
| GET    | /stats/participation          | Participation statistics     |

## Scripts

| Script          | Purpose                                      |
|-----------------|----------------------------------------------|
| `backend.js`    | Backend API load test (ramp to 100 VUs)      |
| `indexer.js`    | Indexer load test (ramp to 100 VUs)          |
| `scenarios.js`  | Combined smoke/load/stress/soak scenarios    |

## Load Scenarios

### Smoke (baseline sanity check)
- **VUs:** 1
- **Duration:** 1 minute
- **Purpose:** Verify endpoints respond correctly before heavier load

### Load (normal expected traffic)
- **VUs:** Ramp 0 → 100 over 2 min, hold 3 min, ramp down 1 min
- **Duration:** ~6 minutes total
- **Purpose:** Validate performance under typical production load

### Stress (find breaking point)
- **VUs:** Ramp 0 → 300 over 5 min, hold 3 min, ramp down 2 min
- **Duration:** ~10 minutes total
- **Purpose:** Identify where the system degrades or fails

### Soak (endurance test)
- **VUs:** 50
- **Duration:** 1 hour
- **Purpose:** Detect memory leaks, connection pool exhaustion, degradation over time

## Performance Limits

| Service  | Metric              | Threshold |
|----------|---------------------|-----------|
| Backend  | p95 response time   | < 500 ms  |
| Backend  | Error rate          | < 1%      |
| Indexer  | p95 response time   | < 1000 ms |
| Indexer  | Error rate          | < 2%      |

## Running the Tests

```bash
# Using Make targets
make load-test-backend
make load-test-indexer

# Or directly with k6
k6 run load-tests/backend.js
k6 run load-tests/indexer.js

# Run a specific scenario from scenarios.js
k6 run --env SCENARIO=smoke load-tests/scenarios.js
k6 run --env SCENARIO=load  load-tests/scenarios.js
k6 run --env SCENARIO=stress load-tests/scenarios.js
k6 run --env SCENARIO=soak  load-tests/scenarios.js

# Run with custom base URLs
k6 run --env BACKEND_URL=http://staging:3001 load-tests/backend.js
k6 run --env INDEXER_URL=http://staging:4000 load-tests/indexer.js

# Run with output to InfluxDB/Grafana for dashboards
k6 run --out influxdb=http://localhost:8086/k6 load-tests/backend.js
```

## Failure Modes & Mitigations

### FM-1: High p95 Latency on `/api/proposals`

**Symptom:** p95 response time exceeds 500 ms under load.

**Likely causes:**
- Database query not indexed; full table scan under concurrent requests
- Cache miss storm on cold start
- Insufficient connection pool size

**Mitigation:**
- Ensure proposal list query is indexed on `state` and `created_at`
- Pre-warm the cache before exposing the service to traffic
- Tune the DB connection pool (`DB_POOL_SIZE` env var)

---

### FM-2: Error Rate Spike on Backend Cache Invalidation

**Symptom:** POST `/api/proposals/invalidate` returns 5xx under concurrent load.

**Likely causes:**
- Cache backend (Redis/in-memory) becomes a contention point
- Invalidation endpoint not rate-limited, allowing thundering herd

**Mitigation:**
- Add debounce or rate limiting to the invalidation endpoint
- Use a distributed lock to serialize cache invalidation

---

### FM-3: Indexer Memory Growth During Soak Test

**Symptom:** Memory usage climbs steadily over the 1-hour soak run; eventual OOM.

**Likely causes:**
- Unbounded in-memory event cache
- DB connection leak in axum handlers

**Mitigation:**
- Enforce max size on in-memory caches with LRU eviction
- Verify all DB connections are returned to the pool (use `sqlx` pool metrics)

---

### FM-4: Indexer Timeouts on `/stats/participation` Under Stress

**Symptom:** `/stats/participation` errors spike above 2% at 300 VUs.

**Likely causes:**
- Aggregation query scans all vote records without index
- No query timeout configured; requests queue up

**Mitigation:**
- Add a composite index on `(proposal_id, vote_type)` for participation aggregation
- Set a query timeout (e.g., 5 s) and return 503 if exceeded

---

### FM-5: Connection Exhaustion

**Symptom:** Both services return `ECONNREFUSED` or `503` at high VU counts.

**Likely causes:**
- OS-level file descriptor limit too low
- Service not configured for keep-alive; each request opens a new TCP connection

**Mitigation:**
- Increase `ulimit -n` on the host (recommend ≥ 65535)
- Enable HTTP keep-alive in both Express and axum
- Tune `--max-connections` in axum's server config

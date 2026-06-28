# Monitoring

This document describes the monitoring stack for VoteChain's key services: Stellar RPC, the backend API, and the indexer.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Backend API │     │ Stellar RPC  │     │   Indexer    │
│  :3001       │     │ :8000/:11626 │     │   :4000      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────┬───────┴────────────────────┘
                    │
             ┌──────▼───────┐
             │  Prometheus  │
             │  :9090       │
             └──────┬───────┘
                    │
          ┌─────────┴─────────┐
          │                   │
   ┌──────▼───────┐   ┌──────▼──────┐
   │   Grafana    │   │ AlertManager│
   │   :3000      │   │   :9093     │
   └──────────────┘   └─────────────┘
```

## Health Checks

| Service      | Endpoint              | Protocol | Healthy When                  |
|--------------|-----------------------|----------|-------------------------------|
| Backend      | `GET /ready`          | HTTP     | 200 OK, `{"status":"ok","redis":true}` |
| Backend      | `GET /live`           | HTTP     | 200 OK (process alive)        |
| Stellar RPC  | `:11626/metrics`      | HTTP     | Prometheus metrics returned   |
| Stellar RPC  | `:8000/soroban/rpc`   | HTTP     | JSON-RPC responds             |
| Indexer      | `GET /events`         | HTTP     | 200 OK (API serving)          |
| Redis        | `redis-cli ping`      | TCP      | Returns `PONG`                |

## Prometheus Scrape Targets

Configured in `monitoring/prometheus.yml`:

| Job Name           | Target              | Interval | Purpose                     |
|--------------------|---------------------|----------|-----------------------------|
| `prometheus`       | `localhost:9090`    | 15s      | Self-monitoring             |
| `node`             | `node-exporter:9100`| 15s      | Host OS metrics             |
| `votechain-contracts` | `localhost:8000` | 10s      | Contract deployment metrics |
| `stellar-rpc`      | `stellar-rpc:11626` | 15s      | Stellar core metrics        |
| `stellar-rpc-http` | `stellar-node:8000` | 30s      | Soroban RPC endpoint        |
| `backend`          | `backend:3001`      | 10s      | Backend API readiness       |
| `indexer`          | `indexer:4000`      | 30s      | Indexer API availability    |
| `postgres`         | `postgres-exporter:9187` | 15s | PostgreSQL metrics          |

## Alerting Rules

Defined in `monitoring/alerts.yml`. All alerts route through AlertManager (`monitoring/alertmanager.yml`).

### Service Health Alerts

| Alert               | Condition                                  | For   | Severity |
|----------------------|--------------------------------------------|-------|----------|
| `BackendDown`        | `up{job="backend"} == 0`                   | 2m    | critical |
| `BackendNotReady`    | Backend readiness probe failing            | 3m    | warning  |
| `IndexerDown`        | `up{job="indexer"} == 0`                   | 2m    | critical |
| `StellarRpcDown`     | Both RPC endpoints unreachable             | 3m    | critical |
| `StellarRpcHighLatency` | Soroban RPC P95 > 3s                    | 5m    | warning  |

### Infrastructure Alerts

| Alert               | Condition                     | For   | Severity |
|----------------------|-------------------------------|-------|----------|
| `ContractNotHealthy` | Contract deployment status 0 | 5m    | -        |
| `HighErrorRate`      | Error rate > 5%              | 5m    | -        |
| `HighLatency`        | Contract call P99 > 5s       | 5m    | -        |
| `PrometheusDown`     | Prometheus scrape target down| 1m    | -        |
| `HighCPUUsage`       | CPU > 80%                    | 5m    | -        |
| `DiskSpaceLow`       | Disk < 10% free              | 5m    | -        |
| `MemoryUsageHigh`    | Memory > 90% used            | 5m    | -        |

### Alert Routing

- **Critical** alerts: Slack `#critical-alerts` + PagerDuty (5m repeat)
- **Warning** alerts: Slack `#alerts` (1h repeat)
- **Default**: Slack `#alerts` (1h repeat)

Configure alert destinations via environment variables:
- `SLACK_WEBHOOK_URL` — Slack incoming webhook
- `PAGERDUTY_SERVICE_KEY` — PagerDuty integration key

## Dashboards

Located in `monitoring/dashboards/`:

| Dashboard                   | File                          | Purpose                          |
|-----------------------------|-------------------------------|----------------------------------|
| Contracts Health & Metrics  | `votechain-contracts.json`    | Contract deployment, calls, errors |
| Service Health              | `service-health.json`         | Backend/RPC/indexer uptime and latency |

### Service Health Dashboard Panels

1. **Service Status Overview** — up/down status for all services
2. **Backend/RPC/Indexer Uptime** — time-series availability graphs
3. **Response Times** — scrape duration as a proxy for endpoint latency
4. **Availability Gauge** — rolling 30-minute uptime percentage per service

## Running the Monitoring Stack

```bash
docker compose -f monitoring/docker-compose-monitoring.yml up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- AlertManager: http://localhost:9093

## Observability Gaps

The following gaps exist and should be addressed as the project matures:

1. **Backend application metrics** — The backend exposes `/ready` and `/live` but no Prometheus metrics endpoint. Adding `prom-client` would expose request count, latency histograms, and error rates natively.

2. **Indexer metrics** — The indexer has no `/health` or `/metrics` endpoint. Ingestion lag (current ledger vs. last indexed ledger) is the most important metric to track; currently it can only be inferred by querying the database.

3. **Structured logging** — Neither the backend nor indexer emit structured (JSON) logs. Integrating a log aggregator (Loki, ELK) would enable log-based alerting and correlation with metrics.

4. **Distributed tracing** — No OpenTelemetry or tracing integration exists. For debugging cross-service issues (frontend → backend → RPC → contract), traces would significantly reduce mean-time-to-diagnose.

5. **Synthetic health probes** — Prometheus `up` metric checks whether the scrape succeeded, but doesn't validate application-level health semantics. A blackbox exporter probing `/ready` would catch cases where the endpoint returns 503.

6. **Redis monitoring** — Redis is a backend dependency but has no exporter in the monitoring stack. A `redis_exporter` would surface memory usage, connected clients, and command latency.

7. **PostgreSQL monitoring** — The Prometheus config references `postgres-exporter:9187` but the monitoring docker-compose doesn't include a postgres exporter service.

8. **SLA/SLO definitions** — No service-level objectives are defined. Recommended starting points: 99.5% backend availability, P95 backend latency < 500ms, indexer lag < 30 ledgers.

# Observability & Monitoring Dashboards

This document describes the observability setup for VoteChain contracts including dashboard templates, key metrics, and alerting.

## Overview

The observability stack provides real-time monitoring of contract deployment, health metrics, latency, and error rates using:
- **Prometheus**: Time-series metrics collection and storage
- **Grafana**: Dashboard visualization and alerting
- **AlertManager**: Alert routing and notification management
- **Node Exporter**: System-level metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VoteChain Services                        │
│  (Contracts, Stellar RPC, PostgreSQL, etc.)                 │
└────────────────────────┬────────────────────────────────────┘
                         │ (metrics export)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Prometheus (Port 9090)                    │
│        Scrapes metrics every 15s, stores in TSDB            │
└────────────┬─────────────────────────────┬──────────────────┘
             │                             │
             ▼                             ▼
      ┌─────────────┐            ┌──────────────────┐
      │ Grafana     │            │ AlertManager     │
      │ (Port 3000) │            │ (Port 9093)      │
      │  Dashboards │            │  Alert Routing   │
      │ Alerts      │            │                  │
      └─────────────┘            └──────────────────┘
             │                             │
             └─────────────┬───────────────┘
                           │
              ┌────────────┴──────────────┐
              │                           │
         ┌────▼────┐              ┌──────▼─────┐
         │  Slack  │              │ PagerDuty  │
         │ Webhook │              │  (Critical)│
         └─────────┘              └────────────┘
```

## Components

### Prometheus

Scrapes metrics from:
- VoteChain contracts (custom metrics endpoint)
- Stellar RPC node
- PostgreSQL (via postgres-exporter)
- Node Exporter (system metrics)
- Prometheus itself

**Configuration:** `monitoring/prometheus.yml`

**Retention Policy:**
- Default: 15 days
- Adjustable via `--storage.tsdb.retention.time` flag

### Grafana

Provides visualization and alerting interface.

**Features:**
- Pre-configured dashboards for VoteChain
- Alert rules and notification policies
- User authentication and RBAC
- Data source configuration

**Default Credentials:**
- Username: `admin`
- Password: `admin` (⚠️ Change in production)

**Access:** http://localhost:3000

### AlertManager

Routes and deduplicates alerts from Prometheus.

**Notification Channels:**
- **Slack**: General alerts and warnings
- **PagerDuty**: Critical alerts (on-call integration)
- **Email**: Important notifications (configurable)

**Configuration:** `monitoring/alertmanager.yml`

### Node Exporter

Exports system-level metrics (CPU, memory, disk, network).

**Access:** http://localhost:9100/metrics

## Key Metrics

### Contract Deployment Metrics

**`contract_deployment_status`**
- Type: Gauge (0=inactive, 1=active)
- Labels: `contract_name`, `version`, `network`
- Purpose: Overall health status of each deployed contract

**`contract_calls_total`**
- Type: Counter
- Labels: `contract_name`, `method`, `status` (success/error)
- Purpose: Total number of contract calls and success/failure breakdown

**`contract_call_duration_seconds`**
- Type: Histogram with buckets
- Labels: `contract_name`, `method`
- Purpose: Request latency distribution for performance analysis

### Backend Health Metrics

**`contract_error_rate`**
- Formula: `rate(contract_calls_total{status="error"}[5m])`
- Threshold: > 5% triggers alert
- Purpose: Early detection of reliability issues

**`contract_call_latency_p99`**
- Formula: `histogram_quantile(0.99, rate(contract_call_duration_seconds_bucket[5m]))`
- Threshold: > 5 seconds triggers alert
- Purpose: User experience monitoring

### Governance-Specific Metrics

**`contract_governance_active_proposals`**
- Type: Gauge
- Purpose: Monitor active governance proposal count

**`contract_governance_voting_participation`**
- Type: Gauge (percentage)
- Purpose: Track voter engagement

### Token Metrics

**`contract_token_total_supply`**
- Type: Gauge
- Purpose: Monitor total token supply

**`contract_token_burn_rate`**
- Type: Counter
- Purpose: Track token destruction rate

## Dashboard Templates

### 1. Main Dashboard: `votechain-contracts.json`

**Panels:**
- Contract Deployment Status (stat cards)
- Call Latency P99 (graph with time series)
- Error Rate (graph with alert thresholds)
- Total Transactions (stat)
- Active Proposals (stat)
- Token Supply (gauge)
- Build Artifacts (table)

**Refresh Rate:** 30 seconds

**Time Range:** Last 1 hour (default)

**Variables:** Instance selector for multi-environment monitoring

### 2. Infrastructure Dashboard

Monitors underlying infrastructure:
- CPU and memory usage
- Disk I/O and capacity
- Network metrics
- Docker container health
- Database performance

### 3. Business Metrics Dashboard

Tracks business KPIs:
- Total transactions processed
- Average transaction latency
- Error rate trends
- Voter participation rates
- Governance proposal lifecycle metrics

## Alert Rules

### Critical Alerts (Pager Duty + Slack)

**`ContractNotHealthy`**
- Condition: `contract_deployment_status == 0` for 5 minutes
- Action: Page on-call engineer
- Resolution: Manual deployment restart or investigation

**`HighErrorRate`**
- Condition: Error rate > 5% for 5 minutes
- Action: Immediate notification
- Investigation: Check recent deployments, service health

**`HighLatency`**
- Condition: P99 latency > 5 seconds for 5 minutes
- Action: Notify platform team
- Investigation: Review resource utilization, query performance

### Warning Alerts (Slack)

**`PrometheusDown`**
- Condition: Prometheus unreachable for 1 minute
- Action: Alert ops team

**`HighCPUUsage`**
- Condition: CPU usage > 80% for 5 minutes
- Severity: Warning

**`DiskSpaceLow`**
- Condition: < 10% disk space available
- Severity: Warning

**`MemoryUsageHigh`**
- Condition: > 90% memory utilization
- Severity: Warning

## Setup Instructions

### Docker Compose (Recommended)

```bash
# Start monitoring stack
docker-compose -f monitoring/docker-compose-monitoring.yml up -d

# View logs
docker-compose -f monitoring/docker-compose-monitoring.yml logs -f grafana

# Stop services
docker-compose -f monitoring/docker-compose-monitoring.yml down
```

### Manual Setup

1. **Install Prometheus**
   ```bash
   wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
   tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
   cd prometheus-2.45.0.linux-amd64
   cp prometheus.yml /etc/prometheus/
   ./prometheus
   ```

2. **Install Grafana**
   ```bash
   sudo apt-get install grafana-server
   sudo systemctl start grafana-server
   ```

3. **Configure Data Source**
   - Visit http://localhost:3000
   - Add Prometheus data source: http://localhost:9090

4. **Import Dashboards**
   - Upload `monitoring/dashboards/votechain-contracts.json`
   - Configure alerts

## Accessing Dashboards

### Prometheus
- **URL:** http://localhost:9090
- **Metrics Explorer:** Tab -> Graph
- **Alerts:** Tab -> Alerts

### Grafana
- **URL:** http://localhost:3000
- **Main Dashboard:** VoteChain Contracts - Health & Metrics
- **Alert Rules:** Alerting -> Alert Rules

### AlertManager
- **URL:** http://localhost:9093
- **Active Alerts:** Alerts tab

## Configuration

### Environment Variables

```bash
# Slack integration
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# PagerDuty integration
export PAGERDUTY_SERVICE_KEY="pagerduty_key_here"

# Retention policies
export PROMETHEUS_RETENTION_TIME="30d"
export PROMETHEUS_RETENTION_SIZE="50GB"
```

### Prometheus Scrape Intervals

Adjust in `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s       # Default scrape interval
  evaluation_interval: 15s   # Default rule evaluation interval
```

Shorter intervals = higher resolution but more storage/CPU
Longer intervals = lower cost but reduced granularity

### Alert Thresholds

Modify in `monitoring/alerts.yml`:

```yaml
- alert: HighErrorRate
  expr: rate(contract_calls_total{status="error"}[5m]) > 0.05  # 5%
```

## Integration with Services

### Adding Custom Metrics

Export metrics from applications using:

**Prometheus Rust Client:**
```rust
use prometheus::{Counter, Histogram, Registry};

let counter = Counter::new("contract_calls_total", "Total calls")?;
counter.inc();
```

**HTTP Endpoint:**
```
GET /metrics
# HELP contract_calls_total Total number of calls
# TYPE contract_calls_total counter
contract_calls_total{method="transfer"} 1234
```

### Postgres Metrics

Enable postgres-exporter:

```bash
docker run -d \
  -e DATA_SOURCE_NAME="postgresql://user:pass@db:5432/dbname?sslmode=disable" \
  -p 9187:9187 \
  prometheuscommunity/postgres-exporter
```

## Best Practices

1. **Alert Fatigue Prevention**
   - Set appropriate thresholds
   - Use alert aggregation and deduplication
   - Adjust repeat intervals

2. **Metric Naming**
   - Use `_total` suffix for counters
   - Use `_seconds` for latency metrics
   - Include descriptive labels

3. **Dashboard Design**
   - Keep dashboards focused (one per service)
   - Use colors consistently (red=error, yellow=warning)
   - Include alert thresholds on graphs

4. **Data Retention**
   - Balance storage cost vs. historical data needs
   - Archive long-term data to cheaper storage
   - Consider data sampling for older metrics

## Troubleshooting

### Prometheus not scraping metrics

```bash
# Check targets
curl http://localhost:9090/api/v1/targets

# View scrape logs
docker logs votechain-prometheus | grep scrape
```

### Grafana not showing data

```bash
# Verify data source connection
# Settings -> Data Sources -> Prometheus -> Test
# Check metric existence in Prometheus UI
```

### Alerts not firing

```bash
# Check alert rules status
curl http://localhost:9090/api/v1/rules

# Review AlertManager logs
docker logs votechain-alertmanager
```

## Backup and Recovery

### Backup Prometheus Data

```bash
# Stop Prometheus
docker-compose down

# Backup TSDB
tar czf prometheus-backup-$(date +%Y%m%d).tar.gz /prometheus

# Restart
docker-compose up -d
```

### Export Grafana Dashboards

```bash
# Export all dashboards to JSON
for dashboard in $(curl -s http://admin:admin@localhost:3000/api/search | jq -r '.[].id'); do
  curl -s http://admin:admin@localhost:3000/api/dashboards/uid/$(uuidgen) > dashboard-$dashboard.json
done
```

## Performance Tuning

### For High-Volume Metrics

- Reduce retention: `--storage.tsdb.retention.time=7d`
- Increase WAL size: `--storage.tsdb.wal-compression=true`
- Use remote storage: Configure remote write to S3/Thanos

### For Large Dashboards

- Use dashboard refresh intervals > 30s
- Limit panels per dashboard to <20
- Use metric downsampling for historical data

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AlertManager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [Monitoring Best Practices](https://prometheus.io/docs/practices/instrumentation/)

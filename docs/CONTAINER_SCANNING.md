# Container Image Scanning & Hardening

This document describes how Docker images used by VoteChain are scanned for vulnerabilities and hardened before deployment.

---

## Scanning Strategy

All container images are scanned at two points:

1. **Build time** — CI scans images after each build via the `container-scan.yml` workflow.
2. **Scheduled** — Weekly scans detect newly disclosed CVEs in existing images.

### Tool: Trivy

VoteChain uses [Trivy](https://github.com/aquasecurity/trivy) for container vulnerability scanning. Trivy detects CVEs in OS packages, language-specific dependencies, and misconfigurations.

---

## CI Workflow

Add the following workflow at `.github/workflows/container-scan.yml`:

```yaml
name: Container Image Scan

on:
  push:
    branches: [main]
    paths:
      - 'Dockerfile'
      - 'docker-compose*.yml'
      - 'backend/Dockerfile'
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 06:00 UTC
  workflow_dispatch:

jobs:
  scan:
    name: Scan container images
    runs-on: ubuntu-latest
    strategy:
      matrix:
        image:
          - context: "."
            name: votechain-dev
          - context: "./backend"
            name: votechain-backend
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t ${{ matrix.image.name }}:scan ${{ matrix.image.context }}

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.image.name }}:scan'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
          ignore-unfixed: true

      - name: Run Trivy (SARIF for GitHub Security tab)
        if: always()
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.image.name }}:scan'
          format: 'sarif'
          output: 'trivy-${{ matrix.image.name }}.sarif'
          severity: 'CRITICAL,HIGH,MEDIUM'

      - name: Upload SARIF results
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-${{ matrix.image.name }}.sarif'
```

---

## Hardening Checklist

The following practices are applied to all project Dockerfiles:

### Base Image Selection

| Practice | Status | Details |
|----------|--------|---------|
| Use minimal base images | Applied | `rust:1.86-slim-bookworm` instead of full `rust:1.86` |
| Pin base image versions | Applied | Tag includes version + distro variant |
| Prefer `-slim` or `-alpine` variants | Applied | Reduces attack surface by removing unnecessary packages |

### Build Practices

| Practice | Status | Details |
|----------|--------|---------|
| Multi-stage builds | Recommended | Separate build stage from runtime to exclude compilers and source |
| Remove package manager caches | Applied | `rm -rf /var/lib/apt/lists/*` after `apt-get install` |
| Use `--no-install-recommends` | Applied | Only install explicitly required packages |
| Pin dependency versions | Applied | `cargo install --locked` ensures reproducible builds |

### Runtime Practices

| Practice | Recommendation |
|----------|---------------|
| Run as non-root user | Add `RUN useradd -r app` and `USER app` to Dockerfiles |
| Read-only root filesystem | Set `read_only: true` in `docker-compose.yml` where possible |
| Drop all capabilities | Add `cap_drop: [ALL]` in compose; add back only what's needed |
| No new privileges | Add `security_opt: [no-new-privileges:true]` in compose |
| Health checks | Already configured in `docker-compose.yml` |

### Recommended Dockerfile Pattern

```dockerfile
# syntax=docker/dockerfile:1
FROM rust:1.86-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-unknown-unknown
RUN cargo install --locked stellar-cli --features opt

WORKDIR /app
COPY . .
RUN stellar contract build

# --- Runtime stage ---
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -s /usr/sbin/nologin app

COPY --from=builder /app/target/wasm32-unknown-unknown/release/*.wasm /artifacts/

USER app
CMD ["bash"]
```

---

## Viewing Scan Results

| Method | Where |
|--------|-------|
| CI logs | Actions → Container Image Scan → Trivy output table |
| GitHub Security tab | Security → Code scanning alerts (from SARIF upload) |
| Local scan | `docker build -t votechain:scan . && trivy image votechain:scan` |

---

## Responding to Vulnerabilities

| Severity | Response Time | Action |
|----------|--------------|--------|
| **Critical** | Within 48 hours | Upgrade base image or patch dependency. Block deployments until resolved. |
| **High** | Within 1 week | Upgrade at next opportunity. Track in GitHub Issues. |
| **Medium** | Next release cycle | Include in routine dependency updates. |
| **Low** | Best effort | Address during scheduled maintenance. |

### Upgrading Base Images

```bash
# Check for newer base image tags
docker pull rust:1.86-slim-bookworm
docker inspect rust:1.86-slim-bookworm | jq '.[0].Created'

# Rebuild and re-scan
docker build -t votechain:scan .
trivy image votechain:scan
```

---

## Maintenance

- Review and update base image versions quarterly.
- Check Trivy scan results after each CI run.
- When adding new Dockerfiles, add them to the `container-scan.yml` matrix.

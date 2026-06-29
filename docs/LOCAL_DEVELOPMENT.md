# Local Development with Docker Compose

This guide explains how to start the full VoteChain local stack, including the backend, frontend, Stellar node, and supporting services.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- Node.js 20+ (for frontend dev server)
- Rust toolchain with `wasm32-unknown-unknown` target (for contract builds)

## Services Overview

The project has two Compose files:

| File                          | Purpose                                        |
|-------------------------------|-------------------------------------------------|
| `docker-compose.yml`          | Local development stack                         |
| `docker-compose.integration.yml` | Integration tests (contracts + Stellar node) |

### docker-compose.yml Services

| Service        | Image / Build         | Port  | Description                            |
|----------------|-----------------------|-------|----------------------------------------|
| `backend`      | `./backend`           | 3001  | Express API server                     |
| `redis`        | `redis:7-alpine`      | —     | Cache used by the backend              |
| `stellar-node` | `stellar/quickstart`  | 8000  | Local Stellar node with Soroban RPC    |
| `dev`          | `.` (project root)    | —     | Rust dev container (contracts)         |

## Quick Start

### 1. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your local settings. Required variables:

| Variable                     | Default / Example                       | Description                          |
|------------------------------|-----------------------------------------|--------------------------------------|
| `NETWORK`                    | `local`                                 | Network selection                    |
| `STELLAR_RPC_URL`            | `http://localhost:8000`                 | Stellar RPC endpoint                 |
| `STELLAR_NETWORK_PASSPHRASE` | `Standalone Network ; February 2017`    | Must match the network               |
| `STELLAR_SECRET_KEY`         | `S...`                                  | Deployer account secret key          |
| `STELLAR_PUBLIC_KEY`         | `G...`                                  | Deployer account public key          |
| `PORT`                       | `3001`                                  | Backend HTTP port                    |
| `REDIS_URL`                  | `redis://redis:6379`                    | Redis connection (set by Compose)    |

### 2. Start the local stack

```bash
docker compose up -d
```

This starts the backend, Redis, and Stellar node. Wait for health checks to pass:

```bash
docker compose ps
```

All services should show `healthy` status. The Stellar node may take 15-30 seconds to become ready.

### 3. Verify services are running

```bash
# Backend readiness (checks Redis connection)
curl http://localhost:3001/ready

# Backend liveness
curl http://localhost:3001/live

# Stellar node
curl http://localhost:8000/
```

### 4. Start the frontend dev server

The frontend runs outside Docker for faster hot-reload:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts at http://localhost:5173.

### 5. Build and deploy contracts (optional)

To compile and deploy contracts to the local Stellar node:

```bash
# Enter the dev container
docker compose run --rm dev bash

# Inside the container:
stellar contract build
./scripts/deploy.sh
```

Or use the integration Compose file which automates this:

```bash
cp .env.example .env.integration
# Edit .env.integration with your keys

docker compose -f docker-compose.integration.yml up
```

## Service Ports

| Port  | Service                |
|-------|------------------------|
| 3001  | Backend API            |
| 5173  | Frontend (Vite dev)    |
| 8000  | Stellar RPC / Horizon  |
| 6379  | Redis (internal only)  |
| 9090  | Prometheus (monitoring)|
| 3000  | Grafana (monitoring)   |

## Common Commands

```bash
# View logs for a specific service
docker compose logs -f backend

# Rebuild after code changes
docker compose up -d --build backend

# Run backend tests locally
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Run contract tests
cargo test

# Stop everything
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

## Troubleshooting

### Stellar node fails to start

The `stellar/quickstart` image requires the Docker socket and sufficient memory. If it exits immediately:

```bash
docker compose logs stellar-node
```

Common causes:
- **Insufficient memory**: The Stellar node needs ~2GB RAM. Increase Docker's memory limit.
- **Port 8000 in use**: Another process is using port 8000. Stop it or change the port mapping in `docker-compose.yml`.

### Backend shows "unavailable" on /ready

The backend's `/ready` endpoint returns 503 when Redis is not connected:

```bash
# Check if Redis is running
docker compose ps redis

# Verify Redis health
docker compose exec redis redis-cli ping
```

If Redis is healthy but the backend still reports unavailable, restart the backend:

```bash
docker compose restart backend
```

### Contract build fails in dev container

Ensure the Rust toolchain includes the WASM target:

```bash
rustup target add wasm32-unknown-unknown
```

If `stellar contract build` fails with version errors, check that `stellar-cli` matches the version in CI (see `STELLAR_CLI_VERSION` in `.github/workflows/ci.yml`).

### Frontend can't reach the backend

The frontend dev server runs on the host, not in Docker. Ensure the backend is accessible at `http://localhost:3001`. If using a different port, update the frontend's API base URL configuration.

### "Port already in use" errors

Find and stop the process using the port:

```bash
lsof -i :3001   # or whichever port
kill <PID>
```

Or change the port mapping in `docker-compose.yml`.

### Integration tests hang

The integration test runner depends on the contract deployer completing first. If it hangs:

```bash
docker compose -f docker-compose.integration.yml logs contract-deployer
```

The deployer must build WASM artifacts and run `scripts/deploy.sh` before tests start. This can take several minutes on first run due to Cargo dependency downloads.

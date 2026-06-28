# Developer Onboarding Guide

Welcome to VoteChain! This guide takes you from zero to a running local environment and your first pull request.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | — | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21.6.0 (pinned) | `cargo install --locked stellar-cli@21.6.0 --features opt` |
| Docker & Docker Compose | 20+ (optional) | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Node.js | 18+ (frontend/backend) | [nodejs.org](https://nodejs.org/) |

Verify your setup:
```bash
rustc --version                                      # rustc 1.75.0 or later
stellar --version                                    # 21.6.0
rustup target list | grep wasm32-unknown-unknown     # installed
node --version                                       # v18.0.0 or later (if using frontend/backend)
```

---

## Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/Vera3289/votechain-contracts.git
cd votechain-contracts

# 2. Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# 3. Install pinned Stellar CLI
cargo install --locked stellar-cli@21.6.0 --features opt

# 4. (Optional) Install frontend/backend dependencies
cd frontend && npm install && cd ..

# 5. Run all contract tests (no running node required)
make test

# 6. Build WASM binaries
make build
```

---

## Repository Structure

```
votechain-contracts/
├── contracts/      # Soroban smart contracts (Rust + WASM)
├── docs/           # Architecture docs, ADRs, security docs, examples
├── frontend/       # React + Vite read-only governance browser
├── backend/        # Off-chain backend service (API, business logic)
├── indexer/        # Event indexer — listens to on-chain events and stores them
├── sdk/            # Packaged JavaScript/TypeScript SDK (@votechain/sdk)
├── api/            # OpenAPI spec and generated API client stubs
├── scripts/        # Deployment and utility shell scripts
├── config/         # Per-environment TOML config (local, testnet, mainnet)
├── Makefile        # Common dev commands (test, build, fmt, lint)
├── Dockerfile      # Dev container definition
└── docker-compose.yml  # Full local environment (node + backend + frontend)
```

### Directory responsibilities

**`contracts/`** — The two Soroban smart contracts that form the core of VoteChain:
- `contracts/governance/` — Proposal lifecycle, voting, finalization, execution, admin ops
- `contracts/token/` — SEP-41-compatible governance token (mint, burn, transfer, allowances)

Key files to read first:
1. `contracts/governance/src/lib.rs` — all public contract functions
2. `contracts/governance/src/types.rs` — `ContractError`, `Vote`, `Proposal`, `ProposalState`
3. `contracts/governance/src/test_helpers.rs` — reusable test utilities

**`docs/`** — All project documentation: ADRs, security docs, lifecycle diagrams, error reference, FAQ, and examples.

**`frontend/`** — React + Vite app for browsing proposals and viewing vote history. Communicates with Soroban contracts via Stellar RPC.

**`backend/`** — Off-chain service providing aggregated data and business logic not suited for on-chain storage.

**`indexer/`** — Listens to Soroban contract events and writes them to an off-chain store for fast querying.

**`sdk/`** — The `@votechain/sdk` npm package. Wraps contract invocations with typed helpers for JavaScript/TypeScript consumers.

**`api/`** — OpenAPI specification and generated client stubs used by the frontend and external integrators.

**`scripts/`** — Shell scripts for deploying contracts (`deploy.sh`, `deploy_mainnet.sh`) and testing WASM builds (`test_wasm.sh`).

**`config/`** — Network-specific configuration loaded by scripts and the backend:
- `local.toml` — local Stellar node (Docker)
- `testnet.toml` — Stellar Testnet
- `mainnet.toml` — Stellar Mainnet

---

## Running Local Services

### Full environment with Docker Compose

```bash
# Start local Stellar node + backend + frontend
docker compose up
```

Services started:
| Service | URL |
|---------|-----|
| Local Stellar RPC | `http://localhost:8000` |
| Backend API | `http://localhost:3000` |
| Frontend (Vite) | `http://localhost:5173` |

### Run individual services

```bash
# Run only the local Stellar node
docker compose up stellar-node

# Run contracts tests inside the container
docker compose run --rm dev make test

# Build WASM inside the container
docker compose run --rm dev make build

# Deploy contracts to the local node
docker compose run --rm dev bash -c "NETWORK=local ./scripts/deploy.sh"
```

### Frontend without Docker

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### Backend without Docker

```bash
cd backend
npm install
npm run dev   # http://localhost:3000
```

---

## Common Issues

> For a comprehensive list of issues and solutions, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

### WASM target missing

**Symptom:** `error[E0463]: can't find crate for 'std'` when building contracts.

**Fix:**
```bash
rustup target add wasm32-unknown-unknown
```

---

### Stellar CLI version mismatch

**Symptom:** `stellar` command not found, or version is not `21.6.0`.

**Fix:**
```bash
cargo install --locked stellar-cli@21.6.0 --features opt
stellar --version   # must print 21.6.0
```

Do not install a different version — the CLI is pinned to avoid breaking changes.

---

### Docker not running

**Symptom:** `docker compose up` fails with `Cannot connect to the Docker daemon`.

**Fix:** Start Docker Desktop (macOS/Windows) or the Docker daemon (Linux):
```bash
sudo systemctl start docker   # Linux
```

---

### Port conflicts

**Symptom:** `address already in use` when starting services.

**Common ports:** `8000` (Stellar RPC), `3000` (backend), `5173` (frontend).

**Fix:** Find and stop the conflicting process:
```bash
lsof -i :8000    # find process using port 8000
kill <PID>
```

Or override ports via environment variables before running `docker compose up`.

---

### `git index.lock` error

**Symptom:** `fatal: Unable to create '.git/index.lock': File exists.`

**Fix:**
```bash
rm .git/index.lock
```

---

## Development Workflow

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/proposal-cooldown` |
| Bug fix | `fix/<issue-id>-<description>` | `fix/123-double-vote` |
| Tests | `test/<issue-id>-<description>` | `test/294-concurrent-voting` |
| Docs | `docs/<issue-id>-<description>` | `docs/514-onboarding-guide` |
| CI/DevOps | `ci/<description>` | `ci/update-rust-cache` |

### Make commands

```bash
make test        # Run all unit + property-based tests
make build       # Compile WASM binaries
make fmt         # Format code with rustfmt
make fmt-check   # Check formatting without modifying files
make lint        # Run Clippy (must pass with zero warnings)
make clean       # Remove build artifacts
make doc         # Generate and open rustdoc
```

### Pre-PR checklist

- [ ] `make fmt` — no formatting issues
- [ ] `make lint` — zero Clippy warnings
- [ ] `make test` — all tests pass
- [ ] New functions have tests; bug fixes include a regression test
- [ ] New `.rs` files include the Apache 2.0 license header (copy from any existing file)
- [ ] Commit message follows: `type: short description (#issue-id)`
  - Types: `feat`, `fix`, `test`, `docs`, `ci`, `refactor`

---

## Getting Help

- **[GitHub Discussions](https://github.com/Vera3289/votechain-contracts/discussions)** — ask questions and propose ideas
- **[GitHub Issues](https://github.com/Vera3289/votechain-contracts/issues)** — report bugs or request features
- **`docs/adr/`** — Architecture Decision Records explaining every major design choice with context and trade-offs
- **`docs/faq.md`** — answers to common questions
- **Inline comments** — `// SAFETY:` and `// INVARIANT:` markers explain non-obvious decisions in the code
- **Security reports** — [security@votechain.dev](mailto:security@votechain.dev)

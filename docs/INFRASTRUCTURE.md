# Infrastructure Automation

This document describes the automated provisioning and deployment scripts for VoteChain contracts across different environments.

## Overview

The infrastructure automation system provides idempotent scripts for setting up development, test, staging, and production environments. All scripts are designed to be safe, repeatable, and support both native Linux and containerized Docker workflows.

## Scripts

### `scripts/utils.sh`

Shared utility functions used by all provisioning scripts.

**Functions:**
- `log_info()` - Print info messages
- `log_success()` - Print success messages
- `log_warning()` - Print warning messages
- `log_error()` - Print error messages
- `command_exists()` - Check if a command is available
- `require_command()` - Require a command or fail
- `require_commands()` - Require multiple commands
- `detect_os()` - Detect operating system
- `install_deps()` - Install OS-level dependencies
- `is_in_container()` - Check if running in Docker
- `retry()` - Retry logic with exponential backoff

**Usage:**
```bash
source scripts/utils.sh
log_info "Setting up environment..."
```

### `scripts/setup-environment.sh`

Main provisioning script that sets up the complete environment for any deployment target.

**Environments:**
- `dev` - Local development environment
- `test` - Testing environment with CI integration
- `staging` - Containerized staging environment
- `production` - Production environment (Docker-based)

**Features:**
- Detects and installs Rust toolchain
- Installs Stellar CLI
- Configures WASM build target
- Runs tests
- Idempotent (safe to run multiple times)
- Automatic dependency detection and installation

**Usage:**
```bash
# Setup development environment
./scripts/setup-environment.sh dev

# Setup test environment
./scripts/setup-environment.sh test

# Setup staging environment
./scripts/setup-environment.sh staging

# Setup production environment
./scripts/setup-environment.sh production
```

### `scripts/deploy-test-env.sh`

Deploys contracts and runs tests in the test environment.

**Features:**
- Builds test environment automatically
- Compiles all contracts
- Runs integration tests
- Copies WASM artifacts to deployment directory
- Idempotent deployment

**Usage:**
```bash
./scripts/deploy-test-env.sh
```

**Configuration:**
- `DEPLOY_DIR` - Directory for test artifacts (default: `/opt/votechain-test`)
- `BUILD_ARTIFACTS_DIR` - Source directory for build artifacts

### `scripts/deploy-staging-env.sh`

Deploys contracts to staging environment using Docker Compose.

**Features:**
- Builds Docker images
- Starts containerized services
- Verifies service health
- Provides logging and monitoring capabilities

**Usage:**
```bash
./scripts/deploy-staging-env.sh
```

**Configuration:**
- `DOCKER_COMPOSE_FILE` - Docker Compose file path
- `NETWORK_NAME` - Docker network name (default: `votechain-staging`)
- `ENVIRONMENT` - Environment name (default: `staging`)

## Docker Setup

### `Dockerfile`

Containerized build environment for contracts.

**Features:**
- Rust toolchain with WASM support
- Stellar CLI installation
- Automatic contract building
- Minimal production image size

### `docker-compose.yml`

Multi-service orchestration for staging environment.

**Services:**
1. **stellar-rpc** - Stellar testnet RPC node
   - Port: 11625 (peer protocol), 11626 (HTTP)
   - Health checks enabled
   - Network: `votechain-network`

2. **postgres** - PostgreSQL database (optional)
   - Port: 5432
   - Database: `votechain`
   - User: `votechain`
   - Persistent volumes

3. **contract-deploy** - Contract deployment service
   - Builds and tests contracts
   - Connects to Stellar RPC
   - Volume mounts for live development

**Usage:**
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

## Idempotency

All scripts are designed to be idempotent, meaning they can be run multiple times safely:

1. **Dependency detection** - Checks if tools are already installed before installing
2. **Directory checks** - Creates directories only if they don't exist
3. **Health checks** - Verifies service health before proceeding
4. **Atomic operations** - Uses temporary files and atomic renames where necessary

Example:
```bash
# Safe to run multiple times
./scripts/setup-environment.sh dev
./scripts/setup-environment.sh dev  # Same result, no re-installation
```

## Environment Variables

### Build Configuration
- `RUST_VERSION` - Rust version to install (default: `stable`)
- `STELLAR_CLI_VERSION` - Stellar CLI version (default: `latest`)

### Deployment Configuration
- `DEPLOY_DIR` - Test environment deployment directory
- `DOCKER_COMPOSE_FILE` - Path to docker-compose file
- `NETWORK_NAME` - Docker network name
- `ENVIRONMENT` - Environment type

### Logging
- `LOG_LEVEL` - Logging verbosity

## Supported Platforms

### Linux
- Ubuntu 20.04+
- Debian 11+
- CentOS 8+
- Any system with `apt-get` or `yum`

### Containerized
- Docker 20.10+
- Docker Compose 1.29+ or Docker Compose v2

### macOS
- Basic support (Rust installation)
- Docker support via Docker Desktop

## Quick Start

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/Vera3289/votechain-contracts.git
cd votechain-contracts

# 2. Setup development environment
./scripts/setup-environment.sh dev

# 3. Build contracts
cargo build

# 4. Run tests
cargo test
```

### Docker-based Development

```bash
# 1. Clone repository
git clone https://github.com/Vera3289/votechain-contracts.git
cd votechain-contracts

# 2. Start staging environment
./scripts/deploy-staging-env.sh

# 3. View services
docker-compose ps

# 4. Check logs
docker-compose logs contract-deploy
```

## Troubleshooting

### Permission Denied
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

### Cargo not found
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Docker daemon not running
```bash
# Start Docker (macOS)
open /Applications/Docker.app

# Start Docker (Linux)
sudo systemctl start docker
```

### Port conflicts
```bash
# Change ports in docker-compose.yml or use different compose file
DOCKER_COMPOSE_FILE=docker-compose.alt.yml ./scripts/deploy-staging-env.sh
```

## CI/CD Integration

These scripts integrate seamlessly with CI/CD pipelines:

```yaml
# GitHub Actions example
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/setup-environment.sh test
```

## Performance Optimization

### Build Caching
- Cargo registry caching (see `docs/CI_CACHING.md`)
- Docker layer caching in docker-compose
- Volume mounts for development

### Parallel Jobs
- Multiple environment setups can run in parallel
- Docker Compose parallelizes service startup

## Security Considerations

1. **Credentials** - Never commit secrets; use environment variables
2. **Container Images** - Scan images for vulnerabilities
3. **Network Security** - Use Docker networks for service isolation
4. **Access Control** - Restrict script execution to authorized users

## Future Enhancements

1. **Kubernetes Support** - Add k8s manifests for production
2. **Terraform Integration** - Infrastructure as Code
3. **Monitoring** - Add Prometheus/Grafana integration
4. **Multi-region** - Support for multiple deployment regions

## References

- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Stellar CLI Documentation](https://developers.stellar.org/tools/cli)
- [Docker Documentation](https://docs.docker.com)
- [Docker Compose Documentation](https://docs.docker.com/compose)

#!/usr/bin/env bash
# Deploy to the dedicated `staging` environment
set -euo pipefail

NETWORK=staging ./scripts/deploy.sh

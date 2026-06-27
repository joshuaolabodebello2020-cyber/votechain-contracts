#!/bin/bash

# Common utility functions for infrastructure scripts
# Usage: source scripts/utils.sh

set -euo pipefail

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required commands
require_command() {
    local cmd="$1"
    local package="${2:-$cmd}"
    
    if ! command_exists "$cmd"; then
        log_error "Required command '$cmd' not found. Install it with: apt-get install $package"
        return 1
    fi
}

# Check all required commands
require_commands() {
    local failed=0
    for cmd in "$@"; do
        if ! require_command "$cmd"; then
            failed=1
        fi
    done
    return $failed
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "Linux";;
        Darwin*)    echo "macOS";;
        CYGWIN*)    echo "Cygwin";;
        MINGW*)     echo "MinGw";;
        *)          echo "UNKNOWN";;
    esac
}

# Install dependencies based on OS
install_deps() {
    local os=$(detect_os)
    
    case "$os" in
        Linux)
            if command_exists apt-get; then
                log_info "Installing dependencies with apt-get..."
                sudo apt-get update
                sudo apt-get install -y build-essential curl git
            elif command_exists yum; then
                log_info "Installing dependencies with yum..."
                sudo yum groupinstall -y "Development Tools"
                sudo yum install -y curl git
            fi
            ;;
        *)
            log_warning "OS $os not fully supported for auto-installation"
            ;;
    esac
}

# Check if running in container
is_in_container() {
    [ -f /.dockerenv ] || [ -f /run/.containerenv ]
}

# Retry logic
retry() {
    local max_attempts=3
    local timeout=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            log_warning "Attempt $attempt failed. Retrying in ${timeout}s..."
            sleep $timeout
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Failed after $max_attempts attempts"
    return 1
}

# Cleanup on exit
setup_cleanup() {
    local cleanup_cmd="$1"
    trap "$cleanup_cmd" EXIT
}

# Export functions for use in other scripts
export -f log_info log_success log_warning log_error
export -f command_exists require_command require_commands
export -f detect_os install_deps is_in_container retry setup_cleanup

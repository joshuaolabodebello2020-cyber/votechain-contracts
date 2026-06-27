.PHONY: build test coverage coverage-frontend coverage-backend coverage-all fmt fmt-check lint clean deploy-testnet check-stellar-cli help

STELLAR_CLI_VERSION := 21.6.0

## build: Compile contracts to WASM (release)
build:
	stellar contract build

## test: Run all unit tests
test:
	cargo test

## coverage: Generate Rust coverage report (requires cargo-llvm-cov)
coverage:
	cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info
	cargo llvm-cov --all-features --workspace --summary-only

## coverage-frontend: Generate frontend coverage report
coverage-frontend:
	cd frontend && npm run test:coverage

## coverage-backend: Generate backend coverage report
coverage-backend:
	cd backend && npm run test:coverage

## coverage-all: Run all coverage reports
coverage-all: coverage coverage-frontend coverage-backend

## fmt: Auto-format all source files
fmt:
	cargo fmt

## fmt-check: Verify formatting without modifying files (used in CI)
fmt-check:
	cargo fmt --check

## lint: Run Clippy and fail on any warning
lint:
	cargo clippy --all-targets -- -D warnings

## clean: Remove build artefacts
clean:
	cargo clean

## deploy-testnet: Build and deploy both contracts to Stellar Testnet
deploy-testnet:
	NETWORK=testnet ./scripts/deploy.sh

## check-stellar-cli: Verify the installed stellar-cli matches the required version
check-stellar-cli:
	@INSTALLED=$$(stellar --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1); \
	if [ -z "$$INSTALLED" ]; then \
		echo "ERROR: stellar-cli not found. Install with:"; \
		echo "  cargo install --locked stellar-cli@$(STELLAR_CLI_VERSION) --features opt"; \
		exit 1; \
	elif [ "$$INSTALLED" != "$(STELLAR_CLI_VERSION)" ]; then \
		echo "ERROR: stellar-cli $$INSTALLED found, but $(STELLAR_CLI_VERSION) is required."; \
		echo "  cargo install --locked stellar-cli@$(STELLAR_CLI_VERSION) --features opt"; \
		exit 1; \
	else \
		echo "stellar-cli $(STELLAR_CLI_VERSION) OK"; \
	fi

## load-test-backend: Run k6 load test against the backend API (requires k6)
load-test-backend:
	k6 run load-tests/backend.js

## load-test-indexer: Run k6 load test against the indexer (requires k6)
load-test-indexer:
	k6 run load-tests/indexer.js

## help: List all available targets
help:
	@grep -E '^## ' Makefile | sed 's/^## //' | column -t -s ':'

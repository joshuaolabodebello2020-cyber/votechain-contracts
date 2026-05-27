.PHONY: build test fmt fmt-check lint clean deploy-testnet check-stellar-cli help

STELLAR_CLI_VERSION := 21.6.0

## build: Compile contracts to WASM (release)
build:
	stellar contract build

## test: Run all unit tests
test:
	cargo test

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

## help: List all available targets
help:
	@grep -E '^## ' Makefile | sed 's/^## //' | column -t -s ':'

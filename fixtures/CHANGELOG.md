# Changelog

All notable changes to the Stellar RPC Fixture Library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-06-28

### Added
- Initial release of Stellar RPC Fixture Library
- Mock RPC server with all major Soroban RPC methods
- Fixtures for:
  - `getAccount` - Account data responses
  - `getContractData` - Contract storage data responses
  - `simulateTransaction` - Transaction simulation responses
  - `sendTransaction` - Transaction submission responses
  - `getLedger` / `getLatestLedger` - Ledger data responses
- Helper functions for creating custom responses
- Example test demonstrating fixture usage
- TypeScript type definitions
- Comprehensive documentation

### Supported SDK Version
- `@stellar/stellar-sdk` >= 12.0.0

## [Unreleased]

### Planned
- Add fixtures for additional RPC methods as needed
- Add fixture validation tests

# Setup Guide for RPC Fixture Library

This guide explains how to set up and use the RPC fixture library in the VoteChain monorepo.

## Initial Setup

### 1. Install Dependencies

```bash
cd fixtures
npm install
```

### 2. Build the Library

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Integration with Backend

### Step 1: Add as Local Dependency

Edit `backend/package.json`:

```json
{
  "dependencies": {
    "@votechain/fixtures": "file:../fixtures"
  }
}
```

### Step 2: Install the Dependency

```bash
cd backend
npm install
```

### Step 3: Create Test File

Create or update test files in `backend/src/test/` to use the fixtures:

```typescript
import { mockRpcServer, MockRpcServer, createProposalCountResponse } from '@votechain/fixtures';
import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Your Test Suite', () => {
  let mockServer: MockRpcServer;

  beforeEach(() => {
    mockServer = mockRpcServer();
  });

  it('your test case', async () => {
    mockServer.getContractData.mockResolvedValue(
      createProposalCountResponse(42)
    );
    // ... your test logic
  });
});
```

### Step 4: Run Tests

```bash
cd backend
npm test
```

## Integration with SDK

### Step 1: Add as Local Dependency

Edit `sdk/package.json`:

```json
{
  "dependencies": {
    "@votechain/fixtures": "file:../fixtures"
  }
}
```

### Step 2: Install the Dependency

```bash
cd sdk
npm install
```

### Step 3: Create Test File

Create test files in `sdk/` to use the fixtures:

```typescript
import { mockRpcServer, MockRpcServer, createGetProposalSimulationResponse } from '@votechain/fixtures';
import { VoteChainSDK } from '@votechain/sdk';

describe('VoteChainSDK', () => {
  let mockServer: MockRpcServer;
  let sdk: VoteChainSDK;

  beforeEach(() => {
    mockServer = mockRpcServer();
    sdk = new VoteChainSDK({
      rpcUrl: 'mock://rpc',
      networkPassphrase: 'Test SDF Network ; September 2015',
      governanceContractId: 'TEST_CONTRACT_ID',
    });
    (sdk as any).server = mockServer.server;
  });

  it('your test case', async () => {
    mockServer.simulateTransaction.mockResolvedValue(
      createGetProposalSimulationResponse(1, 'Test', 'Active')
    );
    // ... your test logic
  });
});
```

### Step 4: Run Tests

```bash
cd sdk
npm test
```

## Troubleshooting

### TypeScript Errors

If you see "Cannot find module '@votechain/fixtures'" errors:

1. Ensure the fixtures library is built: `cd fixtures && npm run build`
2. Ensure the dependency is installed in the consuming project
3. Check that the `file:../fixtures` path is correct relative to the consuming project

### Mock Not Working

If mocks aren't being applied:

1. Ensure you're calling `mockRpcServer()` before the test
2. Verify you're replacing the actual server with the mock (for SDK tests)
3. Check that the mock is being called with the correct arguments

### Version Conflicts

If you have version conflicts with `@stellar/stellar-sdk`:

1. Ensure the fixtures library and consuming projects use compatible versions
2. The fixtures library specifies `@stellar/stellar-sdk >= 12.0.0` as a peer dependency
3. Update consuming projects to use a compatible version if needed

## Development Workflow

When making changes to fixtures:

1. Edit fixture files in `fixtures/src/fixtures/`
2. Run `npm run build` in the fixtures directory
3. Reinstall in consuming projects if needed: `cd backend && npm install`
4. Run tests to verify changes

## CI/CD Integration

For CI/CD pipelines, ensure the fixtures library is built before running tests:

```yaml
# Example GitHub Actions
- name: Build fixtures
  run: |
    cd fixtures
    npm install
    npm run build

- name: Install backend dependencies
  run: |
    cd backend
    npm install

- name: Run backend tests
  run: |
    cd backend
    npm test
```

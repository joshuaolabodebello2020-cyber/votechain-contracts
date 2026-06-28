# Stellar RPC Fixture Library

Deterministic mock responses for Stellar/Soroban RPC calls to enable reliable offline testing.

## Version

**Current Version:** 1.0.0

## Overview

This fixture library provides pre-canned, deterministic responses for common Stellar RPC calls. It enables backend and SDK tests to run without requiring a live Stellar RPC node, ensuring tests are:
- **Deterministic** - Same input always produces same output
- **Offline-capable** - No network calls required
- **Fast** - No network latency
- **Reliable** - No flakiness from network issues

## Installation

### As a Local Package

For development within the VoteChain monorepo:

```bash
cd fixtures
npm install
npm run build
```

Then add to your project's `package.json`:

```json
{
  "dependencies": {
    "@votechain/fixtures": "file:../fixtures"
  }
}
```

### As a Published Package

When published to npm:

```bash
npm install @votechain/fixtures
```

## Supported RPC Methods

| Method | Status | Fixture File |
|--------|--------|--------------|
| `getAccount` | ✅ | `account.fixture.ts` |
| `getContractData` | ✅ | `contractData.fixture.ts` |
| `simulateTransaction` | ✅ | `simulation.fixture.ts` |
| `sendTransaction` | ✅ | `transaction.fixture.ts` |
| `getLedger` | ✅ | `ledger.fixture.ts` |
| `getLatestLedger` | ✅ | `ledger.fixture.ts` |

## Usage

### Backend Tests (Vitest)

```typescript
import { mockRpcServer, MockRpcServer, createProposalCountResponse } from '@votechain/fixtures';
import { rpc as StellarRpc, xdr } from '@stellar/stellar-sdk';

describe('Proposal fetching', () => {
  let mockServer: MockRpcServer;

  beforeEach(() => {
    mockServer = mockRpcServer();
  });

  it('fetches proposal count from contract', async () => {
    // Mock the RPC response
    mockServer.getContractData.mockResolvedValue(
      createProposalCountResponse(42)
    );

    // Call your service that uses getRpcServer
    const count = await fetchProposalCount();
    expect(count).toBe(42);
  });
});
```

### SDK Tests (Jest/Vitest)

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
    // Replace the SDK's server with mock
    (sdk as any).server = mockServer.server;
  });

  it('gets proposal data', async () => {
    mockServer.simulateTransaction.mockResolvedValue(
      createGetProposalSimulationResponse(1, 'Test Proposal', 'Active')
    );

    const proposal = await sdk.getProposal(1n, 'TEST_ADDRESS');
    expect(proposal).toBeDefined();
  });
});
```

## Fixture Structure

Each fixture file exports:
- `defaultResponse` - The standard response shape
- `errorResponse` - Error response shape
- `create*Response(...)` - Function to generate custom responses

### Example: account.fixture.ts

```typescript
import { Account } from '@stellar/stellar-sdk';

export const defaultAccountResponse: Account = {
  accountId: 'GD5...TEST',
  balance: '10000000',
  sequence: '1234567890',
  // ... other fields
};

export const createAccountResponse = (
  overrides?: Partial<Account>
): Account => {
  return { ...defaultAccountResponse, ...overrides };
};
```

## Available Fixtures

### Account Fixtures

```typescript
import { createAccountResponse, accountNotFoundResponse } from '@votechain/fixtures';

// Custom account
const account = createAccountResponse({
  accountId: 'GD5...CUSTOM',
  balance: '50000000',
});

// Not found error
const error = accountNotFoundResponse;
```

### Contract Data Fixtures

```typescript
import {
  createProposalCountResponse,
  createProposalDataResponse
} from '@votechain/fixtures';

// Proposal count in instance storage
const countResponse = createProposalCountResponse(42);

// Specific proposal data
const proposalResponse = createProposalDataResponse(1, 'Test', 'Active');
```

### Simulation Fixtures

```typescript
import {
  createSimulationSuccessResponse,
  createSimulationErrorResponse,
  createGetProposalSimulationResponse,
  createHasVotedSimulationResponse
} from '@votechain/fixtures';

// Success with custom retval
const success = createSimulationSuccessResponse(myScVal);

// Error response
const error = createSimulationErrorResponse('Insufficient fee');

// Pre-built for get_proposal
const proposalSim = createGetProposalSimulationResponse(1, 'Title', 'Active');

// Pre-built for has_voted
const votedSim = createHasVotedSimulationResponse(true);
```

### Transaction Fixtures

```typescript
import {
  createSendTransactionSuccessResponse,
  createSendTransactionErrorResponse
} from '@votechain/fixtures';

// Success
const success = createSendTransactionSuccessResponse('abc123');

// Error
const error = createSendTransactionErrorResponse('tx_failed');
```

### Ledger Fixtures

```typescript
import {
  createLedgerResponse,
  defaultLedgerResponse,
  latestLedgerResponse
} from '@votechain/fixtures';

// Custom ledger
const ledger = createLedgerResponse(100, 1234567890);

// Defaults
const defaultLedger = defaultLedgerResponse;
const latestLedger = latestLedgerResponse;
```

## Versioning

When RPC response formats change:
1. Increment version in `package.json`
2. Update fixture files to match new format
3. Add migration notes in CHANGELOG.md
4. Tag release in git

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Adding New Fixtures

1. Create fixture file in `src/fixtures/` directory
2. Export default response
3. Export custom response generator function
4. Add to this README's supported methods table
5. Add usage example
6. Export from `src/index.ts`

## Testing the Fixtures

```bash
# Build the library
npm run build

# Run fixture validation tests
npm test

# Run with coverage
npm run test:coverage
```

## Maintenance

- Keep fixtures in sync with `@stellar/stellar-sdk` versions
- Update when Stellar RPC API changes
- Review quarterly for stale data
- Update this README when adding new fixtures

## Dependencies

- `@stellar/stellar-sdk` >= 12.0.0 (peer dependency)
- `typescript` >= 5.0.0
- `vitest` >= 2.0.0 (dev dependency)

## License

MIT

# Frontend Integration Guide

This guide explains how the VoteChain frontend interacts with Soroban smart contracts and the backend API to deliver governance flows.

---

## Architecture Overview

```
Browser (React + Vite)
    │
    ├── Stellar RPC (JSON-RPC 2.0)  ──► Soroban contracts on-chain
    │       read-only queries, tx simulation & submission
    │
    └── Backend API (Express :3001)  ──► Redis-cached indexer queries
            GET /api/proposals
            GET /api/proposals/:id
            GET /api/governance/stats
```

- **Contract calls** use `@stellar/stellar-sdk` against the Soroban RPC endpoint configured in the app store.
- **Read-heavy queries** (proposal list, vote history) go through the backend API which caches responses in Redis.
- **On-chain events** are ingested by the Rust indexer and surfaced through both the backend API and the indexer's own REST endpoints (`:4000`).

---

## Prerequisites

```bash
cd frontend
npm install
cp ../.env.example .env   # set VITE_SOROBAN_RPC_URL, VITE_GOVERNANCE_CONTRACT_ID, VITE_TOKEN_CONTRACT_ID
npm run dev
```

Required environment variables (set in `frontend/.env` or the Vite config):

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban JSON-RPC endpoint |
| `VITE_GOVERNANCE_CONTRACT_ID` | `CDO5V...V6P2` | Deployed governance contract address |
| `VITE_TOKEN_CONTRACT_ID` | `CAS3...K2M6` | Deployed token contract address |
| `VITE_BACKEND_URL` | `http://localhost:3001` | Backend API base URL |

---

## RPC Connectivity

The frontend validates and checks the RPC endpoint before use (`src/utils/stellarRpc.ts`):

```ts
import { validateRpcUrl, checkRpcHealth } from './utils/stellarRpc';

const result = validateRpcUrl(rpcUrl);
if (!result.isValid) throw new Error(result.error);

const reachable = await checkRpcHealth(rpcUrl);
```

The `RpcStatus` component (`src/components/RpcStatus.tsx`) displays connectivity state in the UI.

---

## Contract Calls

All contract interactions use `@stellar/stellar-sdk`. The pattern is:

1. **Simulate** the transaction to get the result and fee estimate.
2. **Sign** with the user's wallet (Freighter or similar).
3. **Submit** the signed XDR to the network.

### Read: Get a Proposal

```ts
import { Contract, SorobanRpc, xdr } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server(VITE_SOROBAN_RPC_URL);

// Simulate a read call (no signing needed)
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(
    contract.call('get_proposal', xdr.ScVal.scvU64(xdr.Uint64.fromString(proposalId)))
  )
  .setTimeout(30)
  .build();

const result = await server.simulateTransaction(tx);
// Decode the returned XDR
const proposal = scValToNative(result.result.retval);
```

### Write: Cast a Vote

```ts
// 1. Build the operation
const voteVal = xdr.ScVal.scvVec([
  xdr.ScVal.scvSymbol('Yes'),   // Vote::Yes | Vote::No | Vote::Abstain
]);

const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(
    contract.call(
      'cast_vote',
      nativeToScVal(voterAddress, { type: 'address' }),
      xdr.ScVal.scvU64(xdr.Uint64.fromString(proposalId)),
      voteVal,
    )
  )
  .setTimeout(30)
  .build();

// 2. Simulate
const simResult = await server.simulateTransaction(tx);
const assembled = SorobanRpc.assembleTransaction(tx, simResult);

// 3. Sign (Freighter)
const { signedXDR } = await signTransaction(assembled.toXDR(), { network: 'TESTNET' });

// 4. Submit
const sendResult = await server.sendTransaction(
  TransactionBuilder.fromXDR(signedXDR, networkPassphrase)
);
```

### Write: Create a Proposal

```ts
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(
    contract.call(
      'create_proposal',
      nativeToScVal(proposerAddress, { type: 'address' }),
      nativeToScVal(title, { type: 'string' }),
      nativeToScVal(description, { type: 'string' }),
      nativeToScVal(quorum, { type: 'i128' }),
      nativeToScVal(durationSecs, { type: 'u64' }),
    )
  )
  .setTimeout(30)
  .build();
```

### Write: Finalise a Proposal

```ts
contract.call('finalise', xdr.ScVal.scvU64(xdr.Uint64.fromString(proposalId)))
```

---

## Backend API Integration

Use the backend for cached reads. All endpoints are under `/api`.

### List proposals

```ts
const res = await fetch(`${VITE_BACKEND_URL}/api/proposals?limit=20&page=1&status=Active`);
const proposals = await res.json();
```

Response: array of `ProposalSummary` (see [`docs/api-reference.md`](api-reference.md)).

### Get proposal detail

```ts
const res = await fetch(`${VITE_BACKEND_URL}/api/proposals/${id}`);
if (res.status === 404) throw new Error('Proposal not found');
const proposal = await res.json();
```

### Get vote history for a voter

```ts
const res = await fetch(`${VITE_BACKEND_URL}/api/voters/${address}/votes`);
const votes = await res.json();
```

### Governance stats

```ts
const res = await fetch(`${VITE_BACKEND_URL}/api/governance/stats`);
const stats = await res.json();
// { byState, participationOverTime, topVoters, avgQuorumAchievement }
```

---

## Event Handling

On-chain events are ingested by the indexer. The frontend can query recent events from the indexer API (`:4000`) or poll the backend.

### Query events for a proposal

```ts
const res = await fetch(`http://localhost:4000/events/proposals/${proposalId}`);
const events = await res.json();
// [{ id, ledger_seq, tx_hash, topic, proposal_id, payload, ingested_at }]
```

### React to a `vote` event

```ts
for (const ev of events) {
  if (ev.topic === 'vote') {
    const { voter, vote, weight } = ev.payload;
    // update local vote tallies
  }
  if (ev.topic === 'final') {
    const { state } = ev.payload;   // "Passed" | "Rejected"
    // refresh proposal state in store
  }
}
```

### Polling pattern (hook)

The `useProposals` hook (`src/hooks/useProposals.ts`) exposes a `refresh()` callback. Call it after any write transaction resolves:

```ts
const { proposals, loading, refresh } = useProposals();

async function handleVote(vote: 'Yes' | 'No' | 'Abstain') {
  await submitVoteTransaction(vote);
  await refresh();   // re-fetch from backend
}
```

---

## State Update Flow

```
User action (e.g. cast vote)
    │
    ▼
Build + simulate transaction  ──► Soroban RPC
    │
    ▼
Sign with wallet (Freighter)
    │
    ▼
Submit transaction  ──► Soroban RPC
    │
    ▼
Poll sendTransaction result until status = SUCCESS
    │
    ▼
Call refresh() ──► GET /api/proposals/:id  ──► Redis cache or indexer
    │
    ▼
useProposalStore.setProposals(updated)  ──► React re-render
```

Optimistic updates are applied immediately in the Zustand store (`src/store/index.ts`) via `useOptimisticVote` (`src/hooks/useOptimisticVote.ts`), then reconciled when the confirmed state returns from the API.

---

## Integration Map

| Frontend component / hook | Contract function | Backend endpoint |
|---------------------------|-------------------|-----------------|
| `ProposalList` page | — | `GET /api/proposals` |
| `ProposalDetail` page | `get_proposal` | `GET /api/proposals/:id` |
| `VotingPanel` page | `cast_vote` | — (write, no cache) |
| `VoteHistoryPage` | — | `GET /api/voters/:address/votes` |
| `GovernanceDashboard` | — | `GET /api/governance/stats` |
| `AdminPanel` | `execute`, `cancel`, `update_quorum` | — (writes) |
| `useProposals` hook | — | `GET /api/proposals` |
| `useOptimisticVote` hook | `cast_vote` | — |
| `RpcStatus` component | health check | — |

---

## Error Handling

Contract calls return `ContractError` codes on failure. Map them to user-facing messages:

```ts
function parseContractError(err: unknown): string {
  const msg = String(err);
  if (msg.includes('AlreadyVoted'))    return 'You have already voted on this proposal.';
  if (msg.includes('VotingPeriodEnded')) return 'The voting period has ended.';
  if (msg.includes('NoVotingPower'))   return 'You have no governance tokens.';
  if (msg.includes('ContractPaused')) return 'Governance is currently paused.';
  return 'Transaction failed. Please try again.';
}
```

Full error code list: [`docs/errors.md`](errors.md).

---

## Further Reading

- [ABI Reference](abi-reference.md) — contract function signatures and types
- [API Reference](api-reference.md) — backend and indexer REST endpoints
- [Event Reference](events.md) — on-chain event schemas
- [JavaScript Examples](examples/javascript.md) — additional SDK usage patterns
- [Soroban Gotchas](soroban-gotchas.md) — common pitfalls when building on Soroban

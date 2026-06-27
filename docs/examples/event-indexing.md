# Event Indexing Guide

This guide explains how to subscribe to and index VoteChain on-chain events using the Stellar Horizon API or a custom indexer.

---

## Event Schema

All VoteChain events are emitted via `env.events().publish(topics, data)`. Topics are XDR-encoded tuples; the first element is always a `Symbol` used for filtering.

### Governance Contract Events

| Event | Topic 0 | Topic 1 | Data |
|---|---|---|---|
| Contract initialized | `"init"` | — | `admin: Address` |
| Proposal created | `"created"` | `id: u64` | `proposer: Address` |
| Vote cast | `"vote"` | `id: u64` | `(voter: Address, vote: Vote, weight: i128)` |
| Proposal finalised | `"final"` | `id: u64` | `(state: ProposalState, execute_after: u64)` |
| Proposal executed | `"executed"` | `id: u64` | `()` |
| Proposal cancelled | `"cancelled"` | `id: u64` | `()` |
| Quorum updated | `"qupdate"` | `id: u64` | `new_quorum: i128` |
| Admin transferred | `"admxfer"` | — | `(old_admin: Address, new_admin: Address)` |
| Admin transfer proposed | `"admprop"` | — | `(admin: Address, nominee: Address, expiry: u64)` |
| Contract paused | `"paused"` | — | `admin: Address` |
| Contract unpaused | `"unpaused"` | — | `admin: Address` |
| Contract upgraded | `"upgraded"` | — | `(old_version: (u32,u32,u32), new_version: (u32,u32,u32))` |

### Token Contract Events

| Event | Topic 0 | Topic 1 | Topic 2 | Data |
|---|---|---|---|---|
| Tokens minted | `"mint"` | `to: Address` | — | `amount: i128` |
| Tokens transferred | `"transfer"` | `from: Address` | `to: Address` | `amount: i128` |
| Tokens burned | `"burn"` | `from: Address` | — | `amount: i128` |
| Admin transferred | `"admxfer"` | — | — | `(old_admin: Address, new_admin: Address)` |

### Enum Values

**`Vote`** is encoded as an XDR union with variants: `Yes` (0), `No` (1), `Abstain` (2).

**`ProposalState`** is encoded as an XDR union with variants: `Active` (0), `Passed` (1), `Rejected` (2), `Executed` (3), `Cancelled` (4).

---

## Subscribing via Horizon

Stellar Horizon exposes contract events through the `/transactions` and `/effects` endpoints. For Soroban contract events, use the RPC `getEvents` method directly.

### Install dependencies

```bash
npm install @stellar/stellar-sdk
```

### Poll for recent events

```js
import { SorobanRpc, xdr } from "@stellar/stellar-sdk";

const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
const GOVERNANCE_CONTRACT_ID = "C..."; // your deployed contract ID

async function fetchEvents({ startLedger, eventType = null }) {
  const filters = [
    {
      type: "contract",
      contractIds: [GOVERNANCE_CONTRACT_ID],
      // Optionally filter by topic symbol, e.g. only "vote" events:
      // topics: [["AAAADwAAAAR2b3RlAAAAAA=="]],  // base64 XDR of Symbol("vote")
    },
  ];

  const response = await server.getEvents({
    startLedger,
    filters,
    limit: 100,
  });

  return response.events;
}

// Usage — fetch events from ledger 1000000 onwards
const events = await fetchEvents({ startLedger: 1000000 });
for (const event of events) {
  console.log("ledger:", event.ledger);
  console.log("topics:", event.topic.map((t) => xdr.ScVal.fromXDR(t, "base64")));
  console.log("data:  ", xdr.ScVal.fromXDR(event.value, "base64"));
}
```

### Subscribe to a specific event type

Filter by the first topic symbol to receive only the events you care about. Topic values are base64-encoded XDR `ScVal` symbols.

```js
// Precompute the base64 XDR for a Symbol — do this once at startup
function symbolToBase64(name) {
  return xdr.ScVal.scvSymbol(name).toXDR("base64");
}

const TOPIC_FILTERS = {
  vote:      symbolToBase64("vote"),
  created:   symbolToBase64("created"),
  final:     symbolToBase64("final"),
  executed:  symbolToBase64("executed"),
  cancelled: symbolToBase64("cancelled"),
};

async function fetchVoteEvents(startLedger) {
  const response = await server.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [GOVERNANCE_CONTRACT_ID],
        topics: [[TOPIC_FILTERS.vote]],  // first topic must be Symbol("vote")
      },
    ],
    limit: 200,
  });
  return response.events;
}
```

### Decode event payloads

```js
import { scValToNative } from "@stellar/stellar-sdk";

function decodeEvent(event) {
  const topics = event.topic.map((t) =>
    scValToNative(xdr.ScVal.fromXDR(t, "base64"))
  );
  const data = scValToNative(xdr.ScVal.fromXDR(event.value, "base64"));
  return { topics, data, ledger: event.ledger, txHash: event.txHash };
}

// Example: decode a "vote" event
// topics: ["vote", proposalId]
// data:   [voterAddress, voteVariant, weight]
const decoded = decodeEvent(events[0]);
const [eventName, proposalId] = decoded.topics;
const [voter, vote, weight] = decoded.data;
console.log(`Proposal ${proposalId}: ${voter} voted ${vote} with weight ${weight}`);
```

---

## Event Replay for Historical Data

To rebuild state from scratch or backfill a database, replay all events from the contract's deployment ledger.

### Find the deployment ledger

```js
// The deployment ledger is the ledger in which the contract was created.
// You can find it via Stellar Expert or by querying the contract's ledger entry.
async function getDeploymentLedger(contractId) {
  const response = await server.getContractData(
    contractId,
    xdr.ScVal.scvLedgerKeyContractInstance(),
    "persistent"
  );
  return response.lastModifiedLedgerSeq; // approximate — use the actual deploy ledger
}
```

### Paginated replay

`getEvents` returns at most 10,000 events per call and requires a `startLedger`. Page through all ledgers using the `cursor` field.

```js
async function replayAllEvents(contractId, fromLedger) {
  const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
  let startLedger = fromLedger;
  let cursor = null;
  const allEvents = [];

  while (true) {
    const params = {
      filters: [{ type: "contract", contractIds: [contractId] }],
      limit: 200,
    };
    // Use cursor for subsequent pages; startLedger only for the first call
    if (cursor) {
      params.cursor = cursor;
    } else {
      params.startLedger = startLedger;
    }

    const response = await server.getEvents(params);
    if (response.events.length === 0) break;

    allEvents.push(...response.events);
    cursor = response.events.at(-1).pagingToken;

    // Stop when we've caught up to the latest ledger
    const latest = await server.getLatestLedger();
    const lastEventLedger = response.events.at(-1).ledger;
    if (lastEventLedger >= latest.sequence) break;
  }

  return allEvents;
}

// Usage
const history = await replayAllEvents(GOVERNANCE_CONTRACT_ID, 1000000);
console.log(`Replayed ${history.length} events`);
```

### Build a proposal index from events

```js
async function buildProposalIndex(contractId, fromLedger) {
  const events = await replayAllEvents(contractId, fromLedger);
  const proposals = {};

  for (const raw of events) {
    const { topics, data } = decodeEvent(raw);
    const [type, id] = topics;

    switch (type) {
      case "created":
        proposals[id] = { id, proposer: data, state: "Active", votes: { yes: 0n, no: 0n, abstain: 0n } };
        break;
      case "vote": {
        const [, vote, weight] = data;
        if (proposals[id]) {
          if (vote === "Yes")     proposals[id].votes.yes     += BigInt(weight);
          else if (vote === "No") proposals[id].votes.no      += BigInt(weight);
          else                    proposals[id].votes.abstain += BigInt(weight);
        }
        break;
      }
      case "final":
        if (proposals[id]) proposals[id].state = data[0]; // "Passed" | "Rejected"
        break;
      case "executed":
        if (proposals[id]) proposals[id].state = "Executed";
        break;
      case "cancelled":
        if (proposals[id]) proposals[id].state = "Cancelled";
        break;
    }
  }

  return proposals;
}
```

---

## Continuous Indexing

Poll for new events on a schedule to keep your index up to date.

```js
class VoteChainIndexer {
  constructor(contractId, rpcUrl) {
    this.contractId = contractId;
    this.server = new SorobanRpc.Server(rpcUrl);
    this.lastLedger = 0;
  }

  async start(fromLedger, onEvent, intervalMs = 5000) {
    this.lastLedger = fromLedger;
    setInterval(() => this.poll(onEvent), intervalMs);
  }

  async poll(onEvent) {
    const latest = await this.server.getLatestLedger();
    if (latest.sequence <= this.lastLedger) return;

    const response = await this.server.getEvents({
      startLedger: this.lastLedger + 1,
      filters: [{ type: "contract", contractIds: [this.contractId] }],
      limit: 200,
    });

    for (const event of response.events) {
      onEvent(decodeEvent(event));
    }

    if (response.events.length > 0) {
      this.lastLedger = response.events.at(-1).ledger;
    }
  }
}

// Usage
const indexer = new VoteChainIndexer(GOVERNANCE_CONTRACT_ID, "https://soroban-testnet.stellar.org");
await indexer.start(1000000, (event) => {
  console.log("New event:", event.topics[0], event.data);
});
```

---

## Notes

- `getEvents` requires `startLedger` to be within the RPC node's event retention window (typically the last 17,280 ledgers ≈ 24 hours on Testnet). For older data, use an archival node or a third-party indexer such as [Stellar Expert](https://stellar.expert).
- All `i128` values are returned as `BigInt` by `scValToNative`.
- The `execute_after` field in `"final"` events is `0` for rejected proposals and a Unix timestamp for passed proposals with a timelock configured.
- On Mainnet, replace the RPC URL with `https://soroban-mainnet.stellar.org` and the network passphrase with `"Public Global Stellar Network ; September 2015"`.

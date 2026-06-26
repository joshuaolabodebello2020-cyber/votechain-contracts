# Governance Contract Events

Every state-changing action in the governance contract emits an on-chain Soroban event. Off-chain indexers can stream these events via the Stellar RPC [`getEvents`](https://developers.stellar.org/docs/data/rpc/api-reference/methods/getEvents) endpoint without polling contract storage.

---

## Event Schema

All events follow the Soroban `(topics, data)` structure. Topics are used for filtering; data carries the payload.

### `created` — Proposal Created

Emitted by: `create_proposal`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"created"` |
| topic[1] | u64 | proposal ID |
| data | Address | proposer address |

```json
{ "topics": ["created", 1], "data": "G..." }
```

---

### `vote` — Vote Cast

Emitted by: `cast_vote`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"vote"` |
| topic[1] | u64 | proposal ID |
| data | (Address, Vote, i128) | voter, vote direction, weight |

Vote direction is one of: `Yes`, `No`, `Abstain`.

```json
{ "topics": ["vote", 1], "data": ["G...", "Yes", 500000] }
```

---

### `final` — Proposal Finalised

Emitted by: `finalise`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"final"` |
| topic[1] | u64 | proposal ID |
| data | ProposalStatus | `Passed` or `Rejected` |

```json
{ "topics": ["final", 1], "data": "Passed" }
```

---

### `executed` — Proposal Executed

Emitted by: `execute`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"executed"` |
| topic[1] | u64 | proposal ID |
| data | Address | admin address that executed |

```json
{ "topics": ["executed", 1], "data": "G..." }
```

---

### `cancelled` — Proposal Cancelled

Emitted by: `cancel`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"cancelled"` |
| topic[1] | u64 | proposal ID |
| data | Address | admin address that cancelled |

```json
{ "topics": ["cancelled", 1], "data": "G..." }
```

---

### `qupdate` — Quorum Updated

Emitted by: `update_quorum`

| Field | Type | Value |
|-------|------|-------|
| topic[0] | Symbol | `"qupdate"` |
| topic[1] | u64 | proposal ID |
| data | i128 | new quorum value |

```json
{ "topics": ["qupdate", 1], "data": 500 }
```

---

## Indexer Integration

### Filtering by event type

Use the `getEvents` RPC method with a `topicFilter` to subscribe to a specific event type:

```bash
# All "vote" events on the governance contract
curl -s https://soroban-testnet.stellar.org \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getEvents",
    "params": {
      "startLedger": 1000000,
      "filters": [{
        "type": "contract",
        "contractIds": ["<GOVERNANCE_CONTRACT_ID>"],
        "topics": [["AAAADwAAAAR2b3RlAAAA"]]
      }]
    }
  }'
```

> Topics must be XDR-encoded. `"vote"` as a `symbol_short` encodes to `AAAADwAAAAR2b3RlAAAA`.

### Reconstructing governance history

An indexer can replay full governance history from events alone:

1. Stream `created` events to build a proposal registry.
2. Stream `vote` events to accumulate vote tallies.
3. Stream `final` / `executed` / `cancelled` events to update proposal status.

No contract storage reads are required for read-only history reconstruction.

### No silent state changes

Every mutating function emits an event before returning. The only functions that do not emit events are read-only queries (`get_proposal`, `has_voted`, `proposal_count`).

---

## Event Schema Stability

Event topics and data are part of the public API. Changing them is a **breaking change** for indexers. Follow semver and document schema changes in the changelog before upgrading.

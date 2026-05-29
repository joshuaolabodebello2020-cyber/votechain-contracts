# VoteChain Event Reference

This document lists every on-chain event emitted by the VoteChain governance and token contracts, including topic schemas, data payloads, example values, and notes for indexer integration.

---

## How Events Work on Soroban

Events are published via `env.events().publish(topics, data)`. Topics are a tuple of `Symbol` values used for efficient off-chain filtering. Data is the event payload, serialised as XDR.

When consuming events from the Stellar network, each event has:
- **contract_id** – the address of the emitting contract
- **topics** – array of XDR-encoded values (first element is always the event name symbol)
- **value** – XDR-encoded data payload

---

## Governance Contract Events

### `init` — Contract Initialised

Emitted once when `initialize` is called successfully.

| Field   | Type      | Description                        |
|---------|-----------|------------------------------------|
| topic 0 | `Symbol`  | `"init"`                           |
| data    | `Address` | The admin address set at init time |

**Example payload**

```json
{
  "topics": ["init"],
  "data": "GBXYZ...ADMIN"
}
```

---

### `created` — Proposal Created

Emitted when a new governance proposal is created via `create_proposal`.

| Field   | Type      | Description                  |
|---------|-----------|------------------------------|
| topic 0 | `Symbol`  | `"created"`                  |
| topic 1 | `u64`     | Proposal ID                  |
| data    | `Address` | Address of the proposer      |

**Example payload**

```json
{
  "topics": ["created", 1],
  "data": "GBXYZ...PROPOSER"
}
```

---

### `vote` — Vote Cast

Emitted when a voter casts a vote via `cast_vote`.

| Field   | Type                              | Description                                      |
|---------|-----------------------------------|--------------------------------------------------|
| topic 0 | `Symbol`                          | `"vote"`                                         |
| topic 1 | `u64`                             | Proposal ID                                      |
| data    | `(Address, Vote, i128)`           | Voter address, vote choice, and vote weight      |

`Vote` is an enum: `Yes`, `No`, or `Abstain`.

**Example payload**

```json
{
  "topics": ["vote", 1],
  "data": ["GBXYZ...VOTER", "Yes", 1000000]
}
```

---

### `final` — Proposal Finalised

Emitted when a proposal is finalised via `finalise` after the voting period ends.

| Field   | Type                        | Description                                                                 |
|---------|-----------------------------|-----------------------------------------------------------------------------|
| topic 0 | `Symbol`                    | `"final"`                                                                   |
| topic 1 | `u64`                       | Proposal ID                                                                 |
| data    | `(ProposalState, u64)`      | Final state (`Passed` or `Rejected`) and `execute_after` Unix timestamp     |

`execute_after` is non-zero only when `state == Passed`. It is the earliest timestamp at which `execute` may be called.

**Example payload — passed**

```json
{
  "topics": ["final", 1],
  "data": ["Passed", 1735000000]
}
```

**Example payload — rejected**

```json
{
  "topics": ["final", 2],
  "data": ["Rejected", 0]
}
```

---

### `executed` — Proposal Executed

Emitted when a passed proposal is marked executed via `execute`.

| Field   | Type     | Description     |
|---------|----------|-----------------|
| topic 0 | `Symbol` | `"executed"`    |
| topic 1 | `u64`    | Proposal ID     |
| data    | `()`     | Empty           |

**Example payload**

```json
{
  "topics": ["executed", 1],
  "data": null
}
```

---

### `cancelled` — Proposal Cancelled

Emitted when an admin cancels an active proposal via `cancel`.

| Field   | Type     | Description     |
|---------|----------|-----------------|
| topic 0 | `Symbol` | `"cancelled"`   |
| topic 1 | `u64`    | Proposal ID     |
| data    | `()`     | Empty           |

**Example payload**

```json
{
  "topics": ["cancelled", 3],
  "data": null
}
```

---

### `qupdate` — Quorum Updated

Emitted when an admin updates the quorum threshold of an active proposal via `update_quorum`.

| Field   | Type     | Description          |
|---------|----------|----------------------|
| topic 0 | `Symbol` | `"qupdate"`          |
| topic 1 | `u64`    | Proposal ID          |
| data    | `i128`   | New quorum threshold |

**Example payload**

```json
{
  "topics": ["qupdate", 1],
  "data": 500000
}
```

---

### `admxfer` — Admin Transferred (Governance)

Emitted when admin rights are transferred via `transfer_admin` on the governance contract.

| Field   | Type                    | Description                          |
|---------|-------------------------|--------------------------------------|
| topic 0 | `Symbol`                | `"admxfer"`                          |
| data    | `(Address, Address)`    | Old admin address, new admin address |

**Example payload**

```json
{
  "topics": ["admxfer"],
  "data": ["GBXYZ...OLD_ADMIN", "GBXYZ...NEW_ADMIN"]
}
```

---

### `paused` — Contract Paused

Emitted when the governance contract is paused via `pause`.

| Field   | Type      | Description                    |
|---------|-----------|--------------------------------|
| topic 0 | `Symbol`  | `"paused"`                     |
| data    | `Address` | Admin address that paused it   |

**Example payload**

```json
{
  "topics": ["paused"],
  "data": "GBXYZ...ADMIN"
}
```

---

### `unpaused` — Contract Unpaused

Emitted when the governance contract is unpaused via `unpause`.

| Field   | Type      | Description                      |
|---------|-----------|----------------------------------|
| topic 0 | `Symbol`  | `"unpaused"`                     |
| data    | `Address` | Admin address that unpaused it   |

**Example payload**

```json
{
  "topics": ["unpaused"],
  "data": "GBXYZ...ADMIN"
}
```

---

### `durationupdate` — Duration Limits Updated

Emitted when voting duration limits are updated.

| Field   | Type           | Description                              |
|---------|----------------|------------------------------------------|
| topic 0 | `Symbol`       | `"durationupdate"`                       |
| data    | `(u64, u64)`   | New `min_duration` and `max_duration` in seconds |

**Example payload**

```json
{
  "topics": ["durationupdate"],
  "data": [3600, 2592000]
}
```

---

## Token Contract Events

### `mint` — Tokens Minted

Emitted when new tokens are minted via `mint`.

| Field   | Type      | Description                  |
|---------|-----------|------------------------------|
| topic 0 | `Symbol`  | `"mint"`                     |
| topic 1 | `Address` | Recipient address            |
| data    | `i128`    | Amount minted                |

**Example payload**

```json
{
  "topics": ["mint", "GBXYZ...RECIPIENT"],
  "data": 500000
}
```

---

### `transfer` — Tokens Transferred

Emitted when tokens are transferred via `transfer` or `transfer_from`.

| Field   | Type      | Description       |
|---------|-----------|-------------------|
| topic 0 | `Symbol`  | `"transfer"`      |
| topic 1 | `Address` | Sender address    |
| topic 2 | `Address` | Recipient address |
| data    | `i128`    | Amount transferred |

**Example payload**

```json
{
  "topics": ["transfer", "GBXYZ...FROM", "GBXYZ...TO"],
  "data": 250000
}
```

---

### `burn` — Tokens Burned

Emitted when tokens are burned via `burn`.

| Field   | Type      | Description          |
|---------|-----------|----------------------|
| topic 0 | `Symbol`  | `"burn"`             |
| topic 1 | `Address` | Address burned from  |
| data    | `i128`    | Amount burned        |

**Example payload**

```json
{
  "topics": ["burn", "GBXYZ...FROM"],
  "data": 200000
}
```

---

### `admxfer` — Admin Transferred (Token)

Emitted when admin rights are transferred via `transfer_admin` on the token contract.

| Field   | Type                 | Description                          |
|---------|----------------------|--------------------------------------|
| topic 0 | `Symbol`             | `"admxfer"`                          |
| data    | `(Address, Address)` | Old admin address, new admin address |

**Example payload**

```json
{
  "topics": ["admxfer"],
  "data": ["GBXYZ...OLD_ADMIN", "GBXYZ...NEW_ADMIN"]
}
```

---

## Indexer Integration Notes

### Filtering by topic

Use the first topic symbol to filter event types efficiently. Most Stellar indexers (Horizon, Subquery, Mercury) support topic-based filtering:

```
contract_id = <governance_contract_address>
topic[0]    = "created" | "vote" | "final" | "executed" | "cancelled" | ...
```

### Proposal lifecycle tracking

To track a proposal from creation to completion, subscribe to events with `topic[1] == <proposal_id>`:

| Event symbol | Meaning                                      |
|--------------|----------------------------------------------|
| `created`    | Proposal opened, voting begins               |
| `vote`       | A voter cast a ballot                        |
| `final`      | Voting ended; outcome is `Passed`/`Rejected` |
| `executed`   | Passed proposal was executed by admin        |
| `cancelled`  | Admin cancelled the proposal early           |
| `qupdate`    | Admin adjusted the quorum threshold          |

### Timelock awareness

When a `final` event carries `state = Passed`, the `execute_after` field in the data payload is the earliest Unix timestamp at which `execute` may be called. Indexers should surface this value to frontends so they can display the timelock countdown without querying the contract.

### XDR decoding

All topics and data are XDR-encoded. Use the Stellar SDK for your language to decode them:

- **JavaScript/TypeScript**: `@stellar/stellar-sdk` — `xdr.ScVal.fromXDR(...)`
- **Rust**: `soroban-sdk` — `Val::try_from_val(&env, &raw)`
- **Python**: `stellar-sdk` — `stellar_sdk.xdr`

### Self-transfer suppression

The token contract does **not** emit a `transfer` event when `from == to`. Indexers should not expect a transfer event for self-transfers.

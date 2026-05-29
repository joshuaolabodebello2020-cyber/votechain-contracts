# VoteChain Indexer

Off-chain indexer for VoteChain contract events on Stellar.

## Features

- Subscribes to Stellar Horizon event stream for contract events
- Parses and stores all VoteChain events in PostgreSQL
- Handles reorgs and missed events with cursor-based backfill
- Exposes REST API for frontend queries
- Processes events with < 5s latency (configurable poll interval)

## Setup

```bash
# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost/votechain"
export CONTRACT_ID="CXXXXX..."
export HORIZON_URL="https://horizon-testnet.stellar.org"
export POLL_INTERVAL_SECS="3"

# Run migrations (automatic on startup)
cargo run -p votechain-indexer
```

## API Endpoints

- `GET /events` — last 100 events across all proposals
- `GET /events/proposals/{id}` — all events for a specific proposal

## Event Types

| Topic | Description |
|-------|-------------|
| `init` | Contract initialized |
| `created` | Proposal created |
| `vote` | Vote cast |
| `final` | Proposal finalized (Passed/Rejected) |
| `executed` | Proposal executed |
| `cancelled` | Proposal cancelled |
| `qupdate` | Quorum updated |
| `admxfer` | Admin transferred |
| `paused` | Contract paused |
| `unpaused` | Contract unpaused |
| `durationupdate` | Duration limits updated |

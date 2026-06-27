# Indexer Recovery Guide
=========================

## Persistence Overview
The VoteChain API indexer now uses an append‑only JSON‑lines event log for persistence:
- Default file: `indexer_events.log` (in working directory)
- The indexer automatically loads events from this log on startup
- New events are automatically appended to the log

## Recovery Steps

### 1. Replay from Existing Log File
If you have the existing log file, just start the API server normally:
- The log file will be automatically replayed to rebuild the indexer state

### 2. Import Events from Stellar Blockchain
If log file is lost, you need to re‑ingest events from Stellar:
- Use your event indexer/monitoring tool to re‑send all events to `/ingest` endpoint
- The indexer will re‑build state and log events to the log file as they arrive

### 3. Backup the Log File
To backup the indexer state, simply copy the `indexer_events.log` file to a secure location

### 4. Restore from Backup
Copy the backed‑up log file back to the working directory of the API server and start the server normally

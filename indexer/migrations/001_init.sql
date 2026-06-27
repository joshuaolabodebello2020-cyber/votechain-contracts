-- Tracks the last ledger sequence successfully processed per contract.
-- Used for backfill and resumption after restarts.
CREATE TABLE IF NOT EXISTS indexer_cursor (
    contract_id TEXT PRIMARY KEY,
    last_ledger  BIGINT NOT NULL DEFAULT 0
);

-- All VoteChain contract events, one row per event.
CREATE TABLE IF NOT EXISTS contract_events (
    id              BIGSERIAL PRIMARY KEY,
    ledger_seq      BIGINT      NOT NULL,
    tx_hash         TEXT        NOT NULL,
    contract_id     TEXT        NOT NULL,
    topic           TEXT        NOT NULL,  -- e.g. "created", "vote", "final"
    proposal_id     BIGINT,                -- NULL for non-proposal events
    payload         JSONB       NOT NULL,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_contract   ON contract_events (contract_id);
CREATE INDEX IF NOT EXISTS idx_events_topic      ON contract_events (topic);
CREATE INDEX IF NOT EXISTS idx_events_proposal   ON contract_events (proposal_id);
CREATE INDEX IF NOT EXISTS idx_events_ledger     ON contract_events (ledger_seq);

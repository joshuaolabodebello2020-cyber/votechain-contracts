use std::{env, time::Duration};

use anyhow::{Context, Result};
use axum::{extract::State, routing::get, Json, Router};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tokio::{net::TcpListener, time::sleep};
use tracing::{error, info, warn};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

struct Config {
    database_url: String,
    horizon_url: String,
    contract_id: String,
    poll_interval: Duration,
}

impl Config {
    fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: env::var("DATABASE_URL").context("DATABASE_URL")?,
            horizon_url: env::var("HORIZON_URL")
                .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".into()),
            contract_id: env::var("CONTRACT_ID").context("CONTRACT_ID")?,
            poll_interval: Duration::from_secs(
                env::var("POLL_INTERVAL_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(3),
            ),
        })
    }
}

// ---------------------------------------------------------------------------
// Horizon response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct HorizonEventsPage {
    #[serde(rename = "_embedded")]
    embedded: Embedded,
}

#[derive(Deserialize)]
struct Embedded {
    records: Vec<HorizonEvent>,
}

#[derive(Deserialize)]
struct HorizonEvent {
    ledger: u64,
    transaction_hash: String,
    #[serde(rename = "contract_id")]
    contract_id: String,
    topic: Vec<Value>,
    value: Value,
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async fn last_ledger(pool: &PgPool, contract_id: &str) -> Result<u64> {
    let row: Option<(i64,)> =
        sqlx::query_as("SELECT last_ledger FROM indexer_cursor WHERE contract_id = $1")
            .bind(contract_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(l,)| l as u64).unwrap_or(0))
}

async fn save_cursor(pool: &PgPool, contract_id: &str, ledger: u64) -> Result<()> {
    sqlx::query(
        "INSERT INTO indexer_cursor (contract_id, last_ledger)
         VALUES ($1, $2)
         ON CONFLICT (contract_id) DO UPDATE SET last_ledger = EXCLUDED.last_ledger",
    )
    .bind(contract_id)
    .bind(ledger as i64)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_event(pool: &PgPool, ev: &HorizonEvent, topic: &str) -> Result<()> {
    let proposal_id: Option<i64> = ev.topic.get(1).and_then(|v| v.as_i64());
    sqlx::query(
        "INSERT INTO contract_events
             (ledger_seq, tx_hash, contract_id, topic, proposal_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING",
    )
    .bind(ev.ledger as i64)
    .bind(&ev.transaction_hash)
    .bind(&ev.contract_id)
    .bind(topic)
    .bind(proposal_id)
    .bind(&ev.value)
    .execute(pool)
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Ingestion loop
// ---------------------------------------------------------------------------

async fn ingest(pool: PgPool, cfg: Config) {
    let client = Client::new();
    loop {
        match poll_once(&client, &pool, &cfg).await {
            Ok(count) => {
                if count > 0 {
                    info!(count, "ingested events");
                }
            }
            Err(e) => error!("poll error: {e:#}"),
        }
        sleep(cfg.poll_interval).await;
    }
}

async fn poll_once(client: &Client, pool: &PgPool, cfg: &Config) -> Result<usize> {
    let cursor = last_ledger(pool, &cfg.contract_id).await?;

    let url = format!(
        "{}/contracts/{}/events?cursor={}&limit=200&order=asc",
        cfg.horizon_url, cfg.contract_id, cursor
    );

    let page: HorizonEventsPage = client
        .get(&url)
        .timeout(Duration::from_secs(10))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let records = page.embedded.records;
    if records.is_empty() {
        return Ok(0);
    }

    let mut max_ledger = cursor;
    let mut count = 0;

    for ev in &records {
        let topic = ev
            .topic
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match topic {
            "init" | "created" | "vote" | "final" | "executed" | "cancelled" | "qupdate"
            | "admxfer" | "paused" | "unpaused" | "durationupdate" => {
                insert_event(pool, ev, topic).await?;
                count += 1;
            }
            other => warn!(other, "unknown event topic — skipping"),
        }

        if ev.ledger > max_ledger {
            max_ledger = ev.ledger;
        }
    }

    save_cursor(pool, &cfg.contract_id, max_ledger).await?;
    Ok(count)
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

#[derive(Serialize, sqlx::FromRow)]
struct EventRow {
    id: i64,
    ledger_seq: i64,
    tx_hash: String,
    topic: String,
    proposal_id: Option<i64>,
    payload: Value,
    ingested_at: chrono::DateTime<chrono::Utc>,
}

async fn list_events(State(pool): State<PgPool>) -> Json<Vec<EventRow>> {
    let rows = sqlx::query_as::<_, EventRow>(
        "SELECT id, ledger_seq, tx_hash, topic, proposal_id, payload, ingested_at
         FROM contract_events ORDER BY ledger_seq DESC LIMIT 100",
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(rows)
}

async fn list_proposal_events(
    State(pool): State<PgPool>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<EventRow>> {
    let rows = sqlx::query_as::<_, EventRow>(
        "SELECT id, ledger_seq, tx_hash, topic, proposal_id, payload, ingested_at
         FROM contract_events WHERE proposal_id = $1 ORDER BY ledger_seq ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(rows)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let cfg = Config::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&cfg.database_url)
        .await
        .context("connect to postgres")?;

    // Run migrations
    sqlx::raw_sql(include_str!("../migrations/001_init.sql"))
        .execute(&pool)
        .await
        .context("run migrations")?;

    // Spawn ingestion loop
    let ingest_pool = pool.clone();
    tokio::spawn(async move { ingest(ingest_pool, cfg).await });

    // REST API
    let app = Router::new()
        .route("/events", get(list_events))
        .route("/events/proposals/{id}", get(list_proposal_events))
        .with_state(pool);

    let addr = "0.0.0.0:4000";
    let listener = TcpListener::bind(addr).await?;
    info!("VoteChain indexer API on {addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

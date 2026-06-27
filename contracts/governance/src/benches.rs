//! Benchmark tests for VoteChain governance contract flows.
//!
//! Uses Soroban's built-in budget API (`env.budget()`) to capture
//! CPU-instruction and memory-byte usage for each key operation.
//!
//! Run with:
//!   cargo test -p votechain-governance bench_ -- --nocapture
//!
//! A baseline snapshot is printed to stdout so CI can detect regressions.
//!
//! Issue: #476

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

use crate::{GovernanceContract, GovernanceContractClient};
use crate::types::{ProposalState, Vote};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup_token(env: &Env, admin: &Address) -> Address {
    let id = env.register(votechain_token::TokenContract, ());
    let t = votechain_token::TokenContractClient::new(env, &id);
    t.initialize(admin, &i128::MAX);
    id
}

fn setup_governance(env: &Env, admin: &Address, token_id: &Address) -> GovernanceContractClient<'static> {
    let id = env.register(GovernanceContract, ());
    let c = GovernanceContractClient::new(env, &id);
    // min_balance=0, cooldown=0, min_dur=60, max_dur=2_592_000, restrict_admin_vote=false,
    // amend_window=0, timelock_duration=0, veto_threshold=0, persistent_storage_ttl=0
    c.initialize(admin, token_id, &0_i128, &0_u64, &60_u64, &2_592_000_u64, &false, &0_u64, &0_u64, &0_i128, &0_u32);
    c
}

fn print_budget(env: &Env, label: &str) {
    let b = env.budget();
    println!(
        "[bench] {:40} | cpu_insn={:>12} | mem_bytes={:>10}",
        label,
        b.cpu_instruction_cost(),
        b.memory_bytes_cost(),
    );
}

// ── benchmarks ────────────────────────────────────────────────────────────────

/// BENCH-001: cost of creating a single proposal.
#[test]
fn bench_create_proposal() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = setup_governance(&env, &admin, &token_id);

    let proposer = Address::generate(&env);

    env.budget().reset_tracker();
    client.create_proposal(
        &proposer,
        &String::from_str(&env, "Treasury allocation"),
        &String::from_str(&env, "Allocate 10M tokens to the treasury for Q3 operations."),
        &1_000,
        &604_800,
        &Vec::new(&env),
    );
    print_budget(&env, "create_proposal");
}

/// BENCH-002: cost of casting a single vote.
#[test]
fn bench_cast_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = setup_governance(&env, &admin, &token_id);
    let tok = votechain_token::TokenContractClient::new(&env, &token_id);

    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Vote bench"),
        &String::from_str(&env, "desc"),
        &1,
        &3_600,
        &Vec::new(&env),
    );

    let voter = Address::generate(&env);
    tok.mint(&admin, &voter, &1_000_000);

    env.budget().reset_tracker();
    client.cast_vote(&voter, &proposal_id, &Vote::Yes);
    print_budget(&env, "cast_vote");
}

/// BENCH-003: cost of finalizing a proposal.
#[test]
fn bench_finalise() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = setup_governance(&env, &admin, &token_id);
    let tok = votechain_token::TokenContractClient::new(&env, &token_id);

    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Finalise bench"),
        &String::from_str(&env, "desc"),
        &1,
        &60, // minimum duration
        &Vec::new(&env),
    );

    let voter = Address::generate(&env);
    tok.mint(&admin, &voter, &1_000_000);
    client.cast_vote(&voter, &proposal_id, &Vote::Yes);

    env.ledger().with_mut(|l| l.timestamp += 61);

    env.budget().reset_tracker();
    client.finalise(&proposal_id);
    print_budget(&env, "finalise");
}

/// BENCH-004: cost of executing a passed proposal.
#[test]
fn bench_execute() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = setup_governance(&env, &admin, &token_id);
    let tok = votechain_token::TokenContractClient::new(&env, &token_id);

    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Execute bench"),
        &String::from_str(&env, "desc"),
        &1,
        &60,
        &Vec::new(&env),
    );

    let voter = Address::generate(&env);
    tok.mint(&admin, &voter, &1_000_000);
    client.cast_vote(&voter, &proposal_id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 61);
    client.finalise(&proposal_id);

    assert_eq!(client.get_proposal(&proposal_id).state, ProposalState::Passed);

    env.budget().reset_tracker();
    client.execute(&admin, &proposal_id);
    print_budget(&env, "execute");
}

/// BENCH-005: storage growth — 100 proposals, measure cumulative cost.
#[test]
fn bench_storage_100_proposals() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = setup_governance(&env, &admin, &token_id);

    let proposer = Address::generate(&env);
    let title = String::from_str(&env, "Storage bench proposal");
    let desc = String::from_str(&env, "Description for storage benchmark test.");

    env.budget().reset_tracker();
    for _ in 0..100 {
        client.create_proposal(&proposer, &title, &desc, &1, &3_600, &Vec::new(&env));
    }
    print_budget(&env, "100 x create_proposal (cumulative)");
}

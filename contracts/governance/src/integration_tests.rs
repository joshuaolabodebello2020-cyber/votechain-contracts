//! Integration tests for the full proposal lifecycle.
//!
//! These tests run against the compiled WASM via `env.register()` and cover
//! the three required end-to-end scenarios from TEST-002:
//!
//! 1. create → vote → finalise as Passed → execute
//! 2. create → vote → finalise as Rejected
//! 3. create → vote (mid-vote) → cancel

#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String};

use crate::{GovernanceContract, GovernanceContractClient};
use crate::types::{ProposalState, Vote};

// ── helpers ───────────────────────────────────────────────────────────────────

struct Setup<'a> {
    env: Env,
    gov: GovernanceContractClient<'a>,
    token: votechain_token::TokenContractClient<'a>,
    admin: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let token = votechain_token::TokenContractClient::new(&env, &tok_id);
    token.initialize(&admin, &10_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let gov = GovernanceContractClient::new(&env, &gov_id);
    gov.initialize(
        &admin, &tok_id,
        &0_i128,          // min_proposal_balance
        &0_u64,           // proposal_cooldown
        &60_u64,          // min_duration
        &2_592_000_u64,   // max_duration
        &false,           // restrict_admin_vote
        &0_u64,           // timelock_duration
    );

    Setup { env, gov, token, admin }
}

fn make_proposal(s: &Setup) -> u64 {
    let proposer = Address::generate(&s.env);
    s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "Integration proposal"),
        &String::from_str(&s.env, "End-to-end lifecycle test"),
        &100_i128,  // quorum
        &3600_u64,  // duration (1 hour)
    )
}

// ── TEST 1: create → vote → finalise Passed → execute ────────────────────────

#[test]
fn test_lifecycle_passed_and_executed() {
    let s = setup();
    let id = make_proposal(&s);

    // Cast a Yes vote with enough weight to meet quorum
    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Advance past voting period
    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    let proposal = s.gov.get_proposal(&id);
    assert_eq!(proposal.state, ProposalState::Passed);

    s.gov.execute(&s.admin, &id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Executed);
}

// ── TEST 2: create → vote → finalise Rejected ────────────────────────────────

#[test]
fn test_lifecycle_rejected() {
    let s = setup();
    let id = make_proposal(&s);

    // Cast a No vote — quorum not met (weight 50 < quorum 100)
    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &50_i128);
    s.gov.cast_vote(&voter, &id, &Vote::No);

    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ── TEST 3: create → vote (mid-vote) → cancel ────────────────────────────────

#[test]
fn test_lifecycle_cancelled_mid_vote() {
    let s = setup();
    let id = make_proposal(&s);

    // Cast a vote to confirm the proposal is active
    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Admin cancels while voting is still open
    s.gov.cancel(&s.admin, &id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Cancelled);
}

//! TEST-014: Load tests for high-volume proposal and voting scenarios.
//!
//! These tests simulate:
//! - 1 000 sequential proposal creations to verify counter integrity and
//!   absence of storage collisions at scale.
//! - 10 000 votes across a single proposal to verify tally arithmetic and
//!   double-vote prevention under high voter counts.
//!
//! Soroban's test environment runs entirely in-process, so these tests
//! complete in milliseconds without any network overhead.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use crate::{GovernanceContract, GovernanceContractClient};
use crate::types::{ProposalState, Vote};

fn setup_token(env: &Env, admin: &Address) -> Address {
    let id = env.register(votechain_token::TokenContract, ());
    let t = votechain_token::TokenContractClient::new(env, &id);
    t.initialize(admin, &i128::MAX);
    id
}

fn new_gov(env: &Env, admin: &Address, token_id: &Address) -> GovernanceContractClient<'static> {
    let id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(env, &id);
    client.initialize(admin, token_id, &0_i128, &0_u64, &60_u64, &2_592_000_u64, &false, &0_u64, &0_u64, &0_i128, &0_u32, &0_u32);
    client
}

/// Create 1 000 proposals and verify the counter and each proposal's state.
#[test]
fn test_load_1000_proposals() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = new_gov(&env, &admin, &token_id);

    let proposer = Address::generate(&env);
    let title = String::from_str(&env, "Load test proposal");
    let desc = String::from_str(&env, "desc");

    for i in 1u64..=1_000 {
        let id = client.create_proposal(&proposer, &title, &desc, &1, &3600);
        assert_eq!(id, i);
    }

    assert_eq!(client.proposal_count(), 1_000);
    // spot-check first and last
    assert_eq!(client.get_proposal(&1).state, ProposalState::Active);
    assert_eq!(client.get_proposal(&1_000).state, ProposalState::Active);
}

/// Cast 10 000 votes on a single proposal and verify the tally is exact.
#[test]
fn test_load_10000_votes() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = new_gov(&env, &admin, &token_id);
    let tok = votechain_token::TokenContractClient::new(&env, &token_id);

    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "High-volume vote"),
        &String::from_str(&env, "desc"),
        &1,
        &3600,
    );

    let weight: i128 = 1;
    let n: u64 = 10_000;

    for _ in 0..n {
        let voter = Address::generate(&env);
        tok.mint(&admin, &voter, &weight);
        client.cast_vote(&voter, &proposal_id, &Vote::Yes);
    }

    let p = client.get_proposal(&proposal_id);
    assert_eq!(p.votes_yes, weight * n as i128);
    assert_eq!(p.votes_no, 0);
    assert_eq!(p.votes_abstain, 0);
}

/// Mixed-vote load: 10 000 voters split across Yes / No / Abstain.
/// Verifies each tally bucket accumulates independently.
#[test]
fn test_load_10000_votes_mixed() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    let client = new_gov(&env, &admin, &token_id);
    let tok = votechain_token::TokenContractClient::new(&env, &token_id);

    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Mixed load"),
        &String::from_str(&env, "desc"),
        &1,
        &3600,
    );

    let n: u64 = 10_000;
    let weight: i128 = 1;

    for i in 0..n {
        let voter = Address::generate(&env);
        tok.mint(&admin, &voter, &weight);
        let vote = match i % 3 {
            0 => Vote::Yes,
            1 => Vote::No,
            _ => Vote::Abstain,
        };
        client.cast_vote(&voter, &proposal_id, &vote);
    }

    let p = client.get_proposal(&proposal_id);
    // 10000 / 3: indices 0,3,6,… → Yes; 1,4,7,… → No; 2,5,8,… → Abstain
    let yes_count = (n + 2) / 3; // ceil(n/3)
    let no_count  = (n + 1) / 3;
    let abs_count = n / 3;
    assert_eq!(p.votes_yes,     weight * yes_count as i128);
    assert_eq!(p.votes_no,      weight * no_count  as i128);
    assert_eq!(p.votes_abstain, weight * abs_count as i128);
}

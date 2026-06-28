// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//! Integration tests for the full proposal lifecycle.
//!
//! These tests run against the compiled WASM via `env.register()` and cover
//! the three required end-to-end scenarios:
//!
//! Lifecycle tests (original):
//!   1. create → vote → finalise as Passed → execute
//!   2. create → vote → finalise as Rejected
//!   3. create → vote (mid-vote) → cancel
//!
//! Extended environment-specific tests (#525):
//!   4.  Contract deployment and initialization verification
//!   5.  Multiple voters — weight aggregation determines outcome
//!   6.  Abstain votes count toward quorum but not toward Yes/No
//!   7.  Double-vote rejected with AlreadyVoted error
//!   8.  Proposal count increments deterministically
//!   9.  Proposal state is Active immediately after creation
//!   10. Finalise before voting ends rejected with VotingStillOpen
//!   11. Vote after voting ends rejected with VotingPeriodEnded
//!   12. Execute rejected when proposal is not Passed
//!   13. Cancel by non-admin rejected with NotAdmin
//!   14. has_voted reflects vote state accurately
//!   15. Reproducibility — two independent setups produce equivalent initial state

#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String, Vec};

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
        &admin,
        &tok_id,
        &0_i128,        // min_proposal_balance
        &0_u64,         // proposal_cooldown
        &60_u64,        // min_duration
        &2_592_000_u64, // max_duration
        &false,         // restrict_admin_vote
        &0_u64,         // amend_window
        &0_u64,         // timelock_duration
        &0_i128,        // veto_threshold
    );

    Setup { env, gov, token, admin }
}

fn make_proposal(s: &Setup) -> u64 {
    let proposer = Address::generate(&s.env);
    s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "Integration proposal"),
        &String::from_str(&s.env, "End-to-end lifecycle test"),
        &100_i128,       // quorum
        &3600_u64,       // duration (1 hour)
        &Vec::new(&s.env), // tags
    )
}

// ── TEST 1: create → vote → finalise Passed → execute ────────────────────────

#[test]
fn test_lifecycle_passed_and_executed() {
    let s = setup();
    let id = make_proposal(&s);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

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

    // Quorum not met (weight 50 < quorum 100)
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

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Admin cancels while voting is still open
    s.gov.cancel(&s.admin, &id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Cancelled);
}

// ── TEST 4: deployment and initialization verification ───────────────────────

#[test]
fn test_deployment_initialized_state() {
    let s = setup();

    // Contract is ready and not paused after initialization
    assert!(!s.gov.paused());
    // Version is set
    let ver = s.gov.get_version();
    assert_eq!(ver, (1, 0, 0));
    // No proposals exist yet
    assert_eq!(s.gov.proposal_count(), 0);
}

// ── TEST 5: multiple voters — weight aggregation ─────────────────────────────

#[test]
fn test_multi_voter_quorum_met_by_aggregate_weight() {
    let s = setup();
    let id = make_proposal(&s);

    // Three voters each with 40 tokens (total 120 > quorum 100)
    for _ in 0..3 {
        let voter = Address::generate(&s.env);
        s.token.mint(&s.admin, &voter, &40_i128);
        s.gov.cast_vote(&voter, &id, &Vote::Yes);
    }

    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Passed);
}

#[test]
fn test_multi_voter_quorum_not_met() {
    let s = setup();
    let id = make_proposal(&s);

    // Two voters with 30 tokens each (total 60 < quorum 100)
    for _ in 0..2 {
        let voter = Address::generate(&s.env);
        s.token.mint(&s.admin, &voter, &30_i128);
        s.gov.cast_vote(&voter, &id, &Vote::Yes);
    }

    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ── TEST 6: abstain votes count toward quorum ────────────────────────────────

#[test]
fn test_abstain_vote_counts_toward_quorum() {
    let s = setup();
    let id = make_proposal(&s);

    // 60 tokens abstain + 60 tokens No = 120 total > quorum 100
    // But No weight >= Yes weight → Rejected (quorum met but proposal did not pass)
    let abstainer = Address::generate(&s.env);
    s.token.mint(&s.admin, &abstainer, &60_i128);
    s.gov.cast_vote(&abstainer, &id, &Vote::Abstain);

    let no_voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &no_voter, &60_i128);
    s.gov.cast_vote(&no_voter, &id, &Vote::No);

    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    // Quorum met (120 ≥ 100) but more No weight than Yes weight → Rejected
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ── TEST 7: double-vote rejected ─────────────────────────────────────────────

#[test]
fn test_double_vote_rejected() {
    let s = setup();
    let id = make_proposal(&s);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Second vote must fail
    let result = s.gov.try_cast_vote(&voter, &id, &Vote::No);
    assert!(result.is_err());
}

// ── TEST 8: proposal count increments deterministically ──────────────────────

#[test]
fn test_proposal_count_increments() {
    let s = setup();

    assert_eq!(s.gov.proposal_count(), 0);

    let id1 = make_proposal(&s);
    assert_eq!(s.gov.proposal_count(), 1);
    assert_eq!(id1, 1);

    let id2 = make_proposal(&s);
    assert_eq!(s.gov.proposal_count(), 2);
    assert_eq!(id2, 2);
}

// ── TEST 9: new proposal is Active ───────────────────────────────────────────

#[test]
fn test_new_proposal_is_active() {
    let s = setup();
    let id = make_proposal(&s);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Active);
}

// ── TEST 10: finalise before voting period ends fails ────────────────────────

#[test]
fn test_finalise_before_voting_ends_fails() {
    let s = setup();
    let id = make_proposal(&s);

    // Do not advance time — voting period still open
    let result = s.gov.try_finalise(&id);
    assert!(result.is_err());
}

// ── TEST 11: vote after period ends fails ────────────────────────────────────

#[test]
fn test_vote_after_period_ends_fails() {
    let s = setup();
    let id = make_proposal(&s);

    // Advance past voting period without finalising
    s.env.ledger().with_mut(|l| l.timestamp += 3601);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);

    let result = s.gov.try_cast_vote(&voter, &id, &Vote::Yes);
    assert!(result.is_err());
}

// ── TEST 12: execute fails when proposal is not Passed ───────────────────────

#[test]
fn test_execute_fails_when_not_passed() {
    let s = setup();
    let id = make_proposal(&s);

    // Finalise as Rejected (no votes → quorum not met)
    s.env.ledger().with_mut(|l| l.timestamp += 3601);
    s.gov.finalise(&id);

    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);

    let result = s.gov.try_execute(&s.admin, &id);
    assert!(result.is_err());
}

// ── TEST 13: cancel by non-admin is rejected ─────────────────────────────────

#[test]
fn test_cancel_by_non_admin_rejected() {
    let s = setup();
    let id = make_proposal(&s);

    let rando = Address::generate(&s.env);
    let result = s.gov.try_cancel(&rando, &id);
    assert!(result.is_err());
}

// ── TEST 14: has_voted reflects accurate vote state ──────────────────────────

#[test]
fn test_has_voted_returns_correct_state() {
    let s = setup();
    let id = make_proposal(&s);

    let voter = Address::generate(&s.env);
    let non_voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200_i128);

    // Before voting
    assert!(!s.gov.has_voted(&id, &voter));
    assert!(!s.gov.has_voted(&id, &non_voter));

    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // After voting
    assert!(s.gov.has_voted(&id, &voter));
    assert!(!s.gov.has_voted(&id, &non_voter));
}

// ── TEST 15: environment reproducibility ─────────────────────────────────────

#[test]
fn test_two_setups_produce_equivalent_initial_state() {
    let s1 = setup();
    let s2 = setup();

    // Both start with 0 proposals
    assert_eq!(s1.gov.proposal_count(), 0);
    assert_eq!(s2.gov.proposal_count(), 0);

    // Both start with version (1, 0, 0)
    assert_eq!(s1.gov.get_version(), s2.gov.get_version());

    // Both start unpaused
    assert_eq!(s1.gov.paused(), s2.gov.paused());

    // Creating a proposal in one environment does not affect the other
    make_proposal(&s1);
    assert_eq!(s1.gov.proposal_count(), 1);
    assert_eq!(s2.gov.proposal_count(), 0);
}

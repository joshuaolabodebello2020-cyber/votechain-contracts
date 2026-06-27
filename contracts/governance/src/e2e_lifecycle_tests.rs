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

//! Comprehensive end-to-end lifecycle tests for the VoteChain governance contract.
//!
//! Covers all five terminal states (Active → Passed → Executed, Rejected, Cancelled),
//! multi-voter scenarios, double-vote prevention, vote weight snapshots, and
//! abstain-only quorum behaviour.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String, Vec,
};

use crate::{GovernanceContract, GovernanceContractClient};
use crate::types::{ContractError, ProposalState, Vote};

// ── Setup ────────────────────────────────────────────────────────────────────

struct Suite<'a> {
    env: Env,
    gov: GovernanceContractClient<'a>,
    token: votechain_token::TokenContractClient<'a>,
    admin: Address,
}

/// Deploy both contracts, initialize governance with no restrictions.
fn make_suite<'a>() -> Suite<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let token = votechain_token::TokenContractClient::new(&env, &tok_id);
    token.initialize(&admin, &100_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let gov = GovernanceContractClient::new(&env, &gov_id);
    gov.initialize(
        &admin,
        &tok_id,
        &0_i128,          // min_proposal_balance
        &0_u64,           // proposal_cooldown
        &60_u64,          // min_duration
        &2_592_000_u64,   // max_duration
        &false,           // restrict_admin_vote
        &0_u64,           // amend_window
        &0_u64,           // timelock_duration
        &0_i128,          // veto_threshold
        &0_u32,           // persistent_storage_ttl
    );

    Suite { env, gov, token, admin }
}

fn new_proposal(s: &Suite, quorum: i128, duration: u64) -> u64 {
    let proposer = Address::generate(&s.env);
    s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "E2E proposal"),
        &String::from_str(&s.env, "Lifecycle test description"),
        &quorum,
        &duration,
        &Vec::new(&s.env),
    )
}

fn mint_vote(s: &Suite, amount: i128, proposal_id: u64, vote: Vote) -> Address {
    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &amount);
    s.gov.cast_vote(&voter, &proposal_id, &vote);
    voter
}

fn advance(s: &Suite, seconds: u64) {
    s.env.ledger().with_mut(|l| l.timestamp += seconds);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 1: Active (proposal starts in Active, readable immediately)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_new_proposal_is_active() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);
    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Active);
    assert_eq!(p.votes_yes, 0);
    assert_eq!(p.votes_no, 0);
    assert_eq!(p.votes_abstain, 0);
    assert_eq!(p.quorum, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 2: Passed → Executed (full happy path)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_lifecycle_passed_then_executed() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);

    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Passed);

    s.gov.execute(&s.admin, &id);
    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Executed);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 3: Rejected — quorum not met
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_lifecycle_rejected_quorum_not_met() {
    let s = make_suite();
    let id = new_proposal(&s, 200, 3600);

    // Only 100 tokens vote Yes; quorum requires 200
    mint_vote(&s, 100, id, Vote::Yes);

    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 3: Rejected — quorum met but No wins
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_lifecycle_rejected_no_wins() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 300, id, Vote::No);
    mint_vote(&s, 100, id, Vote::Yes);

    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 3: Rejected — tie (yes == no) → rejection
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_lifecycle_rejected_on_tie() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 150, id, Vote::Yes);
    mint_vote(&s, 150, id, Vote::No);

    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE 4: Cancelled — admin cancels an active proposal
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_lifecycle_cancelled_by_admin() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);

    // Cancel before voting period ends
    s.gov.cancel(&s.admin, &id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Cancelled);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-voter: three voters, each type, quorum met → Passed
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_multi_voter_all_vote_types_passed() {
    let s = make_suite();
    let id = new_proposal(&s, 300, 3600);

    mint_vote(&s, 200, id, Vote::Yes);     // yes: 200
    mint_vote(&s, 100, id, Vote::No);      // no: 100
    mint_vote(&s, 150, id, Vote::Abstain); // abstain: 150 (counts to quorum)

    // Total = 450 >= quorum 300; yes(200) > no(100) → Passed
    advance(&s, 3601);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed);
    assert_eq!(p.votes_yes, 200);
    assert_eq!(p.votes_no, 100);
    assert_eq!(p.votes_abstain, 150);
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstain only: counts to quorum but doesn't flip outcome → Rejected (yes=0, no=0)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_abstain_only_meets_quorum_but_rejected() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Abstain);

    // Quorum met (200 >= 100), but yes(0) is not > no(0) → Rejected
    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Rejected);
}

// ─────────────────────────────────────────────────────────────────────────────
// Double-vote prevention
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_double_vote_rejected() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &500);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Second vote from same address must fail with AlreadyVoted
    let result = s.gov.try_cast_vote(&voter, &id, &Vote::No);
    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::AlreadyVoted
    );

    // Tally unchanged
    assert_eq!(s.gov.get_proposal(&id).votes_yes, 500);
    assert_eq!(s.gov.get_proposal(&id).votes_no, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vote weight validation: weight = balance at vote time
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_vote_weight_equals_balance_at_vote_time() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &750);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    // Tally must reflect the balance at vote time (750)
    assert_eq!(s.gov.get_proposal(&id).votes_yes, 750);

    // Verify VoteRecord weight
    let record = s.gov.get_vote(&id, &voter).expect("vote record must exist");
    assert_eq!(record.weight, 750);
}

// ─────────────────────────────────────────────────────────────────────────────
// No voting power: voter with 0 balance cannot vote
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_zero_balance_cannot_vote() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let voter = Address::generate(&s.env);
    // Mint 0 — voter has no tokens
    let result = s.gov.try_cast_vote(&voter, &id, &Vote::Yes);
    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::NoVotingPower
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// has_voted reflects reality correctly
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_has_voted_flag_accurate() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &200);

    assert!(!s.gov.has_voted(&id, &voter));
    s.gov.cast_vote(&voter, &id, &Vote::Abstain);
    assert!(s.gov.has_voted(&id, &voter));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cannot finalise while voting is still open
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_finalise_before_end_time_fails() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);

    // Voting period not over yet (only 1800 s elapsed of 3600)
    advance(&s, 1800);
    let result = s.gov.try_finalise(&id);
    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::VotingStillOpen
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cannot execute unless Passed
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_execute_non_passed_proposal_fails() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    // Proposal is still Active
    let result = s.gov.try_execute(&s.admin, &id);
    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::ProposalNotPassed
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proposal count increments per creation
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_proposal_count_increments() {
    let s = make_suite();
    assert_eq!(s.gov.proposal_count(), 0);

    new_proposal(&s, 100, 3600);
    assert_eq!(s.gov.proposal_count(), 1);

    new_proposal(&s, 100, 3600);
    assert_eq!(s.gov.proposal_count(), 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-voter full lifecycle: 5 voters → Passed → Executed
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_five_voters_lifecycle_passed_executed() {
    let s = make_suite();
    let id = new_proposal(&s, 1000, 3600);

    // 3 Yes, 1 No, 1 Abstain
    mint_vote(&s, 400, id, Vote::Yes);
    mint_vote(&s, 300, id, Vote::Yes);
    mint_vote(&s, 200, id, Vote::Yes);
    mint_vote(&s, 150, id, Vote::No);
    mint_vote(&s, 100, id, Vote::Abstain);

    // total=1150 >= quorum=1000; yes=900 > no=150 → Passed
    advance(&s, 3601);
    s.gov.finalise(&id);
    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed);
    assert_eq!(p.votes_yes, 900);
    assert_eq!(p.votes_no, 150);
    assert_eq!(p.votes_abstain, 100);

    s.gov.execute(&s.admin, &id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Executed);
}

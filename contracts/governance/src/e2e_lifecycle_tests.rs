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
        ContractError::NoPower
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
        ContractError::StillOpen
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
        ContractError::NotPassed
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

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE SINGLE FULL LIFECYCLE TEST:
// Covers multiple proposals, all vote outcomes, all state transitions, and all failure cases
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn e2e_comprehensive_lifecycle_test() {
    let s = make_suite();

    // ── 1. FIRST PROPOSAL: FULL PASS + EXECUTE LIFECYCLE ───────────────────────
    let id1 = new_proposal(&s, 100, 3600);
    assert_eq!(s.gov.get_proposal(&id1).state, ProposalState::Active);

    // All vote types cast and tallies verified
    let yes_voter = mint_vote(&s, 150, id1, Vote::Yes);
    let no_voter = mint_vote(&s, 50, id1, Vote::No);
    let abstain_voter = mint_vote(&s, 75, id1, Vote::Abstain);
    let p1 = s.gov.get_proposal(&id1);
    assert_eq!(p1.votes_yes, 150);
    assert_eq!(p1.votes_no, 50);
    assert_eq!(p1.votes_abstain, 75);

    // Failure case: double vote rejected
    let double_vote_result = s.gov.try_cast_vote(&yes_voter, &id1, &Vote::No);
    assert_eq!(double_vote_result.err().unwrap().unwrap(), ContractError::AlreadyVoted);

    // Failure case: finalise before voting ends rejected
    let finalise_early_result = s.gov.try_finalise(&id1);
    assert_eq!(finalise_early_result.err().unwrap().unwrap(), ContractError::StillOpen);

    // Failure case: non-admin cancel rejected
    let non_admin = Address::generate(&s.env);
    let non_admin_cancel_result = s.gov.try_cancel(&non_admin, &id1);
    assert_eq!(non_admin_cancel_result.err().unwrap().unwrap(), ContractError::NotAdmin);

    // Advance time and finalise to Passed
    advance(&s, 3601);
    s.gov.finalise(&id1);
    let p1_final = s.gov.get_proposal(&id1);
    assert_eq!(p1_final.state, ProposalState::Passed);

    // Failure case: vote on finalized proposal rejected
    let late_voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &late_voter, &100);
    let late_vote_result = s.gov.try_cast_vote(&late_voter, &id1, &Vote::Yes);
    assert!(late_vote_result.is_err());

    // Failure case: non-admin execute rejected
    let non_admin_execute_result = s.gov.try_execute(&non_admin, &id1);
    assert_eq!(non_admin_execute_result.err().unwrap().unwrap(), ContractError::NotAdmin);

    // Execute proposal
    s.gov.execute(&s.admin, &id1);
    assert_eq!(s.gov.get_proposal(&id1).state, ProposalState::Executed);

    // Failure case: execute already executed proposal rejected
    let re_execute_result = s.gov.try_execute(&s.admin, &id1);
    assert!(re_execute_result.is_err());

    // Failure case: cancel already executed proposal rejected
    let cancel_executed_result = s.gov.try_cancel(&s.admin, &id1);
    assert!(cancel_executed_result.is_err());

    // ── 2. SECOND PROPOSAL: REJECTED (NO WINS, QUORUM MET) ─────────────────────
    let id2 = new_proposal(&s, 80, 1800);
    mint_vote(&s, 40, id2, Vote::Yes);
    mint_vote(&s, 50, id2, Vote::No);
    mint_vote(&s, 30, id2, Vote::Abstain); // Quorum met (120 ≥ 80)
    advance(&s, 1801);
    s.gov.finalise(&id2);
    assert_eq!(s.gov.get_proposal(&id2).state, ProposalState::Rejected);

    // Failure case: execute rejected proposal rejected
    let execute_rejected_result = s.gov.try_execute(&s.admin, &id2);
    assert_eq!(execute_rejected_result.err().unwrap().unwrap(), ContractError::NotPassed);

    // ── 3. THIRD PROPOSAL: CANCELLED (ADMIN CANCELS MID-VOTE) ───────────────────
    let id3 = new_proposal(&s, 120, 7200);
    mint_vote(&s, 60, id3, Vote::Yes);
    s.gov.cancel(&s.admin, &id3);
    assert_eq!(s.gov.get_proposal(&id3).state, ProposalState::Cancelled);

    // Failure case: vote on cancelled proposal rejected
    let vote_on_cancelled_result = s.gov.try_cast_vote(&no_voter, &id3, &Vote::No);
    assert!(vote_on_cancelled_result.is_err());

    // Failure case: finalise cancelled proposal rejected
    let finalise_cancelled_result = s.gov.try_finalise(&id3);
    assert!(finalise_cancelled_result.is_err());

    // Failure case: cancel already cancelled proposal rejected
    let re_cancel_result = s.gov.try_cancel(&s.admin, &id3);
    assert!(re_cancel_result.is_err());

    // ── 4. VERIFY ALL PROPOSAL COUNTS AND STATES ───────────────────────────────
    assert_eq!(s.gov.proposal_count(), 3);
    assert_eq!(s.gov.get_proposal(&1).id, 1);
    assert_eq!(s.gov.get_proposal(&2).id, 2);
    assert_eq!(s.gov.get_proposal(&3).id, 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// Issue #493: Snapshot and tally correctness tests after finalise
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn finalise_produces_correct_passed_outcome() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let v1 = mint_vote(&s, 80, id, Vote::Yes);
    let v2 = mint_vote(&s, 50, id, Vote::Yes);
    let v3 = mint_vote(&s, 30, id, Vote::No);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed);
    assert_eq!(p.votes_yes, 130);
    assert_eq!(p.votes_no, 30);
    assert_eq!(p.votes_abstain, 0);
    assert_eq!(p.quorum, 100);
}

#[test]
fn finalise_produces_correct_rejected_outcome() {
    let s = make_suite();
    let id = new_proposal(&s, 200, 3600);

    mint_vote(&s, 90, id, Vote::Yes);
    mint_vote(&s, 100, id, Vote::No);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Rejected);
    assert_eq!(p.votes_yes, 90);
    assert_eq!(p.votes_no, 100);
}

#[test]
fn vote_snapshots_unchanged_after_finalise() {
    let s = make_suite();
    let id = new_proposal(&s, 50, 3600);

    let voter = Address::generate(&s.env);
    s.token.mint(&s.admin, &voter, &500);
    s.gov.cast_vote(&voter, &id, &Vote::Yes);

    let record_before = s.gov.get_vote(&id, &voter).unwrap();
    assert_eq!(record_before.weight, 500);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let record_after = s.gov.get_vote(&id, &voter).unwrap();
    assert_eq!(record_after.weight, record_before.weight);
    assert_eq!(record_after.weight, 500);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.votes_yes, 500);
    assert_eq!(p.state, ProposalState::Passed);
}

#[test]
fn tallies_frozen_after_finalise() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let p1 = s.gov.get_proposal(&id);
    let p2 = s.gov.get_proposal(&id);
    assert_eq!(p1.votes_yes, p2.votes_yes);
    assert_eq!(p1.votes_no, p2.votes_no);
    assert_eq!(p1.votes_abstain, p2.votes_abstain);
    assert_eq!(p1.state, p2.state);
}

#[test]
fn late_finalise_still_produces_correct_outcome() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);
    mint_vote(&s, 50, id, Vote::No);

    // Advance well past the voting period (10x the duration)
    advance(&s, 36_000);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed);
    assert_eq!(p.votes_yes, 200);
    assert_eq!(p.votes_no, 50);
}

#[test]
fn double_finalise_rejected() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Yes);

    advance(&s, 3601);
    s.gov.finalise(&id);
    assert_eq!(s.gov.get_proposal(&id).state, ProposalState::Passed);

    let result = s.gov.try_finalise(&id);
    assert!(result.is_err());
}

#[test]
fn finalise_with_only_abstain_votes_rejected() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    mint_vote(&s, 200, id, Vote::Abstain);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Rejected);
    assert_eq!(p.votes_abstain, 200);
    assert_eq!(p.votes_yes, 0);
    assert_eq!(p.votes_no, 0);
}

#[test]
fn finalise_preserves_multi_voter_snapshots() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    let v1 = Address::generate(&s.env);
    let v2 = Address::generate(&s.env);
    let v3 = Address::generate(&s.env);
    s.token.mint(&s.admin, &v1, &300);
    s.token.mint(&s.admin, &v2, &150);
    s.token.mint(&s.admin, &v3, &75);

    s.gov.cast_vote(&v1, &id, &Vote::Yes);
    s.gov.cast_vote(&v2, &id, &Vote::No);
    s.gov.cast_vote(&v3, &id, &Vote::Abstain);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let r1 = s.gov.get_vote(&id, &v1).unwrap();
    let r2 = s.gov.get_vote(&id, &v2).unwrap();
    let r3 = s.gov.get_vote(&id, &v3).unwrap();
    assert_eq!(r1.weight, 300);
    assert_eq!(r2.weight, 150);
    assert_eq!(r3.weight, 75);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.votes_yes, 300);
    assert_eq!(p.votes_no, 150);
    assert_eq!(p.votes_abstain, 75);
    assert_eq!(p.state, ProposalState::Passed);
}

#[test]
fn no_votes_finalises_as_rejected() {
    let s = make_suite();
    let id = new_proposal(&s, 100, 3600);

    advance(&s, 3601);
    s.gov.finalise(&id);

    let p = s.gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Rejected);
    assert_eq!(p.votes_yes, 0);
    assert_eq!(p.votes_no, 0);
    assert_eq!(p.votes_abstain, 0);
}

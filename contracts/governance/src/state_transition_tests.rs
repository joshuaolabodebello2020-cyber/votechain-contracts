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

//! Comprehensive state transition tests for proposal lifecycle.
//!
//! These tests verify all permitted and forbidden state transitions
//! to prevent lifecycle bugs and ensure the state machine is correctly enforced.

#![cfg(test)]

use soroban_sdk::Address;
use crate::types::{ContractError, ProposalState, Vote};
use crate::test_helpers::{setup_env, TryMethods};

// =============================================================================
// Permitted State Transition Tests
// =============================================================================

#[test]
fn test_active_to_passed_with_quorum_met() {
    let t = setup_env();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100, // quorum
        &3600, // duration
        &Vec::new(&t.env),
    );

    // Vote to meet quorum
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Advance time past end_time
    t.env.ledger().with_mut(|l| l.timestamp += 3601);

    // Finalise should transition to Passed
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);
}

#[test]
fn test_active_to_rejected_below_quorum() {
    let t = setup_env();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &1000, // high quorum
        &3600,
        &Vec::new(&t.env),
    );

    // Vote but don't meet quorum
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Advance time past end_time
    t.env.ledger().with_mut(|l| l.timestamp += 3601);

    // Finalise should transition to Rejected
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);
}

#[test]
fn test_active_to_rejected_yes_equals_no() {
    let t = setup_env();
    let voter1 = Address::generate(&t.env);
    let voter2 = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter1,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Vote with equal yes and no (tie)
    t.client.cast_vote(&voter1, &id, &Vote::Yes);
    t.client.cast_vote(&voter2, &id, &Vote::No);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Advance time past end_time
    t.env.ledger().with_mut(|l| l.timestamp += 3601);

    // Finalise should transition to Rejected (tie goes to rejection)
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);
}

#[test]
fn test_active_to_rejected_yes_less_than_no() {
    let t = setup_env();
    let voter1 = Address::generate(&t.env);
    let voter2 = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter1,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Vote with more no than yes
    t.client.cast_vote(&voter1, &id, &Vote::Yes);
    t.client.cast_vote(&voter2, &id, &Vote::No);
    t.client.cast_vote(&voter2, &id, &Vote::No); // Double no
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Advance time past end_time
    t.env.ledger().with_mut(|l| l.timestamp += 3601);

    // Finalise should transition to Rejected
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);
}

#[test]
fn test_active_to_cancelled_by_admin() {
    let t = setup_env();
    let admin = t.admin.clone();
    let proposer = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &proposer,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Admin cancels the proposal
    t.client.cancel(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Cancelled);
}

#[test]
fn test_passed_to_executed_by_admin() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Vote and finalise to Passed
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);

    // Admin executes the proposal
    t.client.execute(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Executed);
}

// =============================================================================
// Forbidden State Transition Tests
// =============================================================================

#[test]
fn test_forbid_execute_active_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Active);

    // Attempting to execute an Active proposal should fail
    let result = t.client.try_execute(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotPassed));
}

#[test]
fn test_forbid_execute_rejected_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &1000, // high quorum to ensure rejection
        &3600,
        &Vec::new(&t.env),
    );

    // Vote and finalise to Rejected
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);

    // Attempting to execute a Rejected proposal should fail
    let result = t.client.try_execute(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotPassed));
}

#[test]
fn test_forbid_execute_cancelled_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let proposer = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &proposer,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Cancel the proposal
    t.client.cancel(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Cancelled);

    // Attempting to execute a Cancelled proposal should fail
    let result = t.client.try_execute(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotPassed));
}

#[test]
fn test_forbid_execute_already_executed_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Execute the proposal
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    t.client.execute(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Executed);

    // Attempting to execute again should fail
    let result = t.client.try_execute(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotPassed));
}

#[test]
fn test_forbid_cancel_passed_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Finalise to Passed
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);

    // Attempting to cancel a Passed proposal should fail
    let result = t.client.try_cancel(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_cancel_rejected_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &1000, // high quorum
        &3600,
        &Vec::new(&t.env),
    );

    // Finalise to Rejected
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);

    // Attempting to cancel a Rejected proposal should fail
    let result = t.client.try_cancel(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_cancel_executed_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Execute the proposal
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    t.client.execute(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Executed);

    // Attempting to cancel an Executed proposal should fail
    let result = t.client.try_cancel(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_cancel_already_cancelled_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let proposer = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &proposer,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Cancel the proposal
    t.client.cancel(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Cancelled);

    // Attempting to cancel again should fail
    let result = t.client.try_cancel(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_finalise_passed_proposal() {
    let t = setup_env();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Finalise to Passed
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);

    // Attempting to finalise again should fail
    let result = t.client.try_finalise(&id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_finalise_rejected_proposal() {
    let t = setup_env();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &1000, // high quorum
        &3600,
        &Vec::new(&t.env),
    );

    // Finalise to Rejected
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Rejected);

    // Attempting to finalise again should fail
    let result = t.client.try_finalise(&id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_finalise_cancelled_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let proposer = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &proposer,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Cancel the proposal
    t.client.cancel(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Cancelled);

    // Attempting to finalise should fail
    let result = t.client.try_finalise(&id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_forbid_finalise_executed_proposal() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Execute the proposal
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    t.client.execute(&admin, &id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Executed);

    // Attempting to finalise should fail
    let result = t.client.try_finalise(&id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

// =============================================================================
// State Invariant Tests
// =============================================================================

#[test]
fn test_vote_tallies_remain_non_negative_after_transitions() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Cast votes
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.client.cast_vote(&voter, &id, &Vote::No);
    t.client.cast_vote(&voter, &id, &Vote::Abstain);

    let proposal = t.client.get_proposal(&id);
    assert!(proposal.votes_yes >= 0);
    assert!(proposal.votes_no >= 0);
    assert!(proposal.votes_abstain >= 0);

    // Finalise
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);

    let proposal = t.client.get_proposal(&id);
    assert!(proposal.votes_yes >= 0);
    assert!(proposal.votes_no >= 0);
    assert!(proposal.votes_abstain >= 0);

    // Execute
    t.client.execute(&admin, &id);

    let proposal = t.client.get_proposal(&id);
    assert!(proposal.votes_yes >= 0);
    assert!(proposal.votes_no >= 0);
    assert!(proposal.votes_abstain >= 0);
}

#[test]
fn test_state_transition_check_enforced_in_finalise() {
    let t = setup_env();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Vote and finalise to Passed
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);

    // Attempting to finalise again should fail due to state transition check
    let result = t.client.try_finalise(&id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

#[test]
fn test_state_transition_check_enforced_in_execute() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Attempting to execute Active proposal should fail
    let result = t.client.try_execute(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotPassed));
}

#[test]
fn test_state_transition_check_enforced_in_cancel() {
    let t = setup_env();
    let admin = t.admin.clone();
    let voter = Address::generate(&t.env);
    let id = t.client.create_proposal(
        &voter,
        &String::from_str(&t.env, "Test Proposal"),
        &String::from_str(&t.env, "Description"),
        &100,
        &3600,
        &Vec::new(&t.env),
    );

    // Finalise to Passed
    t.client.cast_vote(&voter, &id, &Vote::Yes);
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);

    // Attempting to cancel Passed proposal should fail
    let result = t.client.try_cancel(&admin, &id);
    assert_eq!(result, Err(ContractError::ProposalNotActive));
}

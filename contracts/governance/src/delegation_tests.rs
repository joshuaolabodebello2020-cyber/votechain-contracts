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

//! Tests for SC-005 vote delegation.

use soroban_sdk::{symbol_short, testutils::Address as _, testutils::Events, testutils::Ledger, Address, Env, IntoVal, String, Vec};

use crate::test_helpers::{create_test_proposal, default_options, mint_and_vote, setup_env};
use crate::types::{GovernanceOptions, ProposalState, Vote};
use crate::{GovernanceContract, GovernanceContractClient};

#[test]
fn test_delegate_adds_weight_to_delegatee_vote() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let delegatee = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);

    tok.mint(&t.admin, &delegator, &500_000);
    tok.mint(&t.admin, &delegatee, &100_000);

    t.client.delegate(&delegator, &delegatee);
    assert_eq!(t.client.get_delegate(&delegator), Some(delegatee.clone()));
    assert_eq!(t.client.get_delegated_weight(&delegatee), 500_000);

    let id = create_test_proposal(&t, &t.admin);
    t.client.cast_vote(&delegatee, &id, &Vote::Yes);

    let record = t.client.get_vote(&id, &delegatee).unwrap();
    assert_eq!(record.weight, 600_000);
    assert_eq!(t.client.get_proposal(&id).votes_yes, 600_000);
}

#[test]
fn test_revoke_delegation_restores_direct_voting() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let delegatee = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);

    tok.mint(&t.admin, &delegator, &300_000);
    t.client.delegate(&delegator, &delegatee);
    assert_eq!(t.client.get_delegated_weight(&delegatee), 300_000);

    t.client.revoke_delegation(&delegator);
    assert_eq!(t.client.get_delegate(&delegator), None);
    assert_eq!(t.client.get_delegated_weight(&delegatee), 0);

    let id = create_test_proposal(&t, &t.admin);
    t.client.cast_vote(&delegator, &id, &Vote::Yes);
    assert_eq!(t.client.get_proposal(&id).votes_yes, 300_000);
}

#[test]
fn test_delegate_to_self_is_noop() {
    let t = setup_env();
    let holder = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &holder, &200_000);

    t.client.delegate(&holder, &holder);
    assert_eq!(t.client.get_delegate(&holder), None);
    assert_eq!(t.client.get_delegated_weight(&holder), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #48)")]
fn test_delegation_cycle_reverts() {
    let t = setup_env();
    let a = Address::generate(&t.env);
    let b = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &a, &100);
    tok.mint(&t.admin, &b, &100);

    t.client.delegate(&a, &b);
    t.client.delegate(&b, &a);
}

#[test]
#[should_panic(expected = "Error(Contract, #49)")]
fn test_delegator_cannot_vote_directly() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let delegatee = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &delegator, &100_000);

    t.client.delegate(&delegator, &delegatee);
    let id = create_test_proposal(&t, &t.admin);
    t.client.cast_vote(&delegator, &id, &Vote::Yes);
}

#[test]
fn test_redelegate_updates_delegated_weight() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let first = Address::generate(&t.env);
    let second = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &delegator, &400_000);

    t.client.delegate(&delegator, &first);
    assert_eq!(t.client.get_delegated_weight(&first), 400_000);

    t.client.delegate(&delegator, &second);
    assert_eq!(t.client.get_delegated_weight(&first), 0);
    assert_eq!(t.client.get_delegated_weight(&second), 400_000);
    assert_eq!(t.client.get_delegate(&delegator), Some(second));
}

#[test]
fn test_delegation_events_emitted() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let delegatee = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &delegator, &250_000);

    t.client.delegate(&delegator, &delegatee);
    let events = t.env.events().all();
    assert!(events.iter().any(|(_, topics, _)| {
        topics == (symbol_short!("deleg"),).into_val(&t.env)
    }));

    t.client.revoke_delegation(&delegator);
    let events = t.env.events().all();
    assert!(events.iter().any(|(_, topics, _)| {
        topics == (symbol_short!("revoke"),).into_val(&t.env)
    }));
}

#[test]
fn test_delegatee_vote_passes_proposal_with_delegated_weight() {
    let t = setup_env();
    let delegator = Address::generate(&t.env);
    let delegatee = Address::generate(&t.env);
    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
    tok.mint(&t.admin, &delegator, &1_000_000);

    t.client.delegate(&delegator, &delegatee);

    let id = t.client.create_proposal(
        &t.admin,
        &String::from_str(&t.env, "Delegation quorum"),
        &String::from_str(&t.env, "desc"),
        &500_000,
        &3600,
        &Vec::new(&t.env),
    );
    t.client.cast_vote(&delegatee, &id, &Vote::Yes);

    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.client.finalise(&id);
    assert_eq!(t.client.get_proposal(&id).state, ProposalState::Passed);
}

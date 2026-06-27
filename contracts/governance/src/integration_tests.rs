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
//! 1. create → vote → finalise as Passed → execute
//! 2. create → vote → finalise as Rejected
//! 3. create → vote (mid-vote) → cancel

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
        &0_u32,         // persistent_storage_ttl
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

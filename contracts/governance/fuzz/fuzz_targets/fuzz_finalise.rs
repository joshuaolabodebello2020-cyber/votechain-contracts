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

//! Fuzz target for `finalise`.
//!
//! Exercises finalise with arbitrary yes/no/abstain distributions and quorums.
//!
//! **Invariants** verified per-run:
//! - `finalise` never panics.
//! - After finalise, state is exactly Passed or Rejected (never Active/Executed/Cancelled).
//! - Outcome matches the arithmetic formula: Passed iff total >= quorum AND yes > no.

#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String as SorobanString, Vec};
use votechain_governance::{GovernanceContract, GovernanceContractClient};
use votechain_governance::types::{ProposalState, Vote};

/// Input layout:
/// [0..8]   w_yes    : u64 → cast as i128
/// [8..16]  w_no     : u64
/// [16..24] w_abstain: u64
/// [24..40] quorum   : i128 (16 bytes)
const HEADER: usize = 40;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER {
        return;
    }

    let w_yes    = u64::from_le_bytes(data[0..8].try_into().unwrap()) as i128 % 1_000_001;
    let w_no     = u64::from_le_bytes(data[8..16].try_into().unwrap()) as i128 % 1_000_001;
    let w_abstain= u64::from_le_bytes(data[16..24].try_into().unwrap()) as i128 % 1_000_001;
    let quorum_raw = i128::from_le_bytes(data[24..40].try_into().unwrap());
    // Clamp quorum to [1, 3_000_000]
    let quorum = (quorum_raw.abs() % 3_000_000).max(1);

    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &100_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &gov_id);
    client.initialize(
        &admin, &tok_id,
        &0_i128, &0_u64, &60_u64, &2_592_000_u64,
        &false, &0_u64, &0_u64, &0_i128, &0_u32,
    );

    let proposer = Address::generate(&env);
    let id = client.create_proposal(
        &proposer,
        &SorobanString::from_str(&env, "fuzz"),
        &SorobanString::from_str(&env, "fuzz description"),
        &quorum,
        &3600_u64,
        &Vec::new(&env),
    );

    if w_yes > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_yes);
        let _ = client.try_cast_vote(&v, &id, &Vote::Yes);
    }
    if w_no > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_no);
        let _ = client.try_cast_vote(&v, &id, &Vote::No);
    }
    if w_abstain > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_abstain);
        let _ = client.try_cast_vote(&v, &id, &Vote::Abstain);
    }

    // Advance past voting period
    env.ledger().with_mut(|l| l.timestamp += 3601);

    // Must not panic
    let result = client.try_finalise(&id);
    if result.is_ok() {
        let p = client.get_proposal(&id);
        // State must be terminal (Passed or Rejected)
        assert!(
            p.state == ProposalState::Passed || p.state == ProposalState::Rejected,
            "unexpected state after finalise: {:?}", p.state
        );

        // Verify outcome matches the arithmetic formula
        let total = p.votes_yes + p.votes_no + p.votes_abstain;
        let expected_passed = total >= quorum && p.votes_yes > p.votes_no;
        if expected_passed {
            assert_eq!(p.state, ProposalState::Passed,
                "expected Passed (yes={} no={} total={} quorum={})",
                p.votes_yes, p.votes_no, total, quorum);
        } else {
            assert_eq!(p.state, ProposalState::Rejected,
                "expected Rejected (yes={} no={} total={} quorum={})",
                p.votes_yes, p.votes_no, total, quorum);
        }
    }
});

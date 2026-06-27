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

//! Fuzz target for `cast_vote`.
//!
//! Creates a proposal then exercises `cast_vote` with arbitrary voter
//! balance, vote type byte, and proposal_id.
//!
//! **Invariants** verified per-run:
//! - `cast_vote` never panics for any input.
//! - After a successful vote, `votes_yes + votes_no + votes_abstain` equals
//!   the voter's minted balance.
//! - A second `cast_vote` from the same address always returns `AlreadyVoted`.

#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};
use votechain_governance::{GovernanceContract, GovernanceContractClient};
use votechain_governance::types::Vote;

/// Input layout:
/// [0..16]  voter_balance : i128
/// [16]     vote_type     : u8 (0=Yes, 1=No, anything else=Abstain)
/// [17..25] extra_id      : u64 (used as a second proposal_id to hit ProposalNotFound)
const HEADER: usize = 25;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER {
        return;
    }

    let voter_balance = i128::from_le_bytes(data[0..16].try_into().unwrap());
    let vote_byte = data[16];
    let extra_id = u64::from_le_bytes(data[17..25].try_into().unwrap());

    // Clamp balance to [0, 10_000_000] to keep the env fast
    let voter_balance = voter_balance.abs().min(10_000_000);

    let vote = match vote_byte % 3 {
        0 => Vote::Yes,
        1 => Vote::No,
        _ => Vote::Abstain,
    };

    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &gov_id);
    client.initialize(
        &admin, &tok_id,
        &0_i128, &0_u64, &60_u64, &2_592_000_u64,
        &false, &0_u64, &0_u64, &0_i128, &0_u32,
    );

    // Create a valid proposal
    let proposer = Address::generate(&env);
    let proposal_id = client.create_proposal(
        &proposer,
        &SorobanString::from_str(&env, "fuzz"),
        &SorobanString::from_str(&env, "fuzz description"),
        &100_i128,
        &3600_u64,
        &Vec::new(&env),
    );

    // Fuzz: vote with the fuzzed balance
    let voter = Address::generate(&env);
    if voter_balance > 0 {
        tok.mint(&admin, &voter, &voter_balance);
    }
    let result = client.try_cast_vote(&voter, &proposal_id, &vote);

    if voter_balance > 0 {
        // If vote succeeded, tally must reflect exact weight
        if result.is_ok() {
            let p = client.get_proposal(&proposal_id);
            let tally = p.votes_yes + p.votes_no + p.votes_abstain;
            assert_eq!(tally, voter_balance, "tally should equal voter balance");

            // Second vote must be rejected
            let r2 = client.try_cast_vote(&voter, &proposal_id, &vote);
            assert!(r2.is_err(), "second vote must be rejected");
        }
    }

    // Fuzz: vote on a non-existent proposal_id — must not panic
    let _ = client.try_cast_vote(&voter, &extra_id, &vote);
});

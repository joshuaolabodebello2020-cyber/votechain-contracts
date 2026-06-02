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

//! Fuzz target for `create_proposal`.
//!
//! Exercises all four user-controlled inputs — title, description, quorum,
//! and duration — with arbitrary byte data.
//!
//! **Invariant**: `create_proposal` must never panic for any input.
//! It may return `Ok` or any `ContractError` variant, but must not abort,
//! overflow, or produce undefined behaviour.

#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString};
use votechain_governance::{GovernanceContract, GovernanceContractClient};

/// Input layout (little-endian):
/// ```
/// [0]      title_len  : u8
/// [1]      desc_len   : u8
/// [2..18]  quorum     : i128 (16 bytes)
/// [18..26] duration   : u64  (8 bytes)
/// [26..]   title_bytes ++ desc_bytes
/// ```
const HEADER: usize = 26;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER {
        return;
    }

    let title_len = data[0] as usize;
    let desc_len = data[1] as usize;
    let quorum = i128::from_le_bytes(data[2..18].try_into().unwrap());
    let duration = u64::from_le_bytes(data[18..26].try_into().unwrap());

    let body = &data[HEADER..];
    if body.len() < title_len + desc_len {
        return;
    }

    // Convert raw bytes to strings via lossy UTF-8 so soroban_sdk::String
    // can accept them. Non-UTF-8 sequences become U+FFFD replacement chars,
    // which still exercises the printable-byte and length validators.
    let title_str = std::string::String::from_utf8_lossy(&body[..title_len]);
    let desc_str = std::string::String::from_utf8_lossy(&body[title_len..title_len + desc_len]);

    let env = Env::default();
    env.mock_all_auths();

    let gov_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &gov_id);

    let admin = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_000_i128);

    client.initialize(
        &admin,
        &tok_id,
        &0_i128,        // no min balance
        &0_u64,         // no cooldown
        &60_u64,        // min duration
        &2_592_000_u64, // max duration (30 days)
        &false,
        &0_u64,
    );

    let proposer = Address::generate(&env);
    let title = SorobanString::from_str(&env, &title_str);
    let desc = SorobanString::from_str(&env, &desc_str);

    // Must not panic — only Ok or a ContractError is acceptable.
    let _ = client.try_create_proposal(&proposer, &title, &desc, &quorum, &duration);
});

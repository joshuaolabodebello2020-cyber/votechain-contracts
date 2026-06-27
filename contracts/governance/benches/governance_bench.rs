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

//! Criterion benchmarks for the VoteChain governance contract.
//!
//! These benchmarks run entirely in-process using the Soroban test environment
//! (no network, no WASM compilation per iteration). They measure CPU time for
//! the three critical contract operations:
//!
//! - `create_proposal`  — proposal storage write path
//! - `cast_vote`        — vote storage + tally update
//! - `finalise`         — tally evaluation + state transition
//!
//! Run with:
//!   cargo bench -p votechain-governance
//!
//! Results are written to `target/criterion/`. Compare across commits with
//!   cargo bench -p votechain-governance -- --save-baseline main
//!   cargo bench -p votechain-governance -- --baseline main

use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use soroban_sdk::{testutils::{Address as _, Ledger as _}, Address, Env, String};
use votechain_governance::{GovernanceContract, GovernanceContractClient};
use votechain_governance::types::Vote;

// ── helpers ───────────────────────────────────────────────────────────────────

struct BenchEnv {
    env: Env,
    client: GovernanceContractClient<'static>,
    admin: Address,
    token_id: Address,
}

fn setup() -> BenchEnv {
    let env = Env::default();
    env.mock_all_auths();

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    let admin = Address::generate(&env);
    tok.initialize(&admin, &10_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &gov_id);
    client.initialize(
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

    BenchEnv { env, client, admin, token_id: tok_id }
}

fn make_proposal(b: &BenchEnv) -> u64 {
    let proposer = Address::generate(&b.env);
    b.client.create_proposal(
        &proposer,
        &String::from_str(&b.env, "Bench proposal"),
        &String::from_str(&b.env, "Benchmark description"),
        &100_i128,
        &3600_u64,
    )
}

// ── benchmarks ────────────────────────────────────────────────────────────────

fn bench_create_proposal(c: &mut Criterion) {
    c.bench_function("create_proposal", |b| {
        b.iter_batched(
            setup,
            |bench| {
                let proposer = Address::generate(&bench.env);
                bench.client.create_proposal(
                    &proposer,
                    &String::from_str(&bench.env, "Bench proposal"),
                    &String::from_str(&bench.env, "Benchmark description"),
                    &100_i128,
                    &3600_u64,
                )
            },
            BatchSize::SmallInput,
        )
    });
}

fn bench_cast_vote(c: &mut Criterion) {
    c.bench_function("cast_vote", |b| {
        b.iter_batched(
            || {
                let bench = setup();
                let tok = votechain_token::TokenContractClient::new(&bench.env, &bench.token_id);
                let proposal_id = make_proposal(&bench);
                let voter = Address::generate(&bench.env);
                tok.mint(&bench.admin, &voter, &1_000_i128);
                (bench, proposal_id, voter)
            },
            |(bench, proposal_id, voter)| {
                bench.client.cast_vote(&voter, &proposal_id, &Vote::Yes)
            },
            BatchSize::SmallInput,
        )
    });
}

fn bench_finalise(c: &mut Criterion) {
    c.bench_function("finalise", |b| {
        b.iter_batched(
            || {
                let bench = setup();
                let tok = votechain_token::TokenContractClient::new(&bench.env, &bench.token_id);
                let proposal_id = make_proposal(&bench);
                let voter = Address::generate(&bench.env);
                tok.mint(&bench.admin, &voter, &200_i128);
                bench.client.cast_vote(&voter, &proposal_id, &Vote::Yes);
                bench.env.ledger().with_mut(|l| l.timestamp += 3601);
                (bench, proposal_id)
            },
            |(bench, proposal_id)| bench.client.finalise(&proposal_id),
            BatchSize::SmallInput,
        )
    });
}

criterion_group!(contract_benches, bench_create_proposal, bench_cast_vote, bench_finalise);
criterion_main!(contract_benches);

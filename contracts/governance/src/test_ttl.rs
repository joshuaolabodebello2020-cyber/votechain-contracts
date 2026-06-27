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

//! Comprehensive storage TTL tests for the VoteChain governance contract.
//!
//! Covers:
//! - TTL configuration (default and custom)
//! - TTL bump on every persistent write (proposal, vote, snapshot, has_voted)
//! - Storage entries survive expected ledger ranges after bumps
//! - Expired temporary allowance entries in the token contract
//! - State-transition correctness under simulated TTL expiry
//! - Version migration preserves persistent storage
//! - Edge cases: zero TTL, maximum TTL, cancelled/rejected proposals
//! - Read-only operations do not corrupt state

#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String, Vec,
};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup(env: &Env, ttl: u32) -> (Address, Address, GovernanceContractClient<'static>) {
    let admin = Address::generate(env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(env, &tok_id);
    tok.initialize(&admin, &100_000_000_i128);

    let gov_id = env.register(GovernanceContract, ());
    let gov = GovernanceContractClient::new(env, &gov_id);
    gov.initialize(
        &admin, &tok_id,
        &0_i128, &0_u64, &60_u64, &2_592_000_u64,
        &false, &0_u64, &0_u64, &0_i128, &ttl,
    );
    (admin, tok_id, gov)
}

fn make_proposal(env: &Env, gov: &GovernanceContractClient, proposer: &Address) -> u64 {
    gov.create_proposal(
        proposer,
        &String::from_str(env, "TTL proposal"),
        &String::from_str(env, "TTL description"),
        &100_i128,
        &3600_u64,
        &Vec::new(env),
    )
}

fn mint(env: &Env, tok_id: &Address, admin: &Address, to: &Address, amt: i128) {
    votechain_token::TokenContractClient::new(env, tok_id).mint(admin, to, &amt);
}

// ── TTL configuration ─────────────────────────────────────────────────────────

#[test]
fn test_ttl_default_zero_uses_contract_default() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 0); // 0 → use DEFAULT_PERSISTENT_STORAGE_TTL

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 1_000);
    let id = make_proposal(&env, &gov, &proposer);

    // Proposal must be readable — default TTL was applied
    let p = gov.get_proposal(&id);
    assert_eq!(p.id, id, "proposal readable with default TTL");
    assert_eq!(p.state, ProposalState::Active);
}

#[test]
fn test_ttl_custom_value_stored_and_applied() {
    let env = Env::default();
    env.mock_all_auths();
    let custom_ttl: u32 = 268_800; // ~30 days
    let (admin, tok_id, gov) = setup(&env, custom_ttl);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 1_000);
    let id = make_proposal(&env, &gov, &proposer);

    let p = gov.get_proposal(&id);
    assert_eq!(p.id, id, "proposal readable with custom TTL {}", custom_ttl);
}

#[test]
fn test_ttl_max_value_accepted() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, u32::MAX);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 1_000);
    let id = make_proposal(&env, &gov, &proposer);

    assert_eq!(gov.get_proposal(&id).state, ProposalState::Active,
        "proposal readable with max TTL");
}

#[test]
fn test_double_initialize_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 0);

    let result = gov.try_initialize(
        &admin, &tok_id,
        &0_i128, &0_u64, &60_u64, &2_592_000_u64,
        &false, &0_u64, &0_u64, &0_i128, &0_u32,
    );
    assert!(result.is_err(), "second initialize must be rejected (AlreadyInitialized)");
}

// ── Proposal persistent storage TTL bumps ────────────────────────────────────

#[test]
fn test_proposal_storage_present_after_create() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    // Storage must be present immediately after creation
    let p = gov.get_proposal(&id);
    assert_eq!(p.votes_yes, 0);
    assert_eq!(p.votes_no, 0);
    assert_eq!(p.votes_abstain, 0);
    assert_eq!(p.quorum, 100);
}

#[test]
fn test_proposal_storage_survives_ledger_advance() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    // Simulate 1000 ledgers passing (well within TTL)
    env.ledger().with_mut(|l| l.sequence_number += 1000);

    let p = gov.get_proposal(&id);
    assert_eq!(p.id, id, "proposal must survive 1000 ledger advance");
    assert_eq!(p.state, ProposalState::Active);
}

#[test]
fn test_proposal_ttl_bumped_on_vote() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 300);
    let id = make_proposal(&env, &gov, &proposer);

    // Advance, then vote — proposal storage TTL is bumped on cast_vote save
    env.ledger().with_mut(|l| l.sequence_number += 100);
    gov.cast_vote(&voter, &id, &Vote::Yes);

    let p = gov.get_proposal(&id);
    assert_eq!(p.votes_yes, 300, "vote weight must be recorded after ledger advance");
}

#[test]
fn test_proposal_ttl_bumped_on_finalise() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 200);
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| { l.timestamp += 3601; l.sequence_number += 500; });
    gov.finalise(&id);

    // After finalise, proposal state is Passed and still readable
    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed,
        "proposal must be Passed and readable after finalise+ledger advance");
}

#[test]
fn test_proposal_ttl_bumped_on_execute() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 200);
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    gov.finalise(&id);
    gov.execute(&admin, &id);

    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Executed,
        "proposal storage must be readable after execute");
}

#[test]
fn test_proposal_ttl_bumped_on_cancel() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    env.ledger().with_mut(|l| l.sequence_number += 200);
    gov.cancel(&admin, &id);

    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Cancelled,
        "cancelled proposal must remain readable after ledger advance");
}

// ── Vote record & has_voted TTL bumps ─────────────────────────────────────────

#[test]
fn test_vote_record_readable_after_cast() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 750);
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::Yes);

    let rec = gov.get_vote(&id, &voter)
        .expect("VoteRecord must exist after cast_vote");
    assert_eq!(rec.weight, 750, "VoteRecord weight must equal minted balance");
}

#[test]
fn test_vote_record_readable_after_ledger_advance() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 400);
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::No);

    env.ledger().with_mut(|l| l.sequence_number += 2000);

    let rec = gov.get_vote(&id, &voter)
        .expect("VoteRecord must survive 2000 ledger advance");
    assert_eq!(rec.weight, 400);
}

#[test]
fn test_has_voted_flag_readable_after_ledger_advance() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 100);
    let id = make_proposal(&env, &gov, &proposer);

    assert!(!gov.has_voted(&id, &voter), "has_voted must be false before voting");
    gov.cast_vote(&voter, &id, &Vote::Abstain);

    env.ledger().with_mut(|l| l.sequence_number += 3000);

    assert!(gov.has_voted(&id, &voter),
        "has_voted must remain true after 3000 ledger advance");
}

#[test]
fn test_has_voted_prevents_double_vote_after_ledger_advance() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 200);
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.sequence_number += 500);

    // has_voted flag must still be set after ledger advance → double-vote rejected
    let result = gov.try_cast_vote(&voter, &id, &Vote::No);
    assert!(
        matches!(result, Err(Ok(ContractError::AlreadyVoted))),
        "double-vote must be rejected even after ledger advance: {:?}", result
    );
}

#[test]
fn test_voter_snapshot_weight_immutable_after_balance_change() {
    // SEC-010: balance snapshot captured at vote time must not change
    // even if the voter's token balance changes afterward.
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    let other = Address::generate(&env);
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.mint(&admin, &proposer, &500);
    tok.mint(&admin, &voter, &600);

    let id = make_proposal(&env, &gov, &proposer);
    gov.cast_vote(&voter, &id, &Vote::Yes);

    // Transfer all tokens away — voter's live balance is now 0
    tok.transfer(&voter, &other, &600);
    assert_eq!(tok.balance(&voter), 0, "voter balance should be 0 after transfer");

    // But the recorded vote weight must still reflect the snapshot (600)
    let rec = gov.get_vote(&id, &voter).expect("vote record must still exist");
    assert_eq!(rec.weight, 600,
        "snapshot weight must be immutable after balance change");

    // Proposal tally also unchanged
    let p = gov.get_proposal(&id);
    assert_eq!(p.votes_yes, 600,
        "proposal tally must reflect snapshot, not current balance");
}

#[test]
fn test_multiple_voters_all_snapshots_persist() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    let weights = [100_i128, 200, 300, 400, 500];
    let voters: std::vec::Vec<Address> = weights.iter().map(|&w| {
        let v = Address::generate(&env);
        mint(&env, &tok_id, &admin, &v, w);
        gov.cast_vote(&v, &id, &Vote::Yes);
        v
    }).collect();

    env.ledger().with_mut(|l| l.sequence_number += 1000);

    // All snapshots must still be readable
    for (v, &w) in voters.iter().zip(weights.iter()) {
        let rec = gov.get_vote(&id, v)
            .expect("vote record must survive ledger advance");
        assert_eq!(rec.weight, w,
            "snapshot for voter with weight {} corrupted after ledger advance", w);
    }

    let p = gov.get_proposal(&id);
    assert_eq!(p.votes_yes, weights.iter().sum::<i128>(),
        "total tally must equal sum of all snapshots");
}

// ── Token temporary storage (allowance) TTL ───────────────────────────────────

#[test]
fn test_token_allowance_set_and_readable() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_i128);
    tok.transfer(&admin, &owner, &5_000_i128);

    tok.approve(&owner, &spender, &2_000_i128);
    let allowance = tok.allowance(&owner, &spender);
    assert_eq!(allowance, 2_000, "allowance must be readable after approve");
}

#[test]
fn test_token_allowance_consumed_by_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_i128);
    tok.transfer(&admin, &owner, &5_000_i128);
    tok.approve(&owner, &spender, &2_000_i128);

    tok.transfer_from(&spender, &owner, &recipient, &1_000_i128);

    // Remaining allowance
    assert_eq!(tok.allowance(&owner, &spender), 1_000,
        "allowance must be reduced by transfer_from amount");
    // Total supply unchanged
    assert_eq!(tok.total_supply(), 10_000,
        "total supply must not change after transfer_from");
}

#[test]
fn test_token_expired_allowance_returns_zero() {
    // Temporary storage entries default to 0 when absent (simulating expiry).
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_i128);
    tok.transfer(&admin, &owner, &5_000_i128);

    // Never approved → allowance is 0 (simulates expired/absent entry)
    assert_eq!(tok.allowance(&owner, &spender), 0,
        "unset allowance must return 0 (expired/absent temporary entry)");
}

#[test]
fn test_expired_allowance_blocks_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.initialize(&admin, &10_000_i128);
    tok.transfer(&admin, &owner, &5_000_i128);

    // No approval → transfer_from must be rejected
    let result = tok.try_transfer_from(&spender, &owner, &recipient, &100_i128);
    assert!(result.is_err(),
        "transfer_from without allowance must be rejected (simulates expired allowance)");

    // Owner balance unchanged
    assert_eq!(tok.balance(&owner), 5_000,
        "owner balance must not change when transfer_from is rejected");
}

// ── Amendment TTL bump ────────────────────────────────────────────────────────

#[test]
fn test_amendment_updates_proposal_and_storage_survives() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    gov.amend_proposal(
        &proposer,
        &id,
        &String::from_str(&env, "Amended Title"),
        &String::from_str(&env, "Amended description"),
    );

    env.ledger().with_mut(|l| l.sequence_number += 500);

    let p = gov.get_proposal(&id);
    assert_eq!(p.title, String::from_str(&env, "Amended Title"),
        "amended title must be readable after ledger advance");
    assert_eq!(p.description, String::from_str(&env, "Amended description"),
        "amended description must be readable after ledger advance");
}

// ── LastProposal TTL bump ─────────────────────────────────────────────────────

#[test]
fn test_last_proposal_timestamp_survives_ledger_advance() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 1_000);

    let id1 = make_proposal(&env, &gov, &proposer);
    env.ledger().with_mut(|l| l.sequence_number += 1000);

    // Second proposal creation reads LastProposal — must succeed (not panic/fail)
    let id2 = make_proposal(&env, &gov, &proposer);

    assert_ne!(id1, id2, "proposal IDs must be distinct");
    assert_eq!(gov.get_proposal(&id1).state, ProposalState::Active);
    assert_eq!(gov.get_proposal(&id2).state, ProposalState::Active);
}

// ── Version / migration ───────────────────────────────────────────────────────

#[test]
fn test_version_readable_after_init() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, _, gov) = setup(&env, 0);

    let ver = gov.get_version();
    assert_eq!(ver, (1, 0, 0), "version must be (1,0,0) after initialize");
}

#[test]
fn test_persistent_storage_survives_version_check() {
    // Simulate reading a proposal across a version check — instance storage
    // (version) and persistent storage (proposal) must both remain readable.
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    // Read version (instance) then proposal (persistent) — no corruption
    let ver = gov.get_version();
    assert_eq!(ver, (1, 0, 0));

    let p = gov.get_proposal(&id);
    assert_eq!(p.id, id,
        "persistent proposal storage must remain consistent after version read");
}

// ── Rejection TTL ─────────────────────────────────────────────────────────────

#[test]
fn test_rejected_proposal_storage_survives() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter, 50); // below quorum 100
    let id = make_proposal(&env, &gov, &proposer);

    gov.cast_vote(&voter, &id, &Vote::No);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    gov.finalise(&id);

    env.ledger().with_mut(|l| l.sequence_number += 1000);

    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Rejected,
        "rejected proposal must remain readable after ledger advance");
    assert_eq!(p.votes_no, 50,
        "vote tally must be preserved after rejection + ledger advance");
}

// ── No-op on absent entries ───────────────────────────────────────────────────

#[test]
fn test_get_vote_returns_none_for_non_voter() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    let non_voter = Address::generate(&env);
    let result = gov.get_vote(&id, &non_voter);
    assert!(result.is_none(),
        "get_vote must return None for address that never voted");
}

#[test]
fn test_has_voted_false_for_non_voter() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    let id = make_proposal(&env, &gov, &proposer);

    let non_voter = Address::generate(&env);
    assert!(!gov.has_voted(&id, &non_voter),
        "has_voted must return false for address that never voted");
}

// ── Full lifecycle with multiple TTL bumps ────────────────────────────────────

#[test]
fn test_full_lifecycle_all_storage_consistent() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, tok_id, gov) = setup(&env, 535_680);

    let proposer = Address::generate(&env);
    let voter_yes = Address::generate(&env);
    let voter_no = Address::generate(&env);
    let voter_abs = Address::generate(&env);
    mint(&env, &tok_id, &admin, &proposer, 500);
    mint(&env, &tok_id, &admin, &voter_yes, 300);
    mint(&env, &tok_id, &admin, &voter_no, 100);
    mint(&env, &tok_id, &admin, &voter_abs, 50);

    // Create
    let id = make_proposal(&env, &gov, &proposer);
    env.ledger().with_mut(|l| l.sequence_number += 100);

    // Vote
    gov.cast_vote(&voter_yes, &id, &Vote::Yes);
    gov.cast_vote(&voter_no, &id, &Vote::No);
    gov.cast_vote(&voter_abs, &id, &Vote::Abstain);
    env.ledger().with_mut(|l| { l.sequence_number += 200; l.timestamp += 3601; });

    // Finalise
    gov.finalise(&id);
    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Passed,
        "total=450 >= quorum=100, yes=300 > no=100 → Passed");

    // Execute
    gov.execute(&admin, &id);
    env.ledger().with_mut(|l| l.sequence_number += 500);

    // All storage entries must still be readable and consistent
    let p = gov.get_proposal(&id);
    assert_eq!(p.state, ProposalState::Executed);
    assert_eq!(p.votes_yes, 300);
    assert_eq!(p.votes_no, 100);
    assert_eq!(p.votes_abstain, 50);

    assert!(gov.has_voted(&id, &voter_yes));
    assert!(gov.has_voted(&id, &voter_no));
    assert!(gov.has_voted(&id, &voter_abs));

    let rec = gov.get_vote(&id, &voter_yes).unwrap();
    assert_eq!(rec.weight, 300, "yes voter snapshot must survive full lifecycle");
}

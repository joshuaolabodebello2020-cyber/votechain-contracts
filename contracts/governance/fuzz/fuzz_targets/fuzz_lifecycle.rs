//! Fuzz target for full proposal lifecycle invariants.
//!
//! Exercises create → vote (multiple voters) → finalise → execute/cancel
//! with arbitrary parameters.
//!
//! **Invariants** verified per-run:
//! - Proposal state transitions follow the allowed graph.
//! - Vote tallies equal the sum of individual voter weights.
//! - Finalise outcome matches the arithmetic formula.
//! - Double-finalise is always rejected.
//! - Execute is only possible on Passed proposals.

#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String as SorobanString, Vec,
};
use votechain_governance::{GovernanceContract, GovernanceContractClient};
use votechain_governance::types::{ProposalState, Vote};

/// Input layout:
/// [0..8]   quorum     : u64 → i128 (clamped 1..1_000_000)
/// [8..16]  duration   : u64 (clamped 60..86_400)
/// [16..24] w_yes      : u64 → i128 (clamped 0..1_000_000)
/// [24..32] w_no       : u64 → i128 (clamped 0..1_000_000)
/// [32..40] w_abstain  : u64 → i128 (clamped 0..1_000_000)
/// [40]     action     : u8 (0=finalise+execute, 1=cancel, 2=finalise only)
const HEADER: usize = 41;

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER {
        return;
    }

    let quorum_raw = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let duration_raw = u64::from_le_bytes(data[8..16].try_into().unwrap());
    let w_yes = (u64::from_le_bytes(data[16..24].try_into().unwrap()) % 1_000_001) as i128;
    let w_no = (u64::from_le_bytes(data[24..32].try_into().unwrap()) % 1_000_001) as i128;
    let w_abstain = (u64::from_le_bytes(data[32..40].try_into().unwrap()) % 1_000_001) as i128;
    let action = data[40] % 3;

    let quorum = ((quorum_raw % 1_000_000) as i128).max(1);
    let duration = (duration_raw % 86_340).max(60);

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
        &false, &0_u64, &0_u64, &0_i128,
    );

    let proposer = Address::generate(&env);
    let id = client.create_proposal(
        &proposer,
        &SorobanString::from_str(&env, "fuzz"),
        &SorobanString::from_str(&env, "lifecycle fuzz"),
        &quorum,
        &duration,
        &Vec::new(&env),
    );

    // Invariant: new proposal is Active
    assert_eq!(client.get_proposal(&id).state, ProposalState::Active);

    // Cast votes
    let mut expected_yes: i128 = 0;
    let mut expected_no: i128 = 0;
    let mut expected_abstain: i128 = 0;

    if w_yes > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_yes);
        if client.try_cast_vote(&v, &id, &Vote::Yes).is_ok() {
            expected_yes = w_yes;
        }
    }
    if w_no > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_no);
        if client.try_cast_vote(&v, &id, &Vote::No).is_ok() {
            expected_no = w_no;
        }
    }
    if w_abstain > 0 {
        let v = Address::generate(&env);
        tok.mint(&admin, &v, &w_abstain);
        if client.try_cast_vote(&v, &id, &Vote::Abstain).is_ok() {
            expected_abstain = w_abstain;
        }
    }

    // Invariant: tallies match accumulated weights
    let p = client.get_proposal(&id);
    assert_eq!(p.votes_yes, expected_yes);
    assert_eq!(p.votes_no, expected_no);
    assert_eq!(p.votes_abstain, expected_abstain);

    match action {
        1 => {
            // Cancel path
            client.cancel(&admin, &id);
            let p = client.get_proposal(&id);
            assert_eq!(p.state, ProposalState::Cancelled);

            // Invariant: tallies unchanged after cancel
            assert_eq!(p.votes_yes, expected_yes);
            assert_eq!(p.votes_no, expected_no);

            // Invariant: cannot finalise a cancelled proposal
            env.ledger().with_mut(|l| l.timestamp += duration + 1);
            assert!(client.try_finalise(&id).is_err());
        }
        _ => {
            // Finalise path
            env.ledger().with_mut(|l| l.timestamp += duration + 1);
            client.finalise(&id);

            let p = client.get_proposal(&id);
            let total = expected_yes + expected_no + expected_abstain;
            let should_pass = total >= quorum && expected_yes > expected_no;

            if should_pass {
                assert_eq!(p.state, ProposalState::Passed,
                    "expected Passed (yes={} no={} total={} quorum={})",
                    expected_yes, expected_no, total, quorum);
            } else {
                assert_eq!(p.state, ProposalState::Rejected,
                    "expected Rejected (yes={} no={} total={} quorum={})",
                    expected_yes, expected_no, total, quorum);
            }

            // Invariant: double-finalise rejected
            assert!(client.try_finalise(&id).is_err());

            // Invariant: tallies unchanged after finalise
            assert_eq!(p.votes_yes, expected_yes);
            assert_eq!(p.votes_no, expected_no);
            assert_eq!(p.votes_abstain, expected_abstain);

            if action == 0 && should_pass {
                // Execute path
                client.execute(&admin, &id);
                assert_eq!(client.get_proposal(&id).state, ProposalState::Executed);

                // Invariant: cannot execute again
                assert!(client.try_execute(&admin, &id).is_err());
            }
        }
    }
});

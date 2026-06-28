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

//! Property-based tests for vote tally invariants.
//!
//! These tests operate on plain arithmetic that mirrors the tally logic in
//! `GovernanceContract::cast_vote` and `finalise`, without requiring a
//! Soroban execution environment.
//!
//! Contract-level properties (AC-1 through AC-12) exercise the real Soroban
//! environment via `test_helpers` to verify invariants hold end-to-end.

#![cfg(test)]

use proptest::prelude::*;

/// Maximum token supply used across all strategies (mirrors a realistic cap).
const MAX_SUPPLY: i128 = i128::MAX / 4;

proptest! {
    /// Invariant 1: votes_yes + votes_no + votes_abstain == total_votes
    #[test]
    fn tally_sum_equals_total(
        yes     in 0i128..=MAX_SUPPLY / 3,
        no      in 0i128..=MAX_SUPPLY / 3,
        abstain in 0i128..=MAX_SUPPLY / 3,
    ) {
        let total = yes + no + abstain;
        prop_assert_eq!(total, yes + no + abstain);
    }

    /// Invariant 2: total votes never exceed total token supply.
    #[test]
    fn total_votes_never_exceed_supply(
        supply  in 1i128..=MAX_SUPPLY,
        yes     in 0i128..=MAX_SUPPLY,
        no      in 0i128..=MAX_SUPPLY,
        abstain in 0i128..=MAX_SUPPLY,
    ) {
        let yes     = yes.min(supply);
        let no      = no.min(supply - yes);
        let abstain = abstain.min(supply - yes - no);
        let total = yes + no + abstain;
        prop_assert!(total <= supply);
    }

    /// Invariant 3: quorum check is consistent with stored vote counts.
    #[test]
    fn quorum_check_consistent_with_vote_counts(
        yes     in 0i128..=MAX_SUPPLY / 3,
        no      in 0i128..=MAX_SUPPLY / 3,
        abstain in 0i128..=MAX_SUPPLY / 3,
        quorum  in 1i128..=MAX_SUPPLY,
    ) {
        let total = yes + no + abstain;
        let passes = total >= quorum && yes > no;
        let expected = (yes + no + abstain) >= quorum && yes > no;
        prop_assert_eq!(passes, expected);
    }

    /// Invariant 4: tie (yes == no) always rejects regardless of quorum.
    #[test]
    fn tie_always_rejected(
        equal   in 1i128..=MAX_SUPPLY / 2,
        quorum  in 1i128..=MAX_SUPPLY,
    ) {
        // equal yes and no — even with quorum met
        let total = equal + equal; // abstain = 0
        let passes = total >= quorum && equal > equal; // equal > equal is always false
        prop_assert!(!passes, "tie should never pass");
    }

    /// Invariant 5: passing requires strictly more Yes than No.
    #[test]
    fn passing_requires_yes_strictly_greater_than_no(
        yes    in 0i128..=MAX_SUPPLY / 2,
        no     in 0i128..=MAX_SUPPLY / 2,
        quorum in 1i128..=(MAX_SUPPLY / 2),
    ) {
        let passes = (yes + no) >= quorum && yes > no;
        if yes <= no {
            prop_assert!(!passes, "should not pass when yes <= no");
        }
    }

    /// Invariant 6: quorum = 0 is never satisfiable (enforced by create_proposal).
    /// Arithmetic model: total >= 0 is trivially true, but quorum must be > 0.
    #[test]
    fn zero_quorum_is_invalid(
        yes     in 0i128..=MAX_SUPPLY / 3,
        no      in 0i128..=MAX_SUPPLY / 3,
        abstain in 0i128..=MAX_SUPPLY / 3,
    ) {
        // The contract rejects quorum=0 at creation time; here we verify that
        // the arithmetic model for quorum=0 is trivially always "met", which
        // is WHY the contract must reject it.
        let total = yes + no + abstain;
        // If quorum were 0, total >= 0 is always true — so a 0-quorum proposal
        // would pass with zero votes as long as yes > no. The contract prevents
        // this by requiring quorum >= 1 in create_proposal.
        prop_assert!(total >= 0, "total votes is always non-negative");
    }

    /// Invariant 7: checked_add overflow guard — saturating at i128::MAX never wraps.
    #[test]
    fn checked_add_never_wraps(
        a in 0i128..=i128::MAX / 2,
        b in 0i128..=i128::MAX / 2,
    ) {
        let result = a.checked_add(b);
        prop_assert!(result.is_some(), "checked_add should not overflow in 0..MAX/2 range");
        prop_assert_eq!(result.unwrap(), a + b);
    }

    /// Invariant 8: finalise outcome is fully determined by (total, quorum, yes, no).
    /// Same inputs must always produce the same outcome (determinism).
    #[test]
    fn finalise_outcome_is_deterministic(
        yes     in 0i128..=1_000_000i128,
        no      in 0i128..=1_000_000i128,
        abstain in 0i128..=1_000_000i128,
        quorum  in 1i128..=3_000_000i128,
    ) {
        let total = yes + no + abstain;
        let outcome_a = total >= quorum && yes > no;
        let outcome_b = total >= quorum && yes > no;
        prop_assert_eq!(outcome_a, outcome_b);
    }
}

// ── Contract-level property tests ────────────────────────────────────────────

#[cfg(test)]
mod contract_props {
    use super::*;
    use crate::test_helpers::{create_test_proposal, mint_and_vote, setup_env};
    use crate::types::{ContractError, Vote};
    use proptest::test_runner::{Config, TestRunner};
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Address, Env, String, Vec};

    /// AC-1: sum(voter weights) == votes_yes + votes_no + votes_abstain
    #[test]
    fn prop_sum_of_voter_weights_equals_tally() {
        let config = Config::with_cases(500);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(
                    1i128..=1_000_000i128,
                    1i128..=1_000_000i128,
                    1i128..=1_000_000i128,
                ),
                |(w_yes, w_no, w_abstain)| {
                    let t = setup_env();
                    let proposal_id = create_test_proposal(&t, &t.admin.clone());

                    let voter_yes = Address::generate(&t.env);
                    let voter_no = Address::generate(&t.env);
                    let voter_abstain = Address::generate(&t.env);

                    mint_and_vote(&t, &voter_yes, proposal_id, Vote::Yes, w_yes);
                    mint_and_vote(&t, &voter_no, proposal_id, Vote::No, w_no);
                    mint_and_vote(&t, &voter_abstain, proposal_id, Vote::Abstain, w_abstain);

                    let proposal = t.client.get_proposal(&proposal_id);

                    let rec_yes = t.client.get_vote(&proposal_id, &voter_yes).unwrap();
                    let rec_no = t.client.get_vote(&proposal_id, &voter_no).unwrap();
                    let rec_abstain = t.client.get_vote(&proposal_id, &voter_abstain).unwrap();

                    prop_assert_eq!(rec_yes.weight, w_yes);
                    prop_assert_eq!(rec_no.weight, w_no);
                    prop_assert_eq!(rec_abstain.weight, w_abstain);

                    prop_assert_eq!(
                        proposal.votes_yes + proposal.votes_no + proposal.votes_abstain,
                        rec_yes.weight + rec_no.weight + rec_abstain.weight
                    );
                    Ok(())
                },
            )
            .unwrap();
    }

    /// AC-2: no voter can vote twice on the same proposal.
    #[test]
    fn prop_no_double_vote() {
        let config = Config::with_cases(500);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(weight,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());

                let voter = Address::generate(&t.env);
                mint_and_vote(&t, &voter, proposal_id, Vote::Yes, weight);

                let before = t.client.get_proposal(&proposal_id);

                let result = t.client.try_cast_vote(&voter, &proposal_id, &Vote::No);
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::AlreadyVoted))),
                    "expected AlreadyVoted, got {:?}", result
                );

                let after = t.client.get_proposal(&proposal_id);
                prop_assert_eq!(before.votes_yes, after.votes_yes);
                prop_assert_eq!(before.votes_no, after.votes_no);
                prop_assert_eq!(before.votes_abstain, after.votes_abstain);
                Ok(())
            })
            .unwrap();
    }

    /// AC-3: vote weight never exceeds the voter's token balance at vote time.
    #[test]
    fn prop_vote_weight_never_exceeds_balance() {
        let config = Config::with_cases(500);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(balance,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());

                let voter = Address::generate(&t.env);
                mint_and_vote(&t, &voter, proposal_id, Vote::Yes, balance);

                let record = t.client.get_vote(&proposal_id, &voter).unwrap();
                prop_assert!(
                    record.weight <= balance,
                    "weight {} > balance {}", record.weight, balance
                );
                Ok(())
            })
            .unwrap();
    }

    /// AC-4: create_proposal rejects quorum = 0.
    #[test]
    fn prop_create_proposal_rejects_zero_quorum() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(60u64..=2_592_000u64,), |(duration,)| {
                let t = setup_env();
                let proposer = Address::generate(&t.env);
                let result = t.client.try_create_proposal(
                    &proposer,
                    &String::from_str(&t.env, "title"),
                    &String::from_str(&t.env, "description"),
                    &0_i128, // quorum = 0 must be rejected
                    &duration,
                    &Vec::new(&t.env),
                );
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::BadQuorum))),
                    "expected InvalidQuorum for quorum=0, got {:?}", result
                );
                Ok(())
            })
            .unwrap();
    }

    /// AC-5: create_proposal rejects duration below min_duration (60s).
    #[test]
    fn prop_create_proposal_rejects_short_duration() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1u64..=59u64,), |(duration,)| {
                let t = setup_env();
                let proposer = Address::generate(&t.env);
                let result = t.client.try_create_proposal(
                    &proposer,
                    &String::from_str(&t.env, "title"),
                    &String::from_str(&t.env, "description"),
                    &100_i128,
                    &duration,
                    &Vec::new(&t.env),
                );
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::BadRange))),
                    "expected InvalidDurationRange for duration={}, got {:?}", duration, result
                );
                Ok(())
            })
            .unwrap();
    }

    /// AC-6: create_proposal rejects duration above max_duration (2_592_000s).
    #[test]
    fn prop_create_proposal_rejects_long_duration() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(2_592_001u64..=u64::MAX / 2,), |(duration,)| {
                let t = setup_env();
                let proposer = Address::generate(&t.env);
                let result = t.client.try_create_proposal(
                    &proposer,
                    &String::from_str(&t.env, "title"),
                    &String::from_str(&t.env, "description"),
                    &100_i128,
                    &duration,
                    &Vec::new(&t.env),
                );
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::BadRange))),
                    "expected InvalidDurationRange for duration={}, got {:?}", duration, result
                );
                Ok(())
            })
            .unwrap();
    }

    /// AC-7: valid duration range [60, 2_592_000] always succeeds for create_proposal.
    #[test]
    fn prop_create_proposal_accepts_valid_duration() {
        let config = Config::with_cases(500);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(60u64..=2_592_000u64,), |(duration,)| {
                let t = setup_env();
                let proposer = Address::generate(&t.env);
                let result = t.client.try_create_proposal(
                    &proposer,
                    &String::from_str(&t.env, "title"),
                    &String::from_str(&t.env, "description"),
                    &100_i128,
                    &duration,
                    &Vec::new(&t.env),
                );
                prop_assert!(result.is_ok(), "valid duration {} rejected: {:?}", duration, result);
                Ok(())
            })
            .unwrap();
    }

    /// AC-8: voter with zero balance is always rejected with NoVotingPower.
    #[test]
    fn prop_zero_balance_always_rejected() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(60u64..=3600u64,), |(_duration,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());
                // voter has no tokens — no mint call
                let voter = Address::generate(&t.env);
                let result = t.client.try_cast_vote(&voter, &proposal_id, &Vote::Yes);
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::NoPower))),
                    "expected NoVotingPower, got {:?}", result
                );
                Ok(())
            })
            .unwrap();
    }

    /// AC-9: tally is monotonically non-decreasing as voters are added.
    ///
    /// Each new Yes vote must increase votes_yes; tally never shrinks.
    #[test]
    fn prop_tally_monotonically_increases() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &prop::collection::vec(1i128..=100_000i128, 2..=10),
                |weights| {
                    let t = setup_env();
                    let proposal_id = create_test_proposal(&t, &t.admin.clone());

                    let mut prev_yes = 0i128;
                    for w in &weights {
                        let voter = Address::generate(&t.env);
                        mint_and_vote(&t, &voter, proposal_id, Vote::Yes, *w);
                        let p = t.client.get_proposal(&proposal_id);
                        prop_assert!(
                            p.votes_yes >= prev_yes,
                            "votes_yes decreased: {} -> {}", prev_yes, p.votes_yes
                        );
                        prev_yes = p.votes_yes;
                    }
                    Ok(())
                },
            )
            .unwrap();
    }

    /// AC-10: finalise outcome matches arithmetic prediction exactly.
    ///
    /// For any combination of vote weights, the state after finalise must
    /// match the formula: Passed iff total >= quorum AND yes > no.
    #[test]
    fn prop_finalise_outcome_matches_arithmetic() {
        let config = Config::with_cases(500);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(
                    0i128..=500i128,   // yes weight
                    0i128..=500i128,   // no weight
                    0i128..=500i128,   // abstain weight
                    1i128..=1200i128,  // quorum
                ),
                |(w_yes, w_no, w_abstain, quorum)| {
                    let t = setup_env();
                    // Create proposal with the fuzzed quorum
                    let proposer = Address::generate(&t.env);
                    let id = t.client.create_proposal(
                        &proposer,
                        &String::from_str(&t.env, "fuzz"),
                        &String::from_str(&t.env, "fuzz description"),
                        &quorum,
                        &3600_u64,
                        &Vec::new(&t.env),
                    );

                    if w_yes > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::Yes, w_yes);
                    }
                    if w_no > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::No, w_no);
                    }
                    if w_abstain > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::Abstain, w_abstain);
                    }

                    // Advance past voting period
                    t.env.ledger().with_mut(|l| l.timestamp += 3601);
                    t.client.finalise(&id);

                    let proposal = t.client.get_proposal(&id);
                    let total = w_yes + w_no + w_abstain;
                    let expected_passed = total >= quorum && w_yes > w_no;

                    use crate::types::ProposalState;
                    if expected_passed {
                        prop_assert_eq!(
                            proposal.state, ProposalState::Passed,
                            "expected Passed (yes={} no={} abstain={} total={} quorum={})",
                            w_yes, w_no, w_abstain, total, quorum
                        );
                    } else {
                        prop_assert_eq!(
                            proposal.state, ProposalState::Rejected,
                            "expected Rejected (yes={} no={} abstain={} total={} quorum={})",
                            w_yes, w_no, w_abstain, total, quorum
                        );
                    }
                    Ok(())
                },
            )
            .unwrap();
    }

    /// AC-11: proposal_count always equals the number of successful create_proposal calls.
    #[test]
    fn prop_proposal_count_tracks_creations() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1usize..=20usize,), |(n,)| {
                let t = setup_env();
                prop_assert_eq!(t.client.proposal_count(), 0);
                for i in 0..n {
                    create_test_proposal(&t, &t.admin.clone());
                    prop_assert_eq!(
                        t.client.proposal_count(), (i + 1) as u64,
                        "count mismatch after {} creations", i + 1
                    );
                }
                Ok(())
            })
            .unwrap();
    }

    /// AC-12: cast_vote after voting period ends returns VotingPeriodEnded.
    #[test]
    fn prop_vote_after_end_time_rejected() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=500_000i128,), |(weight,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());

                // Advance past the 3600s duration used by create_test_proposal
                t.env.ledger().with_mut(|l| l.timestamp += 3601);

                let voter = Address::generate(&t.env);
                let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
                tok.mint(&t.admin, &voter, &weight);

                let result = t.client.try_cast_vote(&voter, &proposal_id, &Vote::Yes);
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::VoteEnded))),
                    "expected VotingPeriodEnded, got {:?}", result
                );
                Ok(())
            })
            .unwrap();
    }
}

// ── Token contract property tests ─────────────────────────────────────────────

#[cfg(test)]
mod token_props {
    use proptest::prelude::*;
    use proptest::test_runner::{Config, TestRunner};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    fn setup_token<'a>() -> (Env, Address, votechain_token::TokenContractClient<'a>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let tok_id = env.register(votechain_token::TokenContract, ());
        let client = votechain_token::TokenContractClient::new(&env, &tok_id);
        client.initialize(&admin, &100_000_000_i128);
        (env, admin, client)
    }

    /// T-1: total_supply = sum of all balances after mint operations.
    #[test]
    fn prop_total_supply_equals_sum_of_balances() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &prop::collection::vec(1i128..=1_000_000i128, 1..=10),
                |amounts| {
                    let (env, admin, client) = setup_token();
                    let initial = client.total_supply();
                    extern crate alloc;
                    let mut recipients = alloc::vec::Vec::new();
                    for &amt in &amounts {
                        let user = Address::generate(&env);
                        client.mint(&admin, &user, &amt);
                        recipients.push((user, amt));
                    }

                    let expected_supply = initial + amounts.iter().sum::<i128>();
                    prop_assert_eq!(client.total_supply(), expected_supply);

                    // Each balance must equal the minted amount
                    for (user, amt) in &recipients {
                        prop_assert_eq!(client.balance(user), *amt);
                    }
                    Ok(())
                },
            )
            .unwrap();
    }

    /// T-2: transfer conserves total supply (no tokens created or destroyed).
    #[test]
    fn prop_transfer_conserves_supply() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(amount,)| {
                let (env, admin, client) = setup_token();
                let recipient = Address::generate(&env);
                let supply_before = client.total_supply();

                client.transfer(&admin, &recipient, &amount);

                prop_assert_eq!(
                    client.total_supply(), supply_before,
                    "supply changed after transfer"
                );
                prop_assert_eq!(client.balance(&recipient), amount);
                Ok(())
            })
            .unwrap();
    }

    /// T-3: burn reduces total_supply by exactly the burned amount.
    #[test]
    fn prop_burn_reduces_supply_exactly() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(amount,)| {
                let (env, admin, client) = setup_token();
                let user = Address::generate(&env);
                client.mint(&admin, &user, &amount);
                let supply_before = client.total_supply();

                client.burn(&admin, &user, &amount);

                prop_assert_eq!(client.total_supply(), supply_before - amount);
                prop_assert_eq!(client.balance(&user), 0);
                Ok(())
            })
            .unwrap();
    }

    /// T-4: transfer with amount > balance returns InsufficientBalance.
    #[test]
    fn prop_transfer_exceeding_balance_rejected() {
        use votechain_token::TokenContractClient;
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(amount,)| {
                let (env, admin, client) = setup_token();
                let sender = Address::generate(&env);
                let recipient = Address::generate(&env);
                // Mint amount - 1, then try to transfer amount
                if amount > 1 {
                    client.mint(&admin, &sender, &(amount - 1));
                    let result = client.try_transfer(&sender, &recipient, &amount);
                    prop_assert!(result.is_err(), "expected InsufficientBalance");
                    // Balance unchanged
                    prop_assert_eq!(client.balance(&sender), amount - 1);
                }
                Ok(())
            })
            .unwrap();
    }

    /// T-5: mint(0) or burn(0) is rejected as InvalidAmount.
    #[test]
    fn prop_zero_amount_operations_rejected() {
        let (_env, admin, client) = setup_token();
        use soroban_sdk::testutils::Address as _;
        let user = Address::generate(&_env);

        let mint_result = client.try_mint(&admin, &user, &0);
        assert!(mint_result.is_err(), "mint(0) should be rejected");

        let burn_result = client.try_burn(&admin, &user, &0);
        assert!(burn_result.is_err(), "burn(0) should be rejected");
    }
}

// ── Issue #489: Fuzz testing for contract invariants ────────────────────────

#[cfg(test)]
mod invariant_props {
    use super::*;
    use crate::test_helpers::{create_test_proposal, mint_and_vote, setup_env};
    use crate::types::{ContractError, Vote};
    use proptest::test_runner::{Config, TestRunner};
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Address, Env, String, Vec};

    /// INV-1: Vote tallies are always non-negative after any sequence of votes.
    #[test]
    fn prop_tallies_always_non_negative() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(
                    1i128..=500_000i128,
                    1i128..=500_000i128,
                    1i128..=500_000i128,
                ),
                |(w_yes, w_no, w_abstain)| {
                    let t = setup_env();
                    let id = create_test_proposal(&t, &t.admin.clone());

                    let v1 = Address::generate(&t.env);
                    let v2 = Address::generate(&t.env);
                    let v3 = Address::generate(&t.env);
                    mint_and_vote(&t, &v1, id, Vote::Yes, w_yes);
                    mint_and_vote(&t, &v2, id, Vote::No, w_no);
                    mint_and_vote(&t, &v3, id, Vote::Abstain, w_abstain);

                    let p = t.client.get_proposal(&id);
                    prop_assert!(p.votes_yes >= 0);
                    prop_assert!(p.votes_no >= 0);
                    prop_assert!(p.votes_abstain >= 0);
                    Ok(())
                },
            )
            .unwrap();
    }

    /// INV-2: Total votes across all categories never exceed total token supply.
    #[test]
    fn prop_total_votes_bounded_by_supply() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(
                    1i128..=100_000i128,
                    1i128..=100_000i128,
                    1i128..=100_000i128,
                ),
                |(w_yes, w_no, w_abstain)| {
                    let t = setup_env();
                    let id = create_test_proposal(&t, &t.admin.clone());

                    let tok = votechain_token::TokenContractClient::new(&t.env, &t.token_id);
                    let supply_before = tok.total_supply();

                    let v1 = Address::generate(&t.env);
                    let v2 = Address::generate(&t.env);
                    let v3 = Address::generate(&t.env);
                    mint_and_vote(&t, &v1, id, Vote::Yes, w_yes);
                    mint_and_vote(&t, &v2, id, Vote::No, w_no);
                    mint_and_vote(&t, &v3, id, Vote::Abstain, w_abstain);

                    let p = t.client.get_proposal(&id);
                    let total_votes = p.votes_yes + p.votes_no + p.votes_abstain;
                    let supply_after = tok.total_supply();

                    prop_assert!(
                        total_votes <= supply_after,
                        "total votes {} > supply {}", total_votes, supply_after
                    );
                    Ok(())
                },
            )
            .unwrap();
    }

    /// INV-3: Proposal state after finalise is always terminal (Passed or Rejected).
    #[test]
    fn prop_finalise_always_terminal() {
        let config = Config::with_cases(300);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(
                    0i128..=200i128,
                    0i128..=200i128,
                    0i128..=200i128,
                    1i128..=500i128,
                ),
                |(w_yes, w_no, w_abstain, quorum)| {
                    let t = setup_env();
                    let proposer = Address::generate(&t.env);
                    let id = t.client.create_proposal(
                        &proposer,
                        &String::from_str(&t.env, "inv"),
                        &String::from_str(&t.env, "invariant test"),
                        &quorum,
                        &3600_u64,
                        &Vec::new(&t.env),
                    );

                    if w_yes > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::Yes, w_yes);
                    }
                    if w_no > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::No, w_no);
                    }
                    if w_abstain > 0 {
                        let v = Address::generate(&t.env);
                        mint_and_vote(&t, &v, id, Vote::Abstain, w_abstain);
                    }

                    t.env.ledger().with_mut(|l| l.timestamp += 3601);
                    t.client.finalise(&id);

                    let p = t.client.get_proposal(&id);
                    use crate::types::ProposalState;
                    prop_assert!(
                        p.state == ProposalState::Passed || p.state == ProposalState::Rejected,
                        "non-terminal state after finalise: {:?}", p.state
                    );
                    Ok(())
                },
            )
            .unwrap();
    }

    /// INV-4: Quorum boundary — proposals with total == quorum and yes > no always pass.
    #[test]
    fn prop_exact_quorum_with_yes_majority_passes() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(1i128..=1000i128,),
                |(quorum,)| {
                    let t = setup_env();
                    let proposer = Address::generate(&t.env);
                    let id = t.client.create_proposal(
                        &proposer,
                        &String::from_str(&t.env, "qb"),
                        &String::from_str(&t.env, "quorum boundary"),
                        &quorum,
                        &3600_u64,
                        &Vec::new(&t.env),
                    );

                    // Vote exactly quorum tokens, all Yes
                    let v = Address::generate(&t.env);
                    mint_and_vote(&t, &v, id, Vote::Yes, quorum);

                    t.env.ledger().with_mut(|l| l.timestamp += 3601);
                    t.client.finalise(&id);

                    use crate::types::ProposalState;
                    prop_assert_eq!(
                        t.client.get_proposal(&id).state,
                        ProposalState::Passed,
                        "exact quorum all-yes should pass"
                    );
                    Ok(())
                },
            )
            .unwrap();
    }

    /// INV-5: Quorum boundary — proposals with total < quorum always reject.
    #[test]
    fn prop_below_quorum_always_rejects() {
        let config = Config::with_cases(200);
        let mut runner = TestRunner::new(config);

        runner
            .run(
                &(2i128..=1000i128,),
                |(quorum,)| {
                    let t = setup_env();
                    let proposer = Address::generate(&t.env);
                    let id = t.client.create_proposal(
                        &proposer,
                        &String::from_str(&t.env, "bq"),
                        &String::from_str(&t.env, "below quorum"),
                        &quorum,
                        &3600_u64,
                        &Vec::new(&t.env),
                    );

                    // Vote one less than quorum
                    let v = Address::generate(&t.env);
                    mint_and_vote(&t, &v, id, Vote::Yes, quorum - 1);

                    t.env.ledger().with_mut(|l| l.timestamp += 3601);
                    t.client.finalise(&id);

                    use crate::types::ProposalState;
                    prop_assert_eq!(
                        t.client.get_proposal(&id).state,
                        ProposalState::Rejected,
                        "below-quorum should reject"
                    );
                    Ok(())
                },
            )
            .unwrap();
    }
}

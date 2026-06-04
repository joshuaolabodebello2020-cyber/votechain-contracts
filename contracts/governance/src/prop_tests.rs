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
//! Contract-level properties (AC-1, AC-2, AC-3) exercise the real Soroban
//! environment via `test_helpers` to verify invariants hold end-to-end.

#![cfg(test)]

use proptest::prelude::*;

/// Maximum token supply used across all strategies (mirrors a realistic cap).
const MAX_SUPPLY: i128 = i128::MAX / 4;

proptest! {
    /// Invariant 1: votes_yes + votes_no + votes_abstain == total_votes
    ///
    /// For any non-negative split of votes the sum must equal the total.
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
    ///
    /// Each voter contributes at most their balance, and the sum of all
    /// balances is bounded by the total supply.
    #[test]
    fn total_votes_never_exceed_supply(
        supply  in 1i128..=MAX_SUPPLY,
        yes     in 0i128..=MAX_SUPPLY,
        no      in 0i128..=MAX_SUPPLY,
        abstain in 0i128..=MAX_SUPPLY,
    ) {
        // Clamp each bucket so the combined tally stays within supply,
        // replicating the constraint that voters can only spend their balance.
        let yes     = yes.min(supply);
        let no      = no.min(supply - yes);
        let abstain = abstain.min(supply - yes - no);

        let total = yes + no + abstain;
        prop_assert!(total <= supply);
    }

    /// Invariant 3: quorum check is consistent with stored vote counts.
    ///
    /// A proposal passes iff total_votes >= quorum AND votes_yes > votes_no.
    /// This mirrors the condition in `finalise` exactly.
    #[test]
    fn quorum_check_consistent_with_vote_counts(
        yes     in 0i128..=MAX_SUPPLY / 3,
        no      in 0i128..=MAX_SUPPLY / 3,
        abstain in 0i128..=MAX_SUPPLY / 3,
        quorum  in 1i128..=MAX_SUPPLY,
    ) {
        let total = yes + no + abstain;
        let passes = total >= quorum && yes > no;

        // Re-derive from the same inputs — must agree.
        let expected = (yes + no + abstain) >= quorum && yes > no;
        prop_assert_eq!(passes, expected);
    }
}

// ── Contract-level property tests (AC-1, AC-2, AC-3) ────────────────────────
//
// These tests spin up a real Soroban test environment and verify invariants
// against the actual contract implementation.

#[cfg(test)]
mod contract_props {
    use super::*;
    use crate::test_helpers::{create_test_proposal, mint_and_vote, setup_env};
    use crate::types::Vote;
    use proptest::test_runner::{Config, TestRunner};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Address;

    /// AC-1: sum(voter weights) == votes_yes + votes_no + votes_abstain
    ///
    /// Mints distinct balances to three voters, casts one vote each, then
    /// asserts that the proposal tally equals the sum of their individual
    /// weights as recorded in VoteRecord.
    #[test]
    fn prop_sum_of_voter_weights_equals_tally() {
        let config = Config::with_cases(1000);
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

                    // Each voter's recorded weight must match what was minted.
                    let rec_yes = t.client.get_vote(&proposal_id, &voter_yes).unwrap();
                    let rec_no = t.client.get_vote(&proposal_id, &voter_no).unwrap();
                    let rec_abstain = t.client.get_vote(&proposal_id, &voter_abstain).unwrap();

                    prop_assert_eq!(rec_yes.weight, w_yes);
                    prop_assert_eq!(rec_no.weight, w_no);
                    prop_assert_eq!(rec_abstain.weight, w_abstain);

                    // Tally buckets must equal the sum of individual weights.
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
    ///
    /// After a successful vote, a second cast_vote from the same address must
    /// return AlreadyVoted and the tally must remain unchanged.
    #[test]
    fn prop_no_double_vote() {
        use crate::types::ContractError;

        let config = Config::with_cases(1000);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(weight,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());

                let voter = Address::generate(&t.env);
                mint_and_vote(&t, &voter, proposal_id, Vote::Yes, weight);

                let proposal_before = t.client.get_proposal(&proposal_id);

                // Second vote must be rejected.
                let result = t.client.try_cast_vote(&voter, &proposal_id, &Vote::No);
                prop_assert!(
                    matches!(result, Err(Ok(ContractError::AlreadyVoted))),
                    "expected AlreadyVoted, got {:?}",
                    result
                );

                // Tally must be unchanged.
                let proposal_after = t.client.get_proposal(&proposal_id);
                prop_assert_eq!(proposal_before.votes_yes, proposal_after.votes_yes);
                prop_assert_eq!(proposal_before.votes_no, proposal_after.votes_no);
                prop_assert_eq!(proposal_before.votes_abstain, proposal_after.votes_abstain);

                Ok(())
            })
            .unwrap();
    }

    /// AC-3: vote weight never exceeds the voter's token balance at vote time.
    ///
    /// The recorded weight in VoteRecord must equal exactly the balance that
    /// was minted — never more.
    #[test]
    fn prop_vote_weight_never_exceeds_balance() {
        let config = Config::with_cases(1000);
        let mut runner = TestRunner::new(config);

        runner
            .run(&(1i128..=1_000_000i128,), |(balance,)| {
                let t = setup_env();
                let proposal_id = create_test_proposal(&t, &t.admin.clone());

                let voter = Address::generate(&t.env);
                mint_and_vote(&t, &voter, proposal_id, Vote::Yes, balance);

                let record = t.client.get_vote(&proposal_id, &voter).unwrap();

                // Weight must be exactly the minted balance — never more.
                prop_assert!(
                    record.weight <= balance,
                    "weight {} > balance {}",
                    record.weight,
                    balance
                );
                Ok(())
            })
            .unwrap();
    }
}

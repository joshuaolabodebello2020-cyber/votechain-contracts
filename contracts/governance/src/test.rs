#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String};

fn setup() -> (Env, GovernanceContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &id);
    (env, client)
}

fn setup_token(env: &Env, admin: &Address) -> Address {
    let id = env.register(votechain_token::TokenContract, ());
    let t = votechain_token::TokenContractClient::new(env, &id);
    t.initialize(admin, &1_000_000);
    id
}

fn make_proposal(env: &Env, client: &GovernanceContractClient, proposer: &Address, token_id: &Address) -> u64 {
    let admin = Address::generate(env);
    client.initialize(&admin, token_id);
    client.create_proposal(
        proposer,
        &String::from_str(env, "Upgrade protocol"),
        &String::from_str(env, "Upgrade to v2"),
        &100,   // quorum
        &3600,  // 1 hour
    )
}

#[test]
fn test_create_proposal() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Add new feature"),
        &String::from_str(&env, "Details here"),
        &50,
        &7200,
    );
    assert_eq!(id, 1);
    assert_eq!(client.proposal_count(), 1);
    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Active);
}

#[test]
fn test_cast_vote_and_finalise_passed() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter); // voter holds all tokens

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Proposal A"),
        &String::from_str(&env, "desc"),
        &100,
        &3600,
    );

    client.cast_vote(&voter, &id, &Vote::Yes);
    assert!(client.has_voted(&id, &voter));

    let p = client.get_proposal(&id);
    assert_eq!(p.votes_yes, 1_000_000);

    // Advance past end_time
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);

    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Passed);
}

#[test]
fn test_finalise_rejected_below_quorum() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Proposal B"),
        &String::from_str(&env, "desc"),
        &9_999_999, // quorum higher than total supply
        &3600,
    );

    client.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);

    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Rejected);
}

#[test]
fn test_finalise_rejected_no_wins() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Proposal C"),
        &String::from_str(&env, "desc"),
        &100,
        &3600,
    );

    client.cast_vote(&voter, &id, &Vote::No);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);

    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Rejected);
}

#[test]
fn test_execute_passed_proposal() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Proposal D"),
        &String::from_str(&env, "desc"),
        &100,
        &3600,
    );
    client.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);
    client.execute(&admin, &id);

    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Executed);
}

#[test]
fn test_cancel_proposal() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "Proposal E"),
        &String::from_str(&env, "desc"),
        &100,
        &3600,
    );
    client.cancel(&admin, &id);
    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Cancelled);
}

// ── TEST-009: Concurrent proposal scenario tests ─────────────────────────────

/// Multiple active proposals can coexist and receive independent votes.
#[test]
fn test_concurrent_proposals_independent_votes() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id1 = client.create_proposal(&voter, &String::from_str(&env, "P1"), &String::from_str(&env, "d"), &1, &3600);
    let id2 = client.create_proposal(&voter, &String::from_str(&env, "P2"), &String::from_str(&env, "d"), &1, &3600);
    let id3 = client.create_proposal(&voter, &String::from_str(&env, "P3"), &String::from_str(&env, "d"), &1, &3600);

    assert_eq!(client.get_proposal(&id1).status, ProposalStatus::Active);
    assert_eq!(client.get_proposal(&id2).status, ProposalStatus::Active);
    assert_eq!(client.get_proposal(&id3).status, ProposalStatus::Active);

    client.cast_vote(&voter, &id1, &Vote::Yes);
    // voter has not voted on id2 or id3
    assert!(client.has_voted(&id1, &voter));
    assert!(!client.has_voted(&id2, &voter));
    assert!(!client.has_voted(&id3, &voter));
}

/// Votes on one proposal do not affect tallies of another.
#[test]
fn test_concurrent_votes_do_not_bleed() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id1 = client.create_proposal(&voter, &String::from_str(&env, "P1"), &String::from_str(&env, "d"), &1, &3600);
    let id2 = client.create_proposal(&voter, &String::from_str(&env, "P2"), &String::from_str(&env, "d"), &1, &3600);

    client.cast_vote(&voter, &id1, &Vote::Yes);

    let p1 = client.get_proposal(&id1);
    let p2 = client.get_proposal(&id2);
    assert_eq!(p1.votes_yes, 1_000_000);
    assert_eq!(p2.votes_yes, 0);
    assert_eq!(p2.votes_no, 0);
    assert_eq!(p2.votes_abstain, 0);
}

/// Finalising one proposal does not change the status of others.
#[test]
fn test_finalise_one_does_not_affect_others() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id1 = client.create_proposal(&voter, &String::from_str(&env, "P1"), &String::from_str(&env, "d"), &1, &3600);
    let id2 = client.create_proposal(&voter, &String::from_str(&env, "P2"), &String::from_str(&env, "d"), &1, &7200);

    client.cast_vote(&voter, &id1, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id1);

    assert_ne!(client.get_proposal(&id1).status, ProposalStatus::Active);
    assert_eq!(client.get_proposal(&id2).status, ProposalStatus::Active);
}

/// Proposal IDs are unique and monotonically increasing.
#[test]
fn test_proposal_ids_are_unique() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id1 = client.create_proposal(&proposer, &String::from_str(&env, "P1"), &String::from_str(&env, "d"), &1, &3600);
    let id2 = client.create_proposal(&proposer, &String::from_str(&env, "P2"), &String::from_str(&env, "d"), &1, &3600);
    let id3 = client.create_proposal(&proposer, &String::from_str(&env, "P3"), &String::from_str(&env, "d"), &1, &3600);

    assert!(id1 != id2 && id2 != id3 && id1 != id3);
    assert_eq!(client.proposal_count(), 3);
}

/// Proposals at different lifecycle stages coexist correctly.
#[test]
fn test_proposals_at_different_lifecycle_stages() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let active_id   = client.create_proposal(&voter, &String::from_str(&env, "Active"),   &String::from_str(&env, "d"), &1,         &7200);
    let passed_id   = client.create_proposal(&voter, &String::from_str(&env, "Passed"),   &String::from_str(&env, "d"), &1,         &3600);
    let rejected_id = client.create_proposal(&voter, &String::from_str(&env, "Rejected"), &String::from_str(&env, "d"), &9_999_999, &3600);
    let cancelled_id = client.create_proposal(&voter, &String::from_str(&env, "Cancel"),  &String::from_str(&env, "d"), &1,         &3600);

    client.cast_vote(&voter, &passed_id, &Vote::Yes);
    client.cast_vote(&voter, &rejected_id, &Vote::Yes);
    client.cancel(&admin, &cancelled_id);

    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&passed_id);
    client.finalise(&rejected_id);

    assert_eq!(client.get_proposal(&active_id).status,    ProposalStatus::Active);
    assert_eq!(client.get_proposal(&passed_id).status,    ProposalStatus::Passed);
    assert_eq!(client.get_proposal(&rejected_id).status,  ProposalStatus::Rejected);
    assert_eq!(client.get_proposal(&cancelled_id).status, ProposalStatus::Cancelled);
}

// ── end TEST-009 ─────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn test_cannot_vote_twice() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let token_id = setup_token(&env, &voter);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Proposal F"),
        &String::from_str(&env, "desc"),
        &100,
        &3600,
    );
    client.cast_vote(&voter, &id, &Vote::Yes);
    client.cast_vote(&voter, &id, &Vote::No); // should panic
}

// ── TEST-013: access control negative tests ───────────────────────────────────

/// Helper: create a passed proposal ready for execute/cancel tests.
fn setup_passed_proposal(env: &Env, client: &GovernanceContractClient, admin: &Address) -> u64 {
    let voter = Address::generate(env);
    let token_id = setup_token(env, &voter);
    client.initialize(admin, &token_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(env, "Prop"),
        &String::from_str(env, "desc"),
        &100,
        &3600,
    );
    client.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);
    id
}

/// Helper: create an active proposal.
fn setup_active_proposal(env: &Env, client: &GovernanceContractClient, admin: &Address) -> u64 {
    let proposer = Address::generate(env);
    let token_id = setup_token(env, admin);
    client.initialize(admin, &token_id);
    client.create_proposal(
        &proposer,
        &String::from_str(env, "Prop"),
        &String::from_str(env, "desc"),
        &100,
        &3600,
    )
}

// ── execute: non-admin caller ─────────────────────────────────────────────────

#[test]
#[should_panic(expected = "not admin")]
fn test_execute_non_admin_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let id = setup_passed_proposal(&env, &client, &admin);
    client.execute(&non_admin, &id);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_execute_zero_address_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let id = setup_passed_proposal(&env, &client, &admin);
    // All-zero Stellar account (32 zero bytes) acts as the "zero address"
    let zero = Address::from_str(&env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    client.execute(&zero, &id);
}

// ── cancel: non-admin caller ──────────────────────────────────────────────────

#[test]
#[should_panic(expected = "not admin")]
fn test_cancel_non_admin_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let id = setup_active_proposal(&env, &client, &admin);
    client.cancel(&non_admin, &id);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_cancel_zero_address_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let id = setup_active_proposal(&env, &client, &admin);
    let zero = Address::from_str(&env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    client.cancel(&zero, &id);
}

// ── SC-027: update_quorum tests ───────────────────────────────────────────────

#[test]
fn test_update_quorum_success() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &proposer,
        &String::from_str(&env, "P"),
        &String::from_str(&env, "d"),
        &100,
        &3600,
    );
    client.update_quorum(&admin, &id, &500);
    assert_eq!(client.get_proposal(&id).quorum, 500);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_update_quorum_non_admin_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &admin,
        &String::from_str(&env, "P"),
        &String::from_str(&env, "d"),
        &100,
        &3600,
    );
    client.update_quorum(&non_admin, &id, &500);
}

#[test]
#[should_panic]
fn test_update_quorum_zero_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &admin,
        &String::from_str(&env, "P"),
        &String::from_str(&env, "d"),
        &100,
        &3600,
    );
    client.update_quorum(&admin, &id, &0);
}

#[test]
#[should_panic]
fn test_update_quorum_inactive_proposal_reverts() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);

    client.initialize(&admin, &token_id);
    let id = client.create_proposal(
        &admin,
        &String::from_str(&env, "P"),
        &String::from_str(&env, "d"),
        &100,
        &3600,
    );
    client.cancel(&admin, &id);
    client.update_quorum(&admin, &id, &500); // must panic: ProposalNotActive
}

// ── end SC-027 ────────────────────────────────────────────────────────────────

// ── Integration tests: governance × token contract interactions ───────────────

// Helper: blank token contract (zero initial supply). Returns (id, client, minter).
fn setup_token_blank(env: &Env) -> (Address, votechain_token::TokenContractClient<'static>, Address) {
    let minter = Address::generate(env);
    let tok_id = env.register(votechain_token::TokenContract, ());
    let tok = votechain_token::TokenContractClient::new(env, &tok_id);
    tok.initialize(&minter, &0);
    (tok_id, tok, minter)
}

/// Voting weight equals the voter's token balance at the moment of casting.
#[test]
fn test_vote_weight_equals_token_balance_at_cast_time() {
    let (env, client) = setup();
    let gov_admin = Address::generate(&env);
    let voter = Address::generate(&env);

    let (tok_id, tok, minter) = setup_token_blank(&env);
    tok.mint(&minter, &voter, &750);

    client.initialize(&gov_admin, &tok_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Weight check"),
        &String::from_str(&env, "d"),
        &100,
        &3600,
    );
    client.cast_vote(&voter, &id, &Vote::Yes);
    assert_eq!(client.get_proposal(&id).votes_yes, 750);
}

/// Distributing tokens between two voters gives each proportional voting power.
#[test]
fn test_token_transfer_splits_voting_power() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let tok_id = setup_token(&env, &admin);
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.transfer(&admin, &voter1, &600);
    tok.transfer(&admin, &voter2, &400);

    client.initialize(&admin, &tok_id);
    let id = client.create_proposal(
        &admin,
        &String::from_str(&env, "Split vote"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter1, &id, &Vote::Yes);
    client.cast_vote(&voter2, &id, &Vote::No);

    let p = client.get_proposal(&id);
    assert_eq!(p.votes_yes, 600);
    assert_eq!(p.votes_no, 400);
    assert_eq!(p.votes_abstain, 0);
}

/// A user with zero token balance cannot cast a vote (NoVotingPower).
#[test]
#[should_panic]
fn test_zero_balance_voter_cannot_vote() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let zero_holder = Address::generate(&env);

    let tok_id = setup_token(&env, &voter);
    client.initialize(&admin, &tok_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "P"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&zero_holder, &id, &Vote::Yes);
}

/// A token transfer that occurs AFTER a vote has been cast does not alter the
/// already-recorded tally — weight is snapshotted at cast time.
#[test]
fn test_token_transfer_after_vote_does_not_alter_tally() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let recipient = Address::generate(&env);

    let tok_id = setup_token(&env, &voter);
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);

    client.initialize(&admin, &tok_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Immutable tally"),
        &String::from_str(&env, "d"),
        &500,
        &3600,
    );

    client.cast_vote(&voter, &id, &Vote::Yes);
    assert_eq!(client.get_proposal(&id).votes_yes, 1_000_000);

    tok.transfer(&voter, &recipient, &600_000);

    // Tally must remain at the balance captured at cast time.
    assert_eq!(client.get_proposal(&id).votes_yes, 1_000_000);
}

/// Minting additional tokens to a user increases their voting weight on a
/// subsequent proposal.
#[test]
fn test_mint_increases_voting_power_for_next_vote() {
    let (env, client) = setup();
    let gov_admin = Address::generate(&env);
    let voter = Address::generate(&env);

    let (tok_id, tok, minter) = setup_token_blank(&env);
    tok.mint(&minter, &voter, &200);

    client.initialize(&gov_admin, &tok_id);

    let id1 = client.create_proposal(
        &voter,
        &String::from_str(&env, "P1"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter, &id1, &Vote::Yes);
    assert_eq!(client.get_proposal(&id1).votes_yes, 200);

    tok.mint(&minter, &voter, &800);

    let id2 = client.create_proposal(
        &voter,
        &String::from_str(&env, "P2"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter, &id2, &Vote::Yes);
    assert_eq!(client.get_proposal(&id2).votes_yes, 1_000);
}

/// Burning tokens between two proposals reduces the voter's weight on the
/// later one without retroactively changing the earlier tally.
#[test]
fn test_burn_reduces_voting_power_without_affecting_past_tally() {
    let (env, client) = setup();
    let gov_admin = Address::generate(&env);
    // voter is also the token admin (setup_token initialises with voter as admin)
    let voter = Address::generate(&env);

    let tok_id = setup_token(&env, &voter);
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);

    client.initialize(&gov_admin, &tok_id);

    let id1 = client.create_proposal(
        &voter,
        &String::from_str(&env, "P1"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter, &id1, &Vote::Yes);
    assert_eq!(client.get_proposal(&id1).votes_yes, 1_000_000);

    // voter is the token admin, so voter authorises the burn of their own tokens
    tok.burn(&voter, &voter, &600_000);

    let id2 = client.create_proposal(
        &voter,
        &String::from_str(&env, "P2"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter, &id2, &Vote::Yes);
    assert_eq!(client.get_proposal(&id2).votes_yes, 400_000);
    assert_eq!(client.get_proposal(&id1).votes_yes, 1_000_000); // unchanged
}

/// Quorum set exactly at total supply passes only when the full supply votes.
#[test]
fn test_quorum_equal_to_total_supply_requires_full_participation() {
    let (env, client) = setup();
    let gov_admin = Address::generate(&env);
    let voter = Address::generate(&env);

    let (tok_id, tok, minter) = setup_token_blank(&env);
    tok.mint(&minter, &voter, &1_000);

    client.initialize(&gov_admin, &tok_id);
    let id = client.create_proposal(
        &voter,
        &String::from_str(&env, "Full quorum"),
        &String::from_str(&env, "d"),
        &1_000,
        &3600,
    );
    client.cast_vote(&voter, &id, &Vote::Yes);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);
    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Passed);
}

/// Multiple voters with different token balances produce correct Yes/No/Abstain
/// tallies and the proposal finalises to the expected outcome.
#[test]
fn test_multi_voter_mixed_votes_tally_and_outcome() {
    let (env, client) = setup();
    let gov_admin = Address::generate(&env);
    let yes_voter = Address::generate(&env);
    let no_voter = Address::generate(&env);
    let abs_voter = Address::generate(&env);

    let (tok_id, tok, minter) = setup_token_blank(&env);
    tok.mint(&minter, &yes_voter, &500);
    tok.mint(&minter, &no_voter, &300);
    tok.mint(&minter, &abs_voter, &200);

    client.initialize(&gov_admin, &tok_id);
    let id = client.create_proposal(
        &yes_voter,
        &String::from_str(&env, "Mixed"),
        &String::from_str(&env, "d"),
        &900, // total votes will be 1000 >= 900; yes(500) > no(300) => Passed
        &3600,
    );

    client.cast_vote(&yes_voter, &id, &Vote::Yes);
    client.cast_vote(&no_voter, &id, &Vote::No);
    client.cast_vote(&abs_voter, &id, &Vote::Abstain);

    let p = client.get_proposal(&id);
    assert_eq!(p.votes_yes, 500);
    assert_eq!(p.votes_no, 300);
    assert_eq!(p.votes_abstain, 200);

    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);
    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Passed);
}

/// A proposal with enough total votes but Yes tied with No is rejected.
#[test]
fn test_tied_vote_is_rejected() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let tok_id = setup_token(&env, &admin);
    let tok = votechain_token::TokenContractClient::new(&env, &tok_id);
    tok.transfer(&admin, &voter1, &500_000);
    tok.transfer(&admin, &voter2, &500_000);

    client.initialize(&admin, &tok_id);
    let id = client.create_proposal(
        &admin,
        &String::from_str(&env, "Tie"),
        &String::from_str(&env, "d"),
        &1,
        &3600,
    );
    client.cast_vote(&voter1, &id, &Vote::Yes);
    client.cast_vote(&voter2, &id, &Vote::No);

    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.finalise(&id);
    assert_eq!(client.get_proposal(&id).status, ProposalStatus::Rejected);
}

// ── end integration tests ─────────────────────────────────────────────────────

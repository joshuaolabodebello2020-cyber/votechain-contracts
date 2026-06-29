#![cfg(test)]

//! Issue #490: Minimum balance guard tests for proposal creation.
//!
//! Verifies that `create_proposal` correctly enforces the `min_proposal_balance`
//! parameter set during initialization.

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env, String, Vec,
};

use crate::{GovernanceContract, GovernanceContractClient};
use crate::types::{ContractError, Vote};

// ── Setup with configurable min_proposal_balance ────────────────────────────

struct MinBalSetup<'a> {
    env: Env,
    gov: GovernanceContractClient<'a>,
    token: votechain_token::TokenContractClient<'a>,
    admin: Address,
}

fn setup_with_min_balance(min_balance: i128) -> MinBalSetup<'static> {
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
        &min_balance,
        &0_u64,           // proposal_cooldown
        &60_u64,          // min_duration
        &2_592_000_u64,   // max_duration
        &false,           // restrict_admin_vote
        &0_u64,           // amend_window
        &0_u64,           // timelock_duration
        &0_i128,          // veto_threshold
    );

    MinBalSetup { env, gov, token, admin }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[test]
fn create_proposal_fails_below_minimum_balance() {
    let s = setup_with_min_balance(1_000);
    let proposer = Address::generate(&s.env);
    // Give proposer 999 tokens — one below minimum
    s.token.mint(&s.admin, &proposer, &999);

    let result = s.gov.try_create_proposal(
        &proposer,
        &String::from_str(&s.env, "Under-funded proposal"),
        &String::from_str(&s.env, "Should be rejected"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::LowBalance,
    );
}

#[test]
fn create_proposal_succeeds_with_valid_balance() {
    let s = setup_with_min_balance(1_000);
    let proposer = Address::generate(&s.env);
    s.token.mint(&s.admin, &proposer, &5_000);

    let id = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "Well-funded proposal"),
        &String::from_str(&s.env, "Should succeed"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(id, 1);
    assert_eq!(s.gov.proposal_count(), 1);
}

#[test]
fn create_proposal_succeeds_at_exact_minimum() {
    let s = setup_with_min_balance(1_000);
    let proposer = Address::generate(&s.env);
    s.token.mint(&s.admin, &proposer, &1_000);

    let id = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "Exact minimum"),
        &String::from_str(&s.env, "Boundary test"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(id, 1);
}

#[test]
fn create_proposal_fails_at_one_below_minimum() {
    let s = setup_with_min_balance(500);
    let proposer = Address::generate(&s.env);
    s.token.mint(&s.admin, &proposer, &499);

    let result = s.gov.try_create_proposal(
        &proposer,
        &String::from_str(&s.env, "One below"),
        &String::from_str(&s.env, "Off by one"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::LowBalance,
    );
}

#[test]
fn create_proposal_succeeds_at_one_above_minimum() {
    let s = setup_with_min_balance(500);
    let proposer = Address::generate(&s.env);
    s.token.mint(&s.admin, &proposer, &501);

    let id = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "One above"),
        &String::from_str(&s.env, "Just over the line"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(id, 1);
}

#[test]
fn create_proposal_fails_with_zero_balance() {
    let s = setup_with_min_balance(1);
    let proposer = Address::generate(&s.env);
    // No tokens minted — balance is 0

    let result = s.gov.try_create_proposal(
        &proposer,
        &String::from_str(&s.env, "Zero balance"),
        &String::from_str(&s.env, "No tokens at all"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::LowBalance,
    );
}

#[test]
fn create_proposal_succeeds_when_min_balance_is_zero() {
    // min_balance = 0 means the guard is disabled
    let s = setup_with_min_balance(0);
    let proposer = Address::generate(&s.env);
    // No tokens minted — but guard is disabled

    let id = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "No guard"),
        &String::from_str(&s.env, "min_balance disabled"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(id, 1);
}

#[test]
fn create_proposal_balance_check_uses_current_balance() {
    let s = setup_with_min_balance(1_000);
    let proposer = Address::generate(&s.env);

    // Start with enough balance
    s.token.mint(&s.admin, &proposer, &2_000);

    let id1 = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "First"),
        &String::from_str(&s.env, "Has balance"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );
    assert_eq!(id1, 1);

    // Transfer tokens away so balance drops below minimum
    let sink = Address::generate(&s.env);
    s.token.transfer(&proposer, &sink, &1_500);

    let result = s.gov.try_create_proposal(
        &proposer,
        &String::from_str(&s.env, "Second"),
        &String::from_str(&s.env, "Lost balance"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::LowBalance,
    );
}

#[test]
fn create_proposal_with_large_min_balance() {
    let s = setup_with_min_balance(5_000_000);
    let proposer = Address::generate(&s.env);
    s.token.mint(&s.admin, &proposer, &4_999_999);

    let result = s.gov.try_create_proposal(
        &proposer,
        &String::from_str(&s.env, "Large min"),
        &String::from_str(&s.env, "Almost enough"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );

    assert_eq!(
        result.err().unwrap().unwrap(),
        ContractError::LowBalance,
    );

    // Mint one more token to reach the minimum
    s.token.mint(&s.admin, &proposer, &1);

    let id = s.gov.create_proposal(
        &proposer,
        &String::from_str(&s.env, "Large min ok"),
        &String::from_str(&s.env, "Now enough"),
        &100,
        &3600,
        &Vec::new(&s.env),
    );
    assert_eq!(id, 1);
}

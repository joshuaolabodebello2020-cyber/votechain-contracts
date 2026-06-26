#![cfg(test)]
use super::*;
use soroban_sdk::{symbol_short, testutils::{Address as _, Events}, Address, Env, IntoVal};

fn setup() -> (Env, TokenContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TokenContract, ());
    (env.clone(), TokenContractClient::new(&env, &id))
}

#[test]
fn test_initialize() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    c.initialize(&admin, &1_000_000);
    assert_eq!(c.total_supply(), 1_000_000);
    assert_eq!(c.balance(&admin), 1_000_000);
}

#[test]
fn test_transfer() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.transfer(&admin, &user, &400);
    assert_eq!(c.balance(&admin), 600);
    assert_eq!(c.balance(&user), 400);
}

#[test]
fn test_mint_burn() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.mint(&admin, &user, &500);
    assert_eq!(c.total_supply(), 1_500);
    c.burn(&admin, &user, &200);
    assert_eq!(c.total_supply(), 1_300);
}

#[test]
#[should_panic]
fn test_overdraft() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &100);
    c.transfer(&admin, &user, &999);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_mint_non_admin() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.mint(&user, &user, &500);
}

#[test]
fn test_balance_of() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    c.initialize(&admin, &1_000);
    assert_eq!(c.balance(&admin), 1_000);
    assert_eq!(c.balance(&user1), 0);
    c.transfer(&admin, &user1, &300);
    assert_eq!(c.balance(&admin), 700);
    assert_eq!(c.balance(&user1), 300);
    assert_eq!(c.balance(&user2), 0);
}

#[test]
fn test_transfer_atomicity() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    let before_total = c.total_supply();
    c.transfer(&admin, &user, &400);
    assert_eq!(c.balance(&admin) + c.balance(&user), before_total);
    assert_eq!(c.total_supply(), before_total);
}

#[test]
fn test_mint_increases_supply() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    assert_eq!(c.total_supply(), 1_000);
    c.mint(&admin, &user, &500);
    assert_eq!(c.balance(&user), 500);
    assert_eq!(c.total_supply(), 1_500);
}

#[test]
fn test_events_mint() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &0);
    c.mint(&admin, &user, &300);
    let events = env.events().all();
    assert!(events.iter().any(|(_, topics, data)| {
        topics == (symbol_short!("mint"), user.clone()).into_val(&env)
            && data == 300_i128.into_val(&env)
    }));
}

#[test]
fn test_events_transfer() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.transfer(&admin, &user, &200);
    let events = env.events().all();
    assert!(events.iter().any(|(_, topics, data)| {
        topics == (symbol_short!("transfer"), admin.clone(), user.clone()).into_val(&env)
            && data == 200_i128.into_val(&env)
    }));
}

#[test]
fn test_events_burn() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.burn(&admin, &admin, &400);
    let events = env.events().all();
    assert!(events.iter().any(|(_, topics, data)| {
        topics == (symbol_short!("burn"), admin.clone()).into_val(&env)
            && data == 400_i128.into_val(&env)
    }));
}

// ── Issue #464: approve / transfer_from / allowance + error paths ─────────────

#[test]
fn test_approve_and_transfer_from() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.approve(&admin, &spender, &300);
    c.transfer_from(&spender, &admin, &recipient, &200);
    assert_eq!(c.balance(&admin), 800);
    assert_eq!(c.balance(&recipient), 200);
}

#[test]
fn test_transfer_from_reduces_allowance() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.approve(&admin, &spender, &500);
    c.transfer_from(&spender, &admin, &recipient, &100);
    // allowance should be 400 now — verify by spending exactly 400 more (would panic if less)
    c.transfer_from(&spender, &admin, &recipient, &400);
    assert_eq!(c.balance(&recipient), 500);
}

#[test]
#[should_panic]
fn test_transfer_from_exceeds_allowance() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.approve(&admin, &spender, &100);
    c.transfer_from(&spender, &admin, &recipient, &101); // exceeds allowance
}

#[test]
#[should_panic]
fn test_transfer_from_insufficient_balance() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    c.initialize(&admin, &50);
    c.approve(&admin, &spender, &1_000);
    c.transfer_from(&spender, &admin, &recipient, &100); // balance only 50
}

#[test]
#[should_panic]
fn test_transfer_invalid_amount() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.transfer(&admin, &user, &0); // amount <= 0
}

#[test]
#[should_panic(expected = "not admin")]
fn test_burn_non_admin() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.transfer(&admin, &user, &500);
    c.burn(&user, &user, &100); // user is not admin
}

#[test]
#[should_panic]
fn test_burn_insufficient_balance() {
    let (env, c) = setup();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    c.initialize(&admin, &1_000);
    c.transfer(&admin, &user, &100);
    c.burn(&admin, &user, &999); // user only has 100
}

// ── end Issue #464 token tests ────────────────────────────────────────────────

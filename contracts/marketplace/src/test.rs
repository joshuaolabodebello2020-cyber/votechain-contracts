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

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{
    ContractError, ListingState, MarketplaceContract, MarketplaceContractClient, OfferState,
};

// ── Shared setup ─────────────────────────────────────────────────────────────

struct Setup {
    env: Env,
    client: MarketplaceContractClient<'static>,
    admin: Address,
    seller: Address,
}

/// Initialise a marketplace with a custom per-listing offer limit.
fn setup_with_limit(limit: u32) -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let client = MarketplaceContractClient::new(&env, &env.register(MarketplaceContract, ()));
    client.initialize(&admin, &limit).unwrap();
    let seller = Address::generate(&env);
    Setup { env, client, admin, seller }
}

/// Initialise with the default limit (passes 0 → uses MAX_OFFERS_PER_LISTING = 10).
fn setup() -> Setup {
    setup_with_limit(0)
}

/// Create a listing and return its ID.
fn new_listing(s: &Setup) -> u64 {
    s.client.create_listing(&s.seller).unwrap()
}

/// Place an offer for `price` on `listing_id` from a fresh address.
fn new_offer(s: &Setup, listing_id: u64, price: i128) -> u64 {
    let maker = Address::generate(&s.env);
    s.client.make_offer(&maker, &listing_id, &price).unwrap()
}

// ── Initialization ────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_limit() {
    let s = setup_with_limit(5);
    assert_eq!(s.client.max_offers_per_listing(), 5);
}

#[test]
fn test_initialize_default_limit() {
    let s = setup(); // passes 0 → default 10
    assert_eq!(s.client.max_offers_per_listing(), 10);
}

#[test]
fn test_initialize_rejects_double_init() {
    let s = setup();
    let err = s.client.initialize(&s.admin, &5).unwrap_err();
    assert_eq!(err, ContractError::AlreadyInitialized);
}

// ── Listing creation ──────────────────────────────────────────────────────────

#[test]
fn test_create_listing_returns_sequential_ids() {
    let s = setup();
    let id1 = s.client.create_listing(&s.seller).unwrap();
    let id2 = s.client.create_listing(&s.seller).unwrap();
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
}

#[test]
fn test_create_listing_state_is_active() {
    let s = setup();
    let id = new_listing(&s);
    let listing = s.client.get_listing(&id).unwrap();
    assert_eq!(listing.state, ListingState::Active);
}

// ── make_offer: below the limit ───────────────────────────────────────────────

#[test]
fn test_make_offer_below_limit_succeeds() {
    let s = setup_with_limit(3);
    let lid = new_listing(&s);
    // 1st and 2nd offers — both below the limit of 3
    new_offer(&s, lid, 100);
    new_offer(&s, lid, 200);
    assert_eq!(s.client.active_offer_count(&lid), 2);
}

#[test]
fn test_make_offer_returns_sequential_ids() {
    let s = setup_with_limit(5);
    let lid = new_listing(&s);
    let oid1 = new_offer(&s, lid, 100);
    let oid2 = new_offer(&s, lid, 200);
    assert_eq!(oid1, 1);
    assert_eq!(oid2, 2);
}

#[test]
fn test_make_offer_state_is_active() {
    let s = setup();
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 500);
    let offer = s.client.get_offer(&oid).unwrap();
    assert_eq!(offer.state, OfferState::Active);
}

#[test]
fn test_make_offer_records_price() {
    let s = setup();
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 999);
    assert_eq!(s.client.get_offer(&oid).unwrap().price, 999);
}

// ── make_offer: exactly at the limit ─────────────────────────────────────────

#[test]
fn test_make_offer_at_limit_succeeds() {
    let s = setup_with_limit(3);
    let lid = new_listing(&s);
    for _ in 0..3 {
        new_offer(&s, lid, 100);
    }
    // Exactly 3 active offers — counter equals the limit
    assert_eq!(s.client.active_offer_count(&lid), 3);
}

// ── make_offer: beyond the limit ─────────────────────────────────────────────

#[test]
fn test_make_offer_beyond_limit_reverts() {
    let s = setup_with_limit(3);
    let lid = new_listing(&s);
    for _ in 0..3 {
        new_offer(&s, lid, 100);
    }
    // 4th offer must fail
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &lid, &100).unwrap_err();
    assert_eq!(err, ContractError::OfferLimitReached);
}

#[test]
fn test_make_offer_beyond_limit_does_not_increment_counter() {
    let s = setup_with_limit(2);
    let lid = new_listing(&s);
    new_offer(&s, lid, 100);
    new_offer(&s, lid, 200);
    let maker = Address::generate(&s.env);
    let _ = s.client.make_offer(&maker, &lid, &300); // must fail
    assert_eq!(s.client.active_offer_count(&lid), 2);
}

#[test]
fn test_make_offer_limit_1_allows_exactly_one() {
    let s = setup_with_limit(1);
    let lid = new_listing(&s);
    new_offer(&s, lid, 100); // OK
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &lid, &200).unwrap_err();
    assert_eq!(err, ContractError::OfferLimitReached);
}

// ── Capacity recovery: accept releases a slot ─────────────────────────────────

#[test]
fn test_capacity_released_after_accept() {
    let s = setup_with_limit(2);
    let lid = new_listing(&s);
    let oid1 = new_offer(&s, lid, 100);
    new_offer(&s, lid, 200);
    // Limit reached — next offer would fail
    let maker_extra = Address::generate(&s.env);
    assert_eq!(
        s.client.make_offer(&maker_extra, &lid, &300).unwrap_err(),
        ContractError::OfferLimitReached
    );
    // Accept first offer — releases a slot
    s.client.accept_offer(&s.seller, &oid1).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 1);
    // Now a new offer can be placed
    new_offer(&s, lid, 300);
    assert_eq!(s.client.active_offer_count(&lid), 2);
}

#[test]
fn test_capacity_released_after_reject() {
    let s = setup_with_limit(2);
    let lid = new_listing(&s);
    let oid1 = new_offer(&s, lid, 100);
    new_offer(&s, lid, 200);
    s.client.reject_offer(&s.seller, &oid1).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 1);
    new_offer(&s, lid, 300); // should succeed
    assert_eq!(s.client.active_offer_count(&lid), 2);
}

#[test]
fn test_capacity_released_after_withdraw() {
    let s = setup_with_limit(2);
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let oid1 = s.client.make_offer(&maker, &lid, &100).unwrap();
    new_offer(&s, lid, 200);
    s.client.withdraw_offer(&maker, &oid1).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 1);
    new_offer(&s, lid, 300); // should succeed
}

// ── Terminal state: offer no longer counts ────────────────────────────────────

#[test]
fn test_accepted_offer_not_counted() {
    let s = setup_with_limit(1);
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 100);
    s.client.accept_offer(&s.seller, &oid).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 0);
}

#[test]
fn test_rejected_offer_not_counted() {
    let s = setup_with_limit(1);
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 100);
    s.client.reject_offer(&s.seller, &oid).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 0);
}

#[test]
fn test_withdrawn_offer_not_counted() {
    let s = setup_with_limit(1);
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let oid = s.client.make_offer(&maker, &lid, &100).unwrap();
    s.client.withdraw_offer(&maker, &oid).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 0);
}

// ── Repeated state changes ────────────────────────────────────────────────────

#[test]
fn test_cannot_accept_already_accepted_offer() {
    let s = setup();
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 100);
    s.client.accept_offer(&s.seller, &oid).unwrap();
    let err = s.client.accept_offer(&s.seller, &oid).unwrap_err();
    assert_eq!(err, ContractError::OfferNotActive);
}

#[test]
fn test_cannot_reject_already_rejected_offer() {
    let s = setup();
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 100);
    s.client.reject_offer(&s.seller, &oid).unwrap();
    let err = s.client.reject_offer(&s.seller, &oid).unwrap_err();
    assert_eq!(err, ContractError::OfferNotActive);
}

#[test]
fn test_cannot_withdraw_already_withdrawn_offer() {
    let s = setup();
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let oid = s.client.make_offer(&maker, &lid, &100).unwrap();
    s.client.withdraw_offer(&maker, &oid).unwrap();
    let err = s.client.withdraw_offer(&maker, &oid).unwrap_err();
    assert_eq!(err, ContractError::OfferNotActive);
}

#[test]
fn test_cannot_withdraw_accepted_offer() {
    let s = setup();
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let oid = s.client.make_offer(&maker, &lid, &100).unwrap();
    s.client.accept_offer(&s.seller, &oid).unwrap();
    let err = s.client.withdraw_offer(&maker, &oid).unwrap_err();
    assert_eq!(err, ContractError::OfferNotActive);
}

#[test]
fn test_capacity_not_double_decremented() {
    // After accepting, counter is 0. A second accept must fail, not decrement past 0.
    let s = setup_with_limit(1);
    let lid = new_listing(&s);
    let oid = new_offer(&s, lid, 100);
    s.client.accept_offer(&s.seller, &oid).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 0);
    // Trying to accept again errors, counter stays 0
    let _ = s.client.accept_offer(&s.seller, &oid).unwrap_err();
    assert_eq!(s.client.active_offer_count(&lid), 0);
}

// ── Full cycle: fill → terminal → refill ─────────────────────────────────────

#[test]
fn test_full_cycle_fill_accept_refill() {
    let s = setup_with_limit(3);
    let lid = new_listing(&s);

    // Fill to limit
    let oid1 = new_offer(&s, lid, 100);
    let oid2 = new_offer(&s, lid, 200);
    let oid3 = new_offer(&s, lid, 300);
    assert_eq!(s.client.active_offer_count(&lid), 3);

    // All at limit — next blocked
    let extra = Address::generate(&s.env);
    assert_eq!(
        s.client.make_offer(&extra, &lid, &400).unwrap_err(),
        ContractError::OfferLimitReached
    );

    // Accept all three
    s.client.accept_offer(&s.seller, &oid1).unwrap();
    s.client.reject_offer(&s.seller, &oid2).unwrap();
    let maker3 = s.client.get_offer(&oid3).unwrap().maker;
    s.client.withdraw_offer(&maker3, &oid3).unwrap();
    assert_eq!(s.client.active_offer_count(&lid), 0);

    // Limit is fully restored — new offers succeed
    for _ in 0..3 {
        new_offer(&s, lid, 500);
    }
    assert_eq!(s.client.active_offer_count(&lid), 3);
}

// ── Edge cases ────────────────────────────────────────────────────────────────

#[test]
fn test_make_offer_on_nonexistent_listing_fails() {
    let s = setup();
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &999, &100).unwrap_err();
    assert_eq!(err, ContractError::ListingNotFound);
}

#[test]
fn test_make_offer_on_closed_listing_fails() {
    let s = setup();
    let lid = new_listing(&s);
    s.client.close_listing(&s.seller, &lid).unwrap();
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &lid, &100).unwrap_err();
    assert_eq!(err, ContractError::ListingNotActive);
}

#[test]
fn test_make_offer_zero_price_fails() {
    let s = setup();
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &lid, &0).unwrap_err();
    assert_eq!(err, ContractError::InvalidPrice);
}

#[test]
fn test_make_offer_negative_price_fails() {
    let s = setup();
    let lid = new_listing(&s);
    let maker = Address::generate(&s.env);
    let err = s.client.make_offer(&maker, &lid, &-1).unwrap_err();
    assert_eq!(err, ContractError::InvalidPrice);
}

#[test]
fn test_active_offer_count_starts_at_zero() {
    let s = setup();
    let lid = new_listing(&s);
    assert_eq!(s.client.active_offer_count(&lid), 0);
}

#[test]
fn test_independent_listings_have_independent_counters() {
    let s = setup_with_limit(1);
    let lid1 = new_listing(&s);
    let lid2 = new_listing(&s);

    new_offer(&s, lid1, 100); // fills lid1
    new_offer(&s, lid2, 200); // fills lid2

    assert_eq!(s.client.active_offer_count(&lid1), 1);
    assert_eq!(s.client.active_offer_count(&lid2), 1);

    // lid1 full — new offer blocked
    let m1 = Address::generate(&s.env);
    assert_eq!(
        s.client.make_offer(&m1, &lid1, &300).unwrap_err(),
        ContractError::OfferLimitReached
    );
    // lid2 full — new offer blocked independently
    let m2 = Address::generate(&s.env);
    assert_eq!(
        s.client.make_offer(&m2, &lid2, &400).unwrap_err(),
        ContractError::OfferLimitReached
    );
}

#[test]
fn test_offer_on_listing_id_not_affected_by_other_listing() {
    let s = setup_with_limit(2);
    let lid1 = new_listing(&s);
    let lid2 = new_listing(&s);

    // Fill lid1 to limit
    new_offer(&s, lid1, 100);
    new_offer(&s, lid1, 200);

    // lid2 is untouched — still accepts offers
    new_offer(&s, lid2, 300);
    assert_eq!(s.client.active_offer_count(&lid2), 1);
}

#[test]
fn test_large_limit() {
    let s = setup_with_limit(u32::MAX);
    let lid = new_listing(&s);
    // Can place many offers without hitting the limit
    for _ in 0..100 {
        new_offer(&s, lid, 1);
    }
    assert_eq!(s.client.active_offer_count(&lid), 100);
}

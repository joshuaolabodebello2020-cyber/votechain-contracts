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

use soroban_sdk::{Address, Env};

use crate::types::{ContractError, DataKey, Listing, Offer};

// ── Admin ─────────────────────────────────────────────────────────────────────

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Result<Address, ContractError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(ContractError::AdminNotSet)
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

// ── Config ────────────────────────────────────────────────────────────────────

pub fn set_max_offers_per_listing(env: &Env, limit: u32) {
    env.storage().instance().set(&DataKey::MaxOffersPerListing, &limit);
}

pub fn get_max_offers_per_listing(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::MaxOffersPerListing)
        .unwrap_or(10)
}

// ── Listings ──────────────────────────────────────────────────────────────────

pub fn next_listing_id(env: &Env) -> Result<u64, ContractError> {
    let n: u64 = env
        .storage()
        .instance()
        .get(&DataKey::ListingCount)
        .unwrap_or(0)
        .checked_add(1)
        .ok_or(ContractError::ListingCountOverflow)?;
    env.storage().instance().set(&DataKey::ListingCount, &n);
    Ok(n)
}

pub fn save_listing(env: &Env, listing: &Listing) {
    env.storage()
        .persistent()
        .set(&DataKey::Listing(listing.id), listing);
}

pub fn load_listing(env: &Env, id: u64) -> Result<Listing, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Listing(id))
        .ok_or(ContractError::ListingNotFound)
}

// ── Offers ────────────────────────────────────────────────────────────────────

pub fn next_offer_id(env: &Env) -> Result<u64, ContractError> {
    let n: u64 = env
        .storage()
        .instance()
        .get(&DataKey::OfferCount)
        .unwrap_or(0)
        .checked_add(1)
        .ok_or(ContractError::OfferCountOverflow)?;
    env.storage().instance().set(&DataKey::OfferCount, &n);
    Ok(n)
}

pub fn save_offer(env: &Env, offer: &Offer) {
    env.storage()
        .persistent()
        .set(&DataKey::Offer(offer.id), offer);
}

pub fn load_offer(env: &Env, id: u64) -> Result<Offer, ContractError> {
    env.storage()
        .persistent()
        .get(&DataKey::Offer(id))
        .ok_or(ContractError::OfferNotFound)
}

// ── Active offer counter ──────────────────────────────────────────────────────

/// Returns the number of currently active offers for `listing_id`.
pub fn get_active_offer_count(env: &Env, listing_id: u64) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::ActiveOfferCount(listing_id))
        .unwrap_or(0)
}

/// Increments the active-offer counter for `listing_id`.
pub fn increment_active_offers(env: &Env, listing_id: u64) {
    let n = get_active_offer_count(env, listing_id) + 1;
    env.storage()
        .persistent()
        .set(&DataKey::ActiveOfferCount(listing_id), &n);
}

/// Decrements the active-offer counter for `listing_id`.
/// Saturates at zero (never underflows).
pub fn decrement_active_offers(env: &Env, listing_id: u64) {
    let n = get_active_offer_count(env, listing_id).saturating_sub(1);
    env.storage()
        .persistent()
        .set(&DataKey::ActiveOfferCount(listing_id), &n);
}

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

#![no_std]

mod storage;
mod types;

#[cfg(test)]
mod test;

pub use types::{ContractError, Listing, ListingState, Offer, OfferState};

use soroban_sdk::{contract, contractimpl, Address, Env};
use storage::{
    decrement_active_offers, get_active_offer_count, get_admin, get_max_offers_per_listing,
    increment_active_offers, is_initialized, load_listing, load_offer, next_listing_id,
    next_offer_id, save_listing, save_offer, set_admin, set_max_offers_per_listing,
};
use types::{DataKey, ListingState, OfferState};

/// Configurable maximum number of active offers per listing.
///
/// This constant is the *default* used when `initialize` is called with
/// `max_offers_per_listing = 0` (meaning "use default"). Callers may supply
/// any positive `u32` value to override it.
pub const MAX_OFFERS_PER_LISTING: u32 = 10;

// ── Zero-address sentinel (matches governance contract convention) ─────────────
const ZERO_ADDRESS: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

fn require_non_zero(env: &Env, addr: &Address) -> Result<(), ContractError> {
    let zero = Address::from_str(env, ZERO_ADDRESS);
    if *addr == zero {
        return Err(ContractError::InvalidAddress);
    }
    Ok(())
}

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Initialize the marketplace.
    ///
    /// # Parameters
    /// - `admin` — privileged address that may accept/reject offers and close listings.
    /// - `max_offers_per_listing` — maximum simultaneous active offers per listing.
    ///   Pass `0` to use the built-in default ([`MAX_OFFERS_PER_LISTING`] = 10).
    ///
    /// # Errors
    /// - [`ContractError::AlreadyInitialized`] if called more than once.
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::InvalidOfferLimit`] if `max_offers_per_listing` overflows
    ///   after defaulting (i.e. value would be 0 after adjustment — impossible in practice).
    pub fn initialize(
        env: Env,
        admin: Address,
        max_offers_per_listing: u32,
    ) -> Result<(), ContractError> {
        admin.require_auth();
        require_non_zero(&env, &admin)?;
        if is_initialized(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        let limit = if max_offers_per_listing == 0 {
            MAX_OFFERS_PER_LISTING
        } else {
            max_offers_per_listing
        };
        set_admin(&env, &admin);
        set_max_offers_per_listing(&env, limit);
        Ok(())
    }

    // ── Listings ──────────────────────────────────────────────────────────────

    /// Create a new listing. Returns the new listing ID.
    ///
    /// # Errors
    /// - [`ContractError::NotInitialized`] if the contract is not initialised.
    /// - [`ContractError::InvalidAddress`] if `seller` is the zero address.
    pub fn create_listing(env: Env, seller: Address) -> Result<u64, ContractError> {
        if !is_initialized(&env) {
            return Err(ContractError::NotInitialized);
        }
        seller.require_auth();
        require_non_zero(&env, &seller)?;
        let id = next_listing_id(&env)?;
        save_listing(&env, &Listing { id, seller, state: ListingState::Active });
        Ok(id)
    }

    /// Close a listing (seller-initiated). No new offers may be placed.
    ///
    /// # Errors
    /// - [`ContractError::ListingNotFound`] / [`ContractError::ListingNotActive`]
    pub fn close_listing(env: Env, seller: Address, listing_id: u64) -> Result<(), ContractError> {
        seller.require_auth();
        let mut listing = load_listing(&env, listing_id)?;
        if listing.state != ListingState::Active {
            return Err(ContractError::ListingNotActive);
        }
        listing.state = ListingState::Closed;
        save_listing(&env, &listing);
        Ok(())
    }

    // ── Offers ────────────────────────────────────────────────────────────────

    /// Place an offer on a listing.
    ///
    /// Enforces `MAX_OFFERS_PER_LISTING`: if the listing already has
    /// `max_offers_per_listing` active offers, the call reverts with
    /// [`ContractError::OfferLimitReached`].
    ///
    /// Only offers in [`OfferState::Active`] count toward the limit.
    /// Offers that have transitioned to [`OfferState::Accepted`],
    /// [`OfferState::Rejected`], or [`OfferState::Withdrawn`] do **not**
    /// consume capacity.
    ///
    /// # Errors
    /// - [`ContractError::ListingNotFound`] — listing does not exist.
    /// - [`ContractError::ListingNotActive`] — listing is closed or cancelled.
    /// - [`ContractError::OfferLimitReached`] — active-offer cap reached.
    /// - [`ContractError::InvalidPrice`] — `price` is zero or negative.
    pub fn make_offer(
        env: Env,
        maker: Address,
        listing_id: u64,
        price: i128,
    ) -> Result<u64, ContractError> {
        maker.require_auth();
        require_non_zero(&env, &maker)?;

        let listing = load_listing(&env, listing_id)?;
        if listing.state != ListingState::Active {
            return Err(ContractError::ListingNotActive);
        }
        if price <= 0 {
            return Err(ContractError::InvalidPrice);
        }

        // ── Enforce per-listing active-offer cap ──────────────────────────────
        let active = get_active_offer_count(&env, listing_id);
        let limit = get_max_offers_per_listing(&env);
        if active >= limit {
            return Err(ContractError::OfferLimitReached);
        }

        let id = next_offer_id(&env)?;
        save_offer(&env, &Offer {
            id,
            listing_id,
            maker,
            price,
            state: OfferState::Active,
        });
        increment_active_offers(&env, listing_id);
        Ok(id)
    }

    /// Accept an offer. Only the listing seller may accept.
    ///
    /// Transitions the offer to [`OfferState::Accepted`] and releases one
    /// active-offer slot for the listing.
    ///
    /// # Errors
    /// - [`ContractError::OfferNotFound`] / [`ContractError::OfferNotActive`]
    /// - [`ContractError::NotAdmin`] — caller is not the listing seller
    pub fn accept_offer(
        env: Env,
        seller: Address,
        offer_id: u64,
    ) -> Result<(), ContractError> {
        seller.require_auth();
        let mut offer = load_offer(&env, offer_id)?;
        if offer.state != OfferState::Active {
            return Err(ContractError::OfferNotActive);
        }
        let listing = load_listing(&env, offer.listing_id)?;
        if listing.seller != seller {
            return Err(ContractError::NotAdmin);
        }
        offer.state = OfferState::Accepted;
        save_offer(&env, &offer);
        decrement_active_offers(&env, offer.listing_id);
        Ok(())
    }

    /// Reject an offer. Only the listing seller may reject.
    ///
    /// Releases one active-offer slot.
    pub fn reject_offer(
        env: Env,
        seller: Address,
        offer_id: u64,
    ) -> Result<(), ContractError> {
        seller.require_auth();
        let mut offer = load_offer(&env, offer_id)?;
        if offer.state != OfferState::Active {
            return Err(ContractError::OfferNotActive);
        }
        let listing = load_listing(&env, offer.listing_id)?;
        if listing.seller != seller {
            return Err(ContractError::NotAdmin);
        }
        offer.state = OfferState::Rejected;
        save_offer(&env, &offer);
        decrement_active_offers(&env, offer.listing_id);
        Ok(())
    }

    /// Withdraw an offer. Only the offer maker may withdraw.
    ///
    /// Releases one active-offer slot.
    pub fn withdraw_offer(
        env: Env,
        maker: Address,
        offer_id: u64,
    ) -> Result<(), ContractError> {
        maker.require_auth();
        let mut offer = load_offer(&env, offer_id)?;
        if offer.state != OfferState::Active {
            return Err(ContractError::OfferNotActive);
        }
        if offer.maker != maker {
            return Err(ContractError::NotOfferMaker);
        }
        offer.state = OfferState::Withdrawn;
        save_offer(&env, &offer);
        decrement_active_offers(&env, offer.listing_id);
        Ok(())
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /// Returns the active-offer count for a listing.
    pub fn active_offer_count(env: Env, listing_id: u64) -> u32 {
        get_active_offer_count(&env, listing_id)
    }

    /// Returns the configured per-listing offer limit.
    pub fn max_offers_per_listing(env: Env) -> u32 {
        get_max_offers_per_listing(&env)
    }

    /// Returns a listing by ID.
    pub fn get_listing(env: Env, listing_id: u64) -> Result<Listing, ContractError> {
        load_listing(&env, listing_id)
    }

    /// Returns an offer by ID.
    pub fn get_offer(env: Env, offer_id: u64) -> Result<Offer, ContractError> {
        load_offer(&env, offer_id)
    }
}

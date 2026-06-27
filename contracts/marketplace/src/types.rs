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

use soroban_sdk::{contracterror, contracttype, Address};

/// All revert conditions for the marketplace contract.
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    /// 1 – Contract has already been initialized
    AlreadyInitialized = 1,
    /// 2 – Contract has not been initialized
    NotInitialized = 2,
    /// 3 – Caller is not the admin
    NotAdmin = 3,
    /// 4 – Admin address is not set
    AdminNotSet = 4,
    /// 5 – Listing with the given ID does not exist
    ListingNotFound = 5,
    /// 6 – Listing is not active (already closed or cancelled)
    ListingNotActive = 6,
    /// 7 – Offer with the given ID does not exist
    OfferNotFound = 7,
    /// 8 – Offer is not in a state that allows this operation
    OfferNotActive = 8,
    /// 9 – The listing has reached its maximum number of active offers
    OfferLimitReached = 9,
    /// 10 – Offer price must be greater than zero
    InvalidPrice = 10,
    /// 11 – Offer ID counter overflowed
    OfferCountOverflow = 11,
    /// 12 – Listing ID counter overflowed
    ListingCountOverflow = 12,
    /// 13 – MAX_OFFERS_PER_LISTING must be at least 1
    InvalidOfferLimit = 13,
    /// 14 – Caller is not the offer maker
    NotOfferMaker = 14,
    /// 15 – Address parameter is invalid
    InvalidAddress = 15,
}

/// Lifecycle state of an individual listing.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ListingState {
    /// Accepting offers.
    Active,
    /// Closed by the seller (no new offers accepted).
    Closed,
    /// Cancelled by admin.
    Cancelled,
}

/// Lifecycle state of an individual offer.
///
/// Only `Active` offers count toward the per-listing active-offer total.
/// Offers in `Accepted`, `Rejected`, or `Withdrawn` state do **not** consume
/// capacity, so slots are reclaimed when any of these terminal states are reached.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum OfferState {
    /// Offer is open and awaiting a response.
    Active,
    /// Offer was accepted by the seller.
    Accepted,
    /// Offer was rejected by the seller.
    Rejected,
    /// Offer was withdrawn by the maker.
    Withdrawn,
}

/// A marketplace listing created by a seller.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Listing {
    pub id: u64,
    pub seller: Address,
    pub state: ListingState,
}

/// A buyer's offer on a listing.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Offer {
    pub id: u64,
    pub listing_id: u64,
    pub maker: Address,
    pub price: i128,
    pub state: OfferState,
}

/// Storage key enum for the marketplace contract.
#[contracttype]
pub enum DataKey {
    /// Contract admin (instance).
    Admin,
    /// Maximum active offers per listing (instance).
    MaxOffersPerListing,
    /// Monotonic listing ID counter (instance).
    ListingCount,
    /// Monotonic offer ID counter (instance).
    OfferCount,
    /// Full [`Listing`] struct keyed by listing ID (persistent).
    Listing(u64),
    /// Full [`Offer`] struct keyed by offer ID (persistent).
    Offer(u64),
    /// Number of currently active offers for a listing (persistent).
    /// Incremented on `make_offer`, decremented when an offer reaches a terminal state.
    ActiveOfferCount(u64),
}

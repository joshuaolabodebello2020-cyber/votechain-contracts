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

use soroban_sdk::{symbol_short, Address, Env};

// First topic on every token event so off-chain indexers can distinguish token
// events from governance events when aggregating across contracts (#549).
const CONTRACT_TYPE: fn() -> soroban_sdk::Symbol = || symbol_short!("tok");

/// # Event Schema
///
/// All events are published via `env.events().publish(topics, data)`.
/// The first topic is always `"tok"` to enable cross-contract indexing (#549).
///
/// | Function         | Topics                         | Data                    |
/// |------------------|--------------------------------|-------------------------|
/// | mint             | `("tok", "mint", to)`          | `amount: i128`          |
/// | transfer         | `("tok", "transfer", from)`    | `(to, amount)`          |
/// | burn             | `("tok", "burn", from)`        | `amount: i128`          |
/// | admin_transferred| `("tok", "admxfer")`           | `(old_admin, new_admin)`|
/// | freeze           | `("tok", "freeze", addr)`      | `()`                    |
/// | unfreeze         | `("tok", "unfreeze", addr)`    | `()`                    |

/// Emits a `mint` event when tokens are minted.
pub fn minted(env: &Env, to: &Address, amount: i128) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("mint"), to.clone()), amount);
}

/// Emits a `transfer` event when tokens are transferred between addresses.
pub fn transferred(env: &Env, from: &Address, to: &Address, amount: i128) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("transfer"), from.clone()),
        (to.clone(), amount),
    );
}

/// Emits a `burn` event when tokens are burned.
pub fn burned(env: &Env, from: &Address, amount: i128) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("burn"), from.clone()), amount);
}

/// Emits an `admxfer` event when admin rights are transferred.
///
/// Topics: `("tok", "admxfer")`
/// Data: `(old_admin: Address, new_admin: Address)`
pub fn admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("admxfer")),
        (old_admin.clone(), new_admin.clone()),
    );
}

/// Emits a `freeze` event when an address is frozen.
pub fn frozen(env: &Env, addr: &Address) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("freeze"), addr.clone()), ());
}

/// Emits an `unfreeze` event when an address is unfrozen.
pub fn unfrozen(env: &Env, addr: &Address) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("unfreeze"), addr.clone()), ());
}

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

use soroban_sdk::{symbol_short, Address, Env, String};
use crate::types::{ProposalState, Vote};
use soroban_sdk::{symbol_short, Address, Env};

/// # Event Schema
///
/// All events are published via `env.events().publish(topics, data)`.
/// Topics are a tuple of `(Symbol, ...)` for efficient off-chain filtering.
///
/// | Function      | Topic 0        | Topic 1       | Data                              |
/// |---------------|----------------|---------------|-----------------------------------|
/// | initialize    | `"init"`       | —             | `admin: Address`                  |
/// | create_proposal | `"created"`  | `id: u64`     | `proposer: Address`               |/// | amend_proposal | "amended"   | `id: u64`     | `(proposer, title, description)`  |/// | cast_vote     | `"vote"`       | `id: u64`     | `(voter, vote, weight)`           |
/// | finalise      | `"final"`      | `id: u64`     | `state: ProposalState`            |
/// | execute       | `"executed"`   | `id: u64`     | `()`                              |
/// | cancel        | `"cancelled"`  | `id: u64`     | `()`                              |
/// | update_quorum | `"qupdate"`    | `id: u64`     | `new_quorum: i128`                |
/// | transfer_admin | `"admxfer"`   | —             | `(old_admin, new_admin): (Address, Address)` |
///
/// Emits an `init` event when the contract is initialised.
///
/// Topics: `("init",)`  
/// Data: `admin: Address`
pub fn contract_initialized(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("init"),), admin.clone());
}

/// Emits a `created` event when a new proposal is created.
///
/// Topics: `("created", id)`  
/// Data: `proposer: Address`
pub fn proposal_created(env: &Env, id: u64, proposer: &Address) {
    env.events()
        .publish((symbol_short!("created"), id), proposer.clone());
}

/// Emits a `vote` event when a vote is cast.
///
/// Topics: `("vote", id)`  
/// Data: `(voter: Address, vote: Vote, weight: i128)`
pub fn vote_cast(env: &Env, id: u64, voter: &Address, vote: &Vote, weight: i128) {
    env.events().publish(
        (symbol_short!("vote"), id),
        (voter.clone(), vote.clone(), weight),
    );
}

/// Emits a `final` event when a proposal is finalised (Passed or Rejected).
///
/// Topics: `("final", id)`
/// Data: `(state: ProposalState, execute_after: u64)`
///
/// `execute_after` is the earliest Unix timestamp at which the proposal may be
/// executed (non-zero only when `state == Passed`).  Consumers can use this to
/// schedule an execution call without querying the proposal struct separately.
pub fn proposal_finalised(env: &Env, id: u64, state: &ProposalState, execute_after: u64) {
    env.events()
        .publish((symbol_short!("final"), id), (state.clone(), execute_after));
}

/// Emits an `executed` event when a passed proposal is executed.
///
/// Topics: `("executed", id)`  
/// Data: `()`
pub fn proposal_executed(env: &Env, id: u64) {
    env.events().publish((symbol_short!("executed"), id), ());
}

/// Emits a `cancelled` event when a proposal is cancelled by admin.
///
/// Topics: `("cancelled", id)`  
/// Data: `()`
pub fn proposal_cancelled(env: &Env, id: u64) {
    env.events().publish((symbol_short!("cancelled"), id), ());
}

/// Emits an `amended` event when a proposal is updated before voting starts.
///
/// Topics: `("amended", id)`  
/// Data: `(proposer: Address, title: String, description: String)`
pub fn proposal_amended(env: &Env, id: u64, proposer: &Address, title: &String, description: &String) {
    env.events().publish((symbol_short!("amended"), id), (proposer.clone(), title.clone(), description.clone()));
}

/// Emits a `qupdate` event when a proposal's quorum is updated.
///
/// Topics: `("qupdate", id)`  
/// Data: `new_quorum: i128`
pub fn quorum_updated(env: &Env, id: u64, new_quorum: i128) {
    env.events()
        .publish((symbol_short!("qupdate"), id), new_quorum);
}

/// Emits an `admxfer` event when admin rights are transferred.
///
/// Topics: `("admxfer",)`
/// Data: `(old_admin: Address, new_admin: Address)`
pub fn admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (symbol_short!("admxfer"),),
        (old_admin.clone(), new_admin.clone()),
    );
}

/// Emits an `admpropose` event when a two-step admin rotation is proposed.
///
/// Topics: `("admpropose",)`
/// Data: `(current_admin: Address, nominee: Address, expiry: u64)`
pub fn admin_transfer_proposed(env: &Env, admin: &Address, nominee: &Address, expiry: u64) {
    env.events().publish(
        (symbol_short!("admprop"),),
        (admin.clone(), nominee.clone(), expiry),
    );
}

/// Emits a `paused` event when the contract is paused.
///
/// Topics: `("paused",)`
/// Data: `(admin: Address, reason: Option<String>)`
pub fn contract_paused(env: &Env, admin: &Address, reason: Option<String>) {
    env.events()
        .publish((symbol_short!("paused"),), (admin.clone(), reason));
}

/// Emits an `unpaused` event when the contract is unpaused.
///
/// Topics: `("unpaused",)`
/// Data: `admin: Address`
pub fn contract_unpaused(env: &Env, admin: &Address) {
    env.events()
        .publish((symbol_short!("unpaused"),), admin.clone());
}

/// Emits an `upgraded` event when the contract version is upgraded.
///
/// Topics: `("upgraded",)`
/// Data: `(old_version: (u32, u32, u32), new_version: (u32, u32, u32))`
pub fn contract_upgraded(env: &Env, old_version: (u32, u32, u32), new_version: (u32, u32, u32)) {
    env.events()
        .publish((symbol_short!("upgraded"),), (old_version, new_version));
}

/// Emits a `migrated` event when a storage migration completes.
///
/// Topics: `("migrated",)`
/// Data: `(old_version: (u32, u32, u32), new_version: (u32, u32, u32))`
pub fn migration_completed(env: &Env, old_version: (u32, u32, u32), new_version: (u32, u32, u32)) {
    env.events()
        .publish((symbol_short!("migrated"),), (old_version, new_version));
}

/// Emits a `migrated` event when a contract migration completes.
///
/// Topics: `("migrated",)`
/// Data: `(old_version: (u32, u32, u32), new_version: (u32, u32, u32))`
pub fn migration_completed(env: &Env, old_version: (u32, u32, u32), new_version: (u32, u32, u32)) {
    env.events().publish((symbol_short!("migrated"),), (old_version, new_version));
}

/// Emits an `mspropose` event when a multi-sig action is proposed.
///
/// Topics: `("mspropose", action_id)`
/// Data: `(proposer: Address, action_type: MultiSigActionType)`
pub fn multisig_action_proposed(
    env: &Env,
    action_id: u64,
    proposer: &Address,
    action_type: &MultiSigActionType,
) {
    env.events().publish(
        (symbol_short!("msprop"), action_id),
        (proposer.clone(), action_type.clone()),
    );
}

/// Emits an `msapprove` event when a multi-sig action receives an approval.
///
/// Topics: `("msapprove", action_id)`
/// Data: `(approver: Address, approvals: u32, threshold: u32)`
pub fn multisig_action_approved(
    env: &Env,
    action_id: u64,
    approver: &Address,
    approvals: u32,
    threshold: u32,
) {
    env.events().publish(
        (symbol_short!("msapprv"), action_id),
        (approver.clone(), approvals, threshold),
    );
}

/// Emits an `msexec` event when a multi-sig action reaches threshold and executes.
///
/// Topics: `("msexec", action_id)`
/// Data: `action_type: MultiSigActionType`
pub fn multisig_action_executed(env: &Env, action_id: u64, action_type: &MultiSigActionType) {
    env.events().publish(
        (symbol_short!("msexec"), action_id),
        action_type.clone(),
    );
}

/// Emits an `mscfg` event when the multi-sig config is updated.
///
/// Topics: `("mscfg",)`
/// Data: `threshold: u32`
pub fn multisig_config_updated(env: &Env, threshold: u32) {
    env.events().publish((symbol_short!("mscfg"),), threshold);
}

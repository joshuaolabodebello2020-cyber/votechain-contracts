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
use crate::types::{MultiSigActionType, ProposalState, Vote};

// First topic on every governance event so off-chain indexers can distinguish
// governance events from token events when aggregating across contracts (#549).
const CONTRACT_TYPE: fn() -> soroban_sdk::Symbol = || symbol_short!("gov");

/// # Event Schema
///
/// All events are published via `env.events().publish(topics, data)`.
/// The first topic is always `"gov"` to enable cross-contract indexing (#549).
///
/// | Function             | Topics                          | Data                                      |
/// |----------------------|---------------------------------|-------------------------------------------|
/// | initialize           | `("gov", "init")`               | `admin: Address`                          |
/// | create_proposal      | `("gov", "created", id)`        | `(proposer: Address, metadata_ver: u32)`  |
/// | amend_proposal       | `("gov", "amended", id)`        | `(proposer, title, description)`          |
/// | cast_vote            | `("gov", "vote", id)`           | `(voter, vote, weight)`                   |
/// | finalise             | `("gov", "final", id)`          | `(state, execute_after)`                  |
/// | execute              | `("gov", "executed", id)`       | `()`                                      |
/// | cancel               | `("gov", "cancelled", id)`      | `()`                                      |
/// | update_quorum        | `("gov", "qupdate", id)`        | `new_quorum: i128`                        |
/// | transfer_admin       | `("gov", "admxfer")`            | `(old_admin, new_admin)`                  |
/// | propose_admin_xfer   | `("gov", "admprop")`            | `(admin, nominee, expiry)`                |
/// | pause                | `("gov", "paused")`             | `(admin, reason)`                         |
/// | unpause              | `("gov", "unpaused")`           | `admin: Address`                          |
/// | upgrade              | `("gov", "upgraded")`           | `(old_ver, new_ver)`                      |
/// | migrate              | `("gov", "migrated")`           | `(old_ver, new_ver)`                      |
/// | update_spam_config   | `("gov", "spamcfg")`            | `(min_balance, cooldown)`                 |
/// | initialize_multisig  | `("gov", "mscfg")`              | `threshold: u32`                          |
/// | propose_multisig     | `("gov", "msprop", action_id)`  | `(proposer, action_type)`                 |
/// | approve_multisig     | `("gov", "msapprv", action_id)` | `(approver, approvals, threshold)`        |
/// | exec_multisig        | `("gov", "msexec", action_id)`  | `action_type`                             |
/// | veto                 | `("gov", "veto", id)`           | `(votes_no, veto_threshold)`              |

/// Emits an `init` event when the contract is initialised.
pub fn contract_initialized(env: &Env, admin: &Address) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("init")), admin.clone());
}

/// Emits a `created` event when a new proposal is created.
/// Data includes the proposer address and metadata version for indexer schema awareness (#547, #549).
pub fn proposal_created(env: &Env, id: u64, proposer: &Address, metadata_version: u32) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("created"), id), (proposer.clone(), metadata_version));
}

/// Emits a `vote` event when a vote is cast.
pub fn vote_cast(env: &Env, id: u64, voter: &Address, vote: &Vote, weight: i128) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("vote"), id),
        (voter.clone(), vote.clone(), weight),
    );
}

/// Emits a `final` event when a proposal is finalised (Passed or Rejected).
///
/// `execute_after` is the earliest Unix timestamp at which the proposal may be
/// executed (non-zero only when `state == Passed`).
pub fn proposal_finalised(env: &Env, id: u64, state: &ProposalState, execute_after: u64) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("final"), id), (state.clone(), execute_after));
}

/// Emits a `veto` event when a proposal is immediately rejected by the veto mechanism.
pub fn proposal_vetoed(env: &Env, id: u64, votes_no: i128, veto_threshold: i128) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("veto"), id),
        (votes_no, veto_threshold),
    );
}

/// Emits an `executed` event when a passed proposal is executed.
pub fn proposal_executed(env: &Env, id: u64) {
    env.events().publish((CONTRACT_TYPE(), symbol_short!("executed"), id), ());
}

/// Emits a `cancelled` event when a proposal is cancelled by admin.
pub fn proposal_cancelled(env: &Env, id: u64) {
    env.events().publish((CONTRACT_TYPE(), symbol_short!("cancelled"), id), ());
}

/// Emits an `amended` event when a proposal is updated before voting starts.
pub fn proposal_amended(env: &Env, id: u64, proposer: &Address, title: &String, description: &String) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("amended"), id),
        (proposer.clone(), title.clone(), description.clone()),
    );
}

/// Emits a `qupdate` event when a proposal's quorum is updated.
pub fn quorum_updated(env: &Env, id: u64, new_quorum: i128) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("qupdate"), id), new_quorum);
}

/// Emits an `admxfer` event when admin rights are transferred.
pub fn admin_transferred(env: &Env, old_admin: &Address, new_admin: &Address) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("admxfer")),
        (old_admin.clone(), new_admin.clone()),
    );
}

/// Emits an `admprop` event when a two-step admin rotation is proposed.
pub fn admin_transfer_proposed(env: &Env, admin: &Address, nominee: &Address, expiry: u64) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("admprop")),
        (admin.clone(), nominee.clone(), expiry),
    );
}

/// Emits a `paused` event when the contract is paused.
pub fn contract_paused(env: &Env, admin: &Address, reason: Option<String>) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("paused")), (admin.clone(), reason));
}

/// Emits an `unpaused` event when the contract is unpaused.
pub fn contract_unpaused(env: &Env, admin: &Address) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("unpaused")), admin.clone());
}

/// Emits an `upgraded` event when the contract version is upgraded.
pub fn contract_upgraded(env: &Env, old_version: (u32, u32, u32), new_version: (u32, u32, u32)) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("upgraded")), (old_version, new_version));
}

/// Emits a `migrated` event when a storage migration completes.
pub fn migration_completed(env: &Env, old_version: (u32, u32, u32), new_version: (u32, u32, u32)) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("migrated")), (old_version, new_version));
}

/// Emits a `spamcfg` event when spam-prevention parameters are updated (#548).
///
/// Topics: `("gov", "spamcfg")`
/// Data: `(min_proposal_balance: i128, proposal_cooldown: u64)`
pub fn spam_config_updated(env: &Env, min_proposal_balance: i128, proposal_cooldown: u64) {
    env.events()
        .publish((CONTRACT_TYPE(), symbol_short!("spamcfg")), (min_proposal_balance, proposal_cooldown));
}

/// Emits an `msprop` event when a multi-sig action is proposed.
pub fn multisig_action_proposed(
    env: &Env,
    action_id: u64,
    proposer: &Address,
    action_type: &MultiSigActionType,
) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("msprop"), action_id),
        (proposer.clone(), action_type.clone()),
    );
}

/// Emits an `msapprv` event when a multi-sig action receives an approval.
pub fn multisig_action_approved(
    env: &Env,
    action_id: u64,
    approver: &Address,
    approvals: u32,
    threshold: u32,
) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("msapprv"), action_id),
        (approver.clone(), approvals, threshold),
    );
}

/// Emits an `msexec` event when a multi-sig action reaches threshold and executes.
pub fn multisig_action_executed(env: &Env, action_id: u64, action_type: &MultiSigActionType) {
    env.events().publish(
        (CONTRACT_TYPE(), symbol_short!("msexec"), action_id),
        action_type.clone(),
    );
}

/// Emits an `mscfg` event when the multi-sig config is updated.
pub fn multisig_config_updated(env: &Env, threshold: u32) {
    env.events().publish((CONTRACT_TYPE(), symbol_short!("mscfg")), threshold);
}

/// Emits a `delegated` event when a delegation is set.
///
/// Topics: `("delegated", delegator)`
/// Data: `delegatee: Address`
pub fn delegation_set(env: &Env, delegator: &Address, delegatee: &Address) {
    env.events().publish(
        (symbol_short!("delegated"), delegator.clone()),
        delegatee.clone(),
    );
}

/// Emits an `undelegat` event when a delegation is removed.
///
/// Topics: `("undelegat", delegator)`
/// Data: `()`
pub fn delegation_cleared(env: &Env, delegator: &Address) {
    env.events()
        .publish((symbol_short!("undelegat"), delegator.clone()), ());
}

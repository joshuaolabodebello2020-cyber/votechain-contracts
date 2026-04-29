use soroban_sdk::{symbol_short, Address, Env};
use crate::types::{ProposalState, Vote};

/// # Event Schema
///
/// All events are published via `env.events().publish(topics, data)`.
/// Topics are a tuple of `(Symbol, ...)` for efficient off-chain filtering.
///
/// | Function      | Topic 0        | Topic 1       | Data                              |
/// |---------------|----------------|---------------|-----------------------------------|
/// | initialize    | `"init"`       | —             | `admin: Address`                  |
/// | create_proposal | `"created"`  | `id: u64`     | `proposer: Address`               |
/// | cast_vote     | `"vote"`       | `id: u64`     | `(voter, vote, weight)`           |
/// | finalise      | `"final"`      | `id: u64`     | `state: ProposalState`            |
/// | execute       | `"executed"`   | `id: u64`     | `()`                              |
/// | cancel        | `"cancelled"`  | `id: u64`     | `()`                              |
/// | update_quorum | `"qupdate"`    | `id: u64`     | `new_quorum: i128`                |
/// | transfer_admin | `"admxfer"`   | —             | `(old_admin, new_admin): (Address, Address)` |

/// Emits an `init` event when the contract is initialised.
///
/// Topics: `("init",)`  
/// Data: `admin: Address`
pub fn contract_initialized(env: &Env, admin: &Address) {
    env.events().publish((symbol_short!("init"),), admin.clone());
}

/// Emits a `created` event when a new proposal is created.
///
/// Topics: `("created", id)`  
/// Data: `proposer: Address`
pub fn proposal_created(env: &Env, id: u64, proposer: &Address) {
    env.events().publish((symbol_short!("created"), id), proposer.clone());
}

/// Emits a `vote` event when a vote is cast.
///
/// Topics: `("vote", id)`  
/// Data: `(voter: Address, vote: Vote, weight: i128)`
pub fn vote_cast(env: &Env, id: u64, voter: &Address, vote: &Vote, weight: i128) {
    env.events().publish((symbol_short!("vote"), id), (voter.clone(), vote.clone(), weight));
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
    env.events().publish((symbol_short!("final"), id), (state.clone(), execute_after));
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

/// Emits a `qupdate` event when a proposal's quorum is updated.
///
/// Topics: `("qupdate", id)`  
/// Data: `new_quorum: i128`
pub fn quorum_updated(env: &Env, id: u64, new_quorum: i128) {
    env.events().publish((symbol_short!("qupdate"), id), new_quorum);
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

/// Emits a `paused` event when the contract is paused.
///
/// Topics: `("paused",)`
/// Data: `admin: Address`
pub fn contract_paused(env: &Env, admin: &Address) {
    env.events().publish((symbol_short!("paused"),), admin.clone());
}

/// Emits an `unpaused` event when the contract is unpaused.
///
/// Topics: `("unpaused",)`
/// Data: `admin: Address`
pub fn contract_unpaused(env: &Env, admin: &Address) {
    env.events().publish((symbol_short!("unpaused"),), admin.clone());
}

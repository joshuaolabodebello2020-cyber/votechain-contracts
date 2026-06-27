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

//! Vote delegation (liquid democracy) helpers.
//!
//! Each token holder may delegate their voting power to at most one delegatee.
//! The delegatee's vote weight includes their own balance plus the aggregate
//! balances of all addresses that have delegated to them.

use soroban_sdk::{token, Address, Env};

use crate::events;
use crate::storage::{
    clear_delegation, get_delegated_weight, get_delegatee, get_voting_token,
    set_delegated_weight, set_delegation,
};
use crate::types::ContractError;

/// Returns `true` if assigning `delegator` → `delegatee` would create a cycle.
pub fn would_create_cycle(env: &Env, delegator: &Address, delegatee: &Address) -> bool {
    let mut current = delegatee.clone();
    loop {
        match get_delegatee(env, &current) {
            None => return false,
            Some(next) => {
                if next == *delegator {
                    return true;
                }
                current = next;
            }
        }
    }
}

/// Adjusts the stored delegated-weight aggregate for `delegatee` by `delta`.
fn adjust_delegated_weight(
    env: &Env,
    delegatee: &Address,
    delta: i128,
) -> Result<(), ContractError> {
    let current = get_delegated_weight(env, delegatee);
    let updated = current
        .checked_add(delta)
        .ok_or(ContractError::VoteTallyOverflow)?;
    if updated < 0 {
        return Err(ContractError::VoteTallyOverflow);
    }
    if updated == 0 {
        set_delegated_weight(env, delegatee, 0);
    } else {
        set_delegated_weight(env, delegatee, updated);
    }
    Ok(())
}

/// Removes `delegator`'s current balance from their existing delegatee's aggregate.
fn remove_from_current_delegatee(env: &Env, delegator: &Address) -> Result<(), ContractError> {
    if let Some(old_delegatee) = get_delegatee(env, delegator) {
        let token = token::Client::new(env, &get_voting_token(env)?);
        let balance = token.balance(delegator);
        if balance > 0 {
            adjust_delegated_weight(env, &old_delegatee, -balance)?;
        }
        clear_delegation(env, delegator);
    }
    Ok(())
}

/// Delegates `delegator`'s voting power to `delegatee`.
pub fn delegate(
    env: &Env,
    delegator: &Address,
    delegatee: &Address,
) -> Result<(), ContractError> {
    if delegator == delegatee {
        return Ok(());
    }

    if would_create_cycle(env, delegator, delegatee) {
        return Err(ContractError::DelegationCycle);
    }

    let token = token::Client::new(env, &get_voting_token(env)?);
    let balance = token.balance(delegator);

    remove_from_current_delegatee(env, delegator)?;

    if balance > 0 {
        adjust_delegated_weight(env, delegatee, balance)?;
    }
    set_delegation(env, delegator, delegatee);
    events::delegation_set(env, delegator, delegatee, balance);
    Ok(())
}

/// Revokes `delegator`'s active delegation, restoring their direct voting power.
pub fn revoke_delegation(env: &Env, delegator: &Address) -> Result<(), ContractError> {
    let Some(delegatee) = get_delegatee(env, delegator) else {
        return Ok(());
    };

    let token = token::Client::new(env, &get_voting_token(env)?);
    let balance = token.balance(delegator);
    if balance > 0 {
        adjust_delegated_weight(env, &delegatee, -balance)?;
    }
    clear_delegation(env, delegator);
    events::delegation_revoked(env, delegator, &delegatee, balance);
    Ok(())
}

/// Returns the total vote weight for `voter` (own balance + received delegations).
pub fn voting_weight(env: &Env, voter: &Address) -> Result<i128, ContractError> {
    let token = token::Client::new(env, &get_voting_token(env)?);
    let own = token.balance(voter);
    let delegated = get_delegated_weight(env, voter);
    own.checked_add(delegated)
        .ok_or(ContractError::VoteTallyOverflow)
}

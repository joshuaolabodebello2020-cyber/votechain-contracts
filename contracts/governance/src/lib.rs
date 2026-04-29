#![no_std]

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;
#[cfg(test)]
pub mod test_helpers;
#[cfg(test)]
mod prop_tests;

use soroban_sdk::{contract, contractclient, contractimpl, token, Address, Env, String};
use storage::{
    get_admin, get_contract_state, get_last_proposal, get_min_proposal_balance,
    get_proposal_cooldown, get_restrict_admin_vote, get_timelock_duration, get_version,
    get_voter_snapshot, get_voting_token, has_voted, is_initialized, is_paused, load_proposal,
    mark_voted, next_id, save_proposal, save_vote_record, save_voter_snapshot, set_admin,
    set_contract_state, set_last_proposal, set_min_proposal_balance, set_paused,
    set_proposal_cooldown, set_restrict_admin_vote, set_timelock_duration, set_version,
    set_voting_token, get_vote_record,
};
use types::{ContractError, ContractState, DataKey, Proposal, ProposalState, Vote, VoteRecord};

const MAX_TITLE_LEN: u32 = 128;
const MAX_DESC_LEN: u32 = 1024;

// SEC-004: Stellar null/zero address used as the sentinel for invalid inputs.
const ZERO_ADDRESS: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// SEC-004: Rejects the Stellar zero/default address on any address parameter.
fn require_non_zero_address(env: &Env, addr: &Address) -> Result<(), ContractError> {
    if *addr == Address::from_str(env, ZERO_ADDRESS) {
        return Err(ContractError::InvalidAddress);
    }
    Ok(())
}

/// Minimal client for querying the governance token's total supply.
#[contractclient(name = "TokenSupplyClient")]
pub trait TokenSupplyInterface {
    fn total_supply(env: Env) -> i128;
}

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    /// Initialises the governance contract with an admin and a voting token.
    ///
    /// Must be called exactly once before any other function.
    ///
    /// # Parameters
    /// - `min_duration`: minimum allowed voting duration in seconds (e.g., 3600 for 1 hour)
    /// - `max_duration`: maximum allowed voting duration in seconds (e.g., 2592000 for 30 days)
    /// - `restrict_admin_vote`: when `true`, the admin address cannot cast votes on proposals
    ///   they created, preventing a conflict of interest.
    /// - `timelock_duration`: mandatory delay in seconds between a proposal passing and it
    ///   becoming executable. Use `0` to disable the timelock.
    ///
    /// # Errors
    /// - [`ContractError::AlreadyInitialized`] if the contract has already been initialised.
    /// - [`ContractError::InvalidAddress`] if `admin` or `voting_token` is the zero address.
    pub fn initialize(
        env: Env,
        admin: Address,
        voting_token: Address,
        min_proposal_balance: i128,
        proposal_cooldown: u64,
        min_duration: u64,
        max_duration: u64,
        restrict_admin_vote: bool,
        timelock_duration: u64,
    ) -> Result<(), ContractError> {
        // SEC-005: auth is the first operation in every privileged function.
        admin.require_auth();
        // SEC-004: reject zero addresses before any state change.
        require_non_zero_address(&env, &admin)?;
        require_non_zero_address(&env, &voting_token)?;
        if is_initialized(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        set_admin(&env, &admin);
        set_voting_token(&env, &voting_token);
        if min_proposal_balance > 0 {
            set_min_proposal_balance(&env, min_proposal_balance);
        }
        if proposal_cooldown > 0 {
            set_proposal_cooldown(&env, proposal_cooldown);
        }
        set_min_duration(&env, min_duration);
        set_max_duration(&env, max_duration);
        set_restrict_admin_vote(&env, restrict_admin_vote);
        if timelock_duration > 0 {
            set_timelock_duration(&env, timelock_duration);
        }
        set_version(&env, (1, 0, 0));
        set_contract_state(&env, &ContractState::Ready);
        events::contract_initialized(&env, &admin);
        Ok(())
    }

    /// Creates a new governance proposal.
    ///
    /// # Returns
    /// The numeric ID assigned to the new proposal.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `proposer` is the zero address.
    /// - [`ContractError::InvalidTitle`] if `title` is empty or exceeds 256 characters.
    /// - [`ContractError::InvalidDescription`] if `description` is empty or exceeds 4096 characters.
    /// - [`ContractError::InvalidQuorum`] if `quorum` is zero or negative.
    /// - [`ContractError::QuorumExceedsSupply`] if `quorum` exceeds the total token supply.
    /// - [`ContractError::InvalidDurationRange`] if `duration` is outside the configured [min_duration, max_duration] range.
    /// - [`ContractError::InsufficientBalance`] if proposer balance is below minimum.
    /// - [`ContractError::ProposalCooldown`] if proposer is within cooldown period.
    /// - [`ContractError::ProposalCountOverflow`] if the proposal ID counter would overflow.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: String,
        description: String,
        quorum: i128,
        duration: u64,
    ) -> Result<u64, ContractError> {
        // SEC-005: auth first.
        proposer.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &proposer)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }

        // Title: non-empty, max 256 chars
        let title_len = title.len();
        if title_len == 0 || title_len > MAX_TITLE_LEN {
            return Err(ContractError::InvalidTitle);
        }
        // Description: non-empty, max 4096 chars
        let desc_len = description.len();
        if desc_len == 0 || desc_len > MAX_DESC_LEN {
            return Err(ContractError::InvalidDescription);
        }
        // Quorum: > 0
        if quorum <= 0 {
            return Err(ContractError::InvalidQuorum);
        }
        // Duration: zero is explicitly rejected before the range check so callers
        // receive InvalidDuration (not InvalidDurationRange) for the zero case.
        if duration == 0 {
            return Err(ContractError::InvalidDuration);
        }
        // Duration: within [MIN_DURATION, MAX_DURATION]
        if duration < MIN_DURATION || duration > MAX_DURATION {
            return Err(ContractError::InvalidDurationRange);
        }

        let token_client = token::Client::new(&env, &get_voting_token(&env)?);

        // Quorum must not exceed total token supply
        let supply = TokenSupplyClient::new(&env, &get_voting_token(&env)?).total_supply();
        if quorum > supply {
            return Err(ContractError::QuorumExceedsSupply);
        }

        let min_balance = get_min_proposal_balance(&env);
        if min_balance > 0 {
            let balance = token_client.balance(&proposer);
            if balance < min_balance {
                return Err(ContractError::InsufficientBalance);
            }
        }

        let cooldown = get_proposal_cooldown(&env);
        if cooldown > 0 {
            let now = env.ledger().timestamp();
            let last = get_last_proposal(&env, &proposer);
            if last > 0 && now < last + cooldown {
                return Err(ContractError::ProposalCooldown);
            }
        }

        let now = env.ledger().timestamp();
        // SEC-007: ID is generated contract-side only; checked_add prevents overflow.
        let id = next_id(&env)?;
        let proposal = Proposal {
            id,
            proposer: proposer.clone(),
            title,
            description,
            votes_yes: 0,
            votes_no: 0,
            votes_abstain: 0,
            quorum,
            start_time: now,
            end_time: now + duration,
            state: ProposalState::Active,
            execute_after: 0,
        };
        save_proposal(&env, &proposal);
        set_last_proposal(&env, &proposer, now);
        events::proposal_created(&env, id, &proposer);
        Ok(id)
    }

    /// Casts a vote on an active proposal.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `voter` is the zero address.
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    /// - [`ContractError::ProposalNotActive`] if the proposal is not in `Active` status.
    /// - [`ContractError::VotingNotStarted`] if the current ledger timestamp is before `start_time`.
    /// - [`ContractError::VotingPeriodEnded`] if the current ledger timestamp is after `end_time`.
    /// - [`ContractError::AlreadyVoted`] if the voter has already voted on this proposal.
    /// - [`ContractError::NoVotingPower`] if the voter's token balance is zero.
    /// - [`ContractError::VoteTallyOverflow`] if adding the vote weight would overflow `i128`.
    /// - [`ContractError::AdminVoteRestricted`] if `restrict_admin_vote` is enabled and the admin
    ///   attempts to vote on a proposal they created.
    /// - [`ContractError::ContractPaused`] if the contract is paused.
    pub fn cast_vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        vote: Vote,
    ) -> Result<(), ContractError> {
        // SEC-005: auth first.
        voter.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &voter)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }

        let proposal = load_proposal(&env, proposal_id)?;
        if proposal.state != ProposalState::Active {
            return Err(ContractError::ProposalNotActive);
        }

        let now = env.ledger().timestamp();
        if now < proposal.start_time {
            return Err(ContractError::VotingNotStarted);
        }
        if now >= proposal.end_time {
            return Err(ContractError::VotingPeriodEnded);
        }
        if has_voted(&env, proposal_id, &voter) {
            return Err(ContractError::AlreadyVoted);
        }

        if get_restrict_admin_vote(&env) {
            let admin = get_admin(&env)?;
            if voter == admin && proposal.proposer == admin {
                return Err(ContractError::AdminVoteRestricted);
            }
        }

        let token_client = token::Client::new(&env, &get_voting_token(&env)?);
        // Snapshot: capture the voter's balance at vote time and persist it.
        // Using the stored snapshot (rather than re-querying) prevents any
        // balance manipulation after the vote is recorded.
        let weight = match get_voter_snapshot(&env, proposal_id, &voter) {
            Some(w) => w,
            None => {
                let live = token_client.balance(&voter);
                save_voter_snapshot(&env, proposal_id, &voter, live);
                live
            }
        };
        if weight <= 0 {
            return Err(ContractError::NoVotingPower);
        }

        let mut proposal = proposal;
        match vote {
            Vote::Yes => {
                proposal.votes_yes = proposal
                    .votes_yes
                    .checked_add(weight)
                    .ok_or(ContractError::VoteTallyOverflow)?
            }
            Vote::No => {
                proposal.votes_no = proposal
                    .votes_no
                    .checked_add(weight)
                    .ok_or(ContractError::VoteTallyOverflow)?
            }
            Vote::Abstain => {
                proposal.votes_abstain = proposal
                    .votes_abstain
                    .checked_add(weight)
                    .ok_or(ContractError::VoteTallyOverflow)?
            }
        }

        mark_voted(&env, proposal_id, &voter);
        save_vote_record(&env, proposal_id, &voter, &VoteRecord { vote_type: vote.clone(), weight });
        save_proposal(&env, &proposal);
        events::vote_cast(&env, proposal_id, &voter, &vote, weight);
        Ok(())
    }

    /// Returns the vote record (type and weight) for a specific voter on a proposal.
    ///
    /// Returns `None` for non-voters without reverting. Read-only.
    pub fn get_vote(env: Env, proposal_id: u64, voter: Address) -> Option<VoteRecord> {
        get_vote_record(&env, proposal_id, &voter)
    }

    /// Finalises a proposal after its voting period has ended.
    ///
    /// Computes the outcome using the following rules:
    ///
    /// ```text
    /// total_votes = votes_yes + votes_no + votes_abstain
    ///
    /// Passed   if total_votes >= quorum AND votes_yes > votes_no
    /// Rejected otherwise (quorum not met, or votes_yes <= votes_no)
    /// ```
    ///
    /// Abstain votes count toward the quorum threshold but do not influence
    /// the yes/no majority comparison. A tie (`votes_yes == votes_no`) resolves
    /// as Rejected even when quorum is met.
    ///
    /// # Errors
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    /// - [`ContractError::ProposalNotActive`] if the proposal is not in `Active` status.
    /// - [`ContractError::VotingStillOpen`] if the voting window has not yet closed.
    pub fn finalise(env: Env, proposal_id: u64) -> Result<(), ContractError> {
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.state != ProposalState::Active {
            return Err(ContractError::ProposalNotActive);
        }
        let now = env.ledger().timestamp();
        if now <= proposal.end_time {
            return Err(ContractError::VotingStillOpen);
        }

        let total = proposal.votes_yes + proposal.votes_no + proposal.votes_abstain;
        if total >= proposal.quorum && proposal.votes_yes > proposal.votes_no {
            let timelock = get_timelock_duration(&env);
            proposal.execute_after = now + timelock;
            proposal.state = ProposalState::Passed;
        } else {
            proposal.state = ProposalState::Rejected;
        }

        save_proposal(&env, &proposal);
        events::proposal_finalised(&env, proposal_id, &proposal.state, proposal.execute_after);
        Ok(())
    }

    /// Marks a passed proposal as executed. Only the admin may call this.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    /// - [`ContractError::ProposalNotPassed`] if the proposal has not passed.
    pub fn execute(env: Env, admin: Address, proposal_id: u64) -> Result<(), ContractError> {
        // SEC-005: auth first.
        admin.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &admin)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.state != ProposalState::Passed {
            return Err(ContractError::ProposalNotPassed);
        }
        if env.ledger().timestamp() < proposal.execute_after {
            return Err(ContractError::TimelockNotExpired);
        }
        proposal.state = ProposalState::Executed;
        save_proposal(&env, &proposal);
        events::proposal_executed(&env, proposal_id);
        Ok(())
    }

    /// Cancels an active proposal. Only the admin may cancel.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    /// - [`ContractError::ProposalNotActive`] if the proposal is not in `Active` status.
    pub fn cancel(env: Env, admin: Address, proposal_id: u64) -> Result<(), ContractError> {
        // SEC-005: auth first.
        admin.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &admin)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.state != ProposalState::Active {
            return Err(ContractError::ProposalNotActive);
        }
        proposal.state = ProposalState::Cancelled;
        save_proposal(&env, &proposal);
        events::proposal_cancelled(&env, proposal_id);
        Ok(())
    }

    /// Updates the quorum threshold of an active proposal. Only the admin may call this.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    /// - [`ContractError::InvalidQuorum`] if `new_quorum` is zero or negative.
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    /// - [`ContractError::ProposalNotActive`] if the proposal is not in `Active` status.
    pub fn update_quorum(
        env: Env,
        admin: Address,
        proposal_id: u64,
        new_quorum: i128,
    ) -> Result<(), ContractError> {
        // SEC-005: auth first.
        admin.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &admin)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        if new_quorum <= 0 {
            return Err(ContractError::InvalidQuorum);
        }
        let mut proposal = load_proposal(&env, proposal_id)?;
        if proposal.state != ProposalState::Active {
            return Err(ContractError::ProposalNotActive);
        }
        proposal.quorum = new_quorum;
        save_proposal(&env, &proposal);
        events::quorum_updated(&env, proposal_id, new_quorum);
        Ok(())
    }

    /// Transfers admin rights to a new address. Only the current admin may call this.
    ///
    /// The old admin loses all privileges immediately upon successful transfer.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` or `new_admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    pub fn transfer_admin(
        env: Env,
        admin: Address,
        new_admin: Address,
    ) -> Result<(), ContractError> {
        // SEC-005: auth first.
        admin.require_auth();
        // SEC-004: reject zero addresses for both parameters.
        require_non_zero_address(&env, &admin)?;
        require_non_zero_address(&env, &new_admin)?;
        if is_paused(&env) {
            return Err(ContractError::ContractPaused);
        }
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        set_admin(&env, &new_admin);
        events::admin_transferred(&env, &admin, &new_admin);
        Ok(())
    }

    /// Pauses the contract, blocking all state-changing operations.
    ///
    /// Read-only functions (`get_proposal`, `get_vote`, `has_voted`, etc.) remain
    /// available while paused. Only the admin may call this.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    pub fn pause(env: Env, admin: Address) -> Result<(), ContractError> {
        // SEC-005: auth first (already was first; zero check added for SEC-004).
        admin.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &admin)?;
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        set_paused(&env, true);
        events::contract_paused(&env, &admin);
        Ok(())
    }

    /// Unpauses the contract, restoring all state-changing operations.
    ///
    /// Only the admin may call this.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `admin` is the zero address.
    /// - [`ContractError::NotAdmin`] if `admin` does not match the stored admin.
    /// - [`ContractError::NotPaused`] if the contract is not currently paused.
    pub fn unpause(env: Env, admin: Address) -> Result<(), ContractError> {
        // SEC-005: auth first (already was first; zero check added for SEC-004).
        admin.require_auth();
        // SEC-004: reject zero address.
        require_non_zero_address(&env, &admin)?;
        if get_admin(&env)? != admin {
            return Err(ContractError::NotAdmin);
        }
        if !is_paused(&env) {
            return Err(ContractError::NotPaused);
        }
        set_paused(&env, false);
        events::contract_unpaused(&env, &admin);
        Ok(())
    }

    /// Returns whether the contract is currently paused.
    pub fn paused(env: Env) -> bool {
        is_paused(&env)
    }

    /// Returns the full state of a proposal.
    ///
    /// # Errors
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, ContractError> {
        load_proposal(&env, proposal_id)
    }

    /// Returns the total number of proposals ever created.
    pub fn proposal_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0)
    }

    /// Returns whether an address has already voted on a given proposal.
    ///
    /// # Returns
    /// `true` if the address has cast a vote, `false` otherwise.
    ///
    /// # Errors
    /// - [`ContractError::InvalidAddress`] if `voter` is the zero address.
    /// - [`ContractError::ProposalNotFound`] if `proposal_id` does not exist.
    pub fn has_voted(
        env: Env,
        proposal_id: u64,
        voter: Address,
    ) -> Result<bool, ContractError> {
        // SEC-004: reject zero address on read path too.
        require_non_zero_address(&env, &voter)?;
        load_proposal(&env, proposal_id)?;
        Ok(has_voted(&env, proposal_id, &voter))
    }

    /// Returns the contract version as a `(major, minor, patch)` semver tuple.
    pub fn get_version(env: Env) -> (u32, u32, u32) {
        get_version(&env)
    }

    /// Returns the contract lifecycle state.
    ///
    /// - [`ContractState::Uninitialized`]: `initialize` has not yet been called.
    /// - [`ContractState::Ready`]: `initialize` completed successfully; the
    ///   contract is fully operational.
    pub fn get_state(env: Env) -> ContractState {
        get_contract_state(&env)
    }

    /// Lists proposals with offset/limit pagination.
    ///
    /// Returns a vector of proposals starting at the given offset, up to the limit.
    /// Proposals are returned in ascending order by ID.
    ///
    /// # Parameters
    /// - `offset`: number of proposals to skip (0-indexed)
    /// - `limit`: maximum number of proposals to return (capped at 50)
    ///
    /// # Returns
    /// A vector of `Proposal` structs. Returns an empty vector if `offset` exceeds
    /// the total number of proposals.
    ///
    /// # Behavior
    /// - If `limit` exceeds 50, it is capped at 50.
    /// - Proposals are fetched sequentially by ID starting from `offset + 1`.
    /// - If a proposal ID does not exist (gap in sequence), it is skipped.
    pub fn list_proposals(env: Env, offset: u64, limit: u64) -> soroban_sdk::Vec<Proposal> {
        const MAX_LIMIT: u64 = 50;

        let total = env.storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);

        // Return empty vector if offset exceeds total count
        if offset >= total {
            return soroban_sdk::Vec::new(&env);
        }

        // Cap limit at MAX_LIMIT
        let effective_limit = if limit > MAX_LIMIT { MAX_LIMIT } else { limit };

        // Calculate the range of proposal IDs to fetch
        let start_id = offset + 1;
        let end_id = (offset + effective_limit).min(total);

        let mut proposals = soroban_sdk::Vec::new(&env);

        // Iterate through proposal IDs and collect those that exist
        for id in start_id..=end_id {
            if let Ok(proposal) = load_proposal(&env, id) {
                proposals.push_back(proposal);
            }
        }

        proposals
    }
}

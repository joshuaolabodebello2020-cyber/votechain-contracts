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

use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

/// All revert conditions for the governance contract.
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    /// 1 – Admin address is not set
    AdminNotSet = 1,
    /// 2 – Caller is not the admin
    NotAdmin = 2,
    /// 3 – Voting token address is not set
    VotingTokenNotSet = 3,
    /// 4 – Quorum must be greater than zero
    InvalidQuorum = 4,
    /// 5 – Duration must be greater than zero
    InvalidDuration = 5,
    /// 6 – Proposal with the given ID does not exist
    ProposalNotFound = 6,
    /// 7 – Proposal is not in Active status
    ProposalNotActive = 7,
    /// 8 – Voting period has already ended
    VotingPeriodEnded = 8,
    /// 9 – Voting period has not ended yet
    VotingStillOpen = 9,
    /// 10 – Voter has already cast a vote on this proposal
    AlreadyVoted = 10,
    /// 11 – Voter has no token balance (no voting power)
    NoVotingPower = 11,
    /// 12 – Proposal has not passed
    ProposalNotPassed = 12,
    /// 13 – Contract has already been initialized
    AlreadyInitialized = 13,
    /// 14 – Vote tally arithmetic overflow
    VoteTallyOverflow = 14,
    /// 15 – Proposer has insufficient token balance to create a proposal
    InsufficientBalance = 15,
    /// 16 – Proposer must wait for the cooldown period to expire
    ProposalCooldown = 16,
    /// 17 – Proposal title exceeds maximum byte length
    TitleTooLong = 17,
    /// 18 – Proposal description exceeds maximum byte length
    DescriptionTooLong = 18,
    /// 19 – Proposal title is empty or exceeds maximum byte length
    InvalidTitle = 19,
    /// 20 – Proposal description is empty or exceeds maximum byte length
    InvalidDescription = 20,
    /// 21 – Duration is outside the allowed [MIN_DURATION, MAX_DURATION] range
    InvalidDurationRange = 21,
    /// 22 – Quorum exceeds the total token supply
    QuorumExceedsSupply = 22,
    /// 23 – Voting period has not yet started
    VotingNotStarted = 23,
    /// 24 – New admin address is invalid (e.g. zero address)
    InvalidNewAdmin = 24,
    /// 25 – Admin is not permitted to vote on their own proposals
    AdminVoteRestricted = 25,
    /// 26 – Contract is paused; state-changing operations are blocked
    ContractPaused = 26,
    /// 27 – Contract is not paused
    NotPaused = 27,
    /// 28 – Address parameter is the zero/default address
    InvalidAddress = 28,
    /// 29 – Proposal ID counter overflowed (u64::MAX reached)
    ProposalCountOverflow = 29,
    /// 30 – Timelock period has not yet expired
    TimelockNotExpired = 30,
    /// 31 – No pending admin transfer has been proposed
    PendingAdminNotSet = 31,
    /// 32 – The admin transfer window has expired; propose again
    AdminTransferExpired = 32,
    /// 33 – Caller is not the pending admin
    NotPendingAdmin = 33,
    /// 34 – Target version is lower than or equal to the current version (downgrade rejected)
    DowngradeNotAllowed = 34,
    /// 35 – Proposal amendment is not allowed after the amendment window or once voting has started
    ProposalAmendmentNotAllowed = 35,
    /// 36 – Only the original proposer may amend the proposal
    NotProposalOwner = 36,
    /// 37 – Invalid duration configuration (min > max)
    InvalidDurationConfig = 37,
    /// 38 – Invalid veto threshold (must be >= 0 and <= total supply)
    InvalidVetoThreshold = 38,
    /// 39 – Invalid minimum proposal balance (must be >= 0)
    InvalidMinProposalBalance = 39,
    /// 40 – Migration failed (invalid state or preconditions)
    MigrationFailed = 40,
}

/// Lifecycle state of the governance contract itself.
///
/// - `Uninitialized`: the contract has been deployed but `initialize` has not
///   yet been called. No governance operations are possible.
/// - `Ready`: `initialize` completed successfully. The contract is fully
///   operational.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractState {
    Uninitialized,
    Ready,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ProposalState {
    Active,
    Passed,
    Rejected,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Vote {
    Yes,
    No,
    Abstain,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Translation {
    pub title: String,
    pub description: String,
}

/// A governance proposal.
///
/// `metadata_version` identifies the schema version this proposal was created
/// under (#547). Indexers and clients use this field to select the correct
/// deserialization path when the proposal format evolves across contract
/// upgrades. Version 1 is the initial schema; future `migrate()` calls bump
/// the contract-level metadata version so newly created proposals carry the
/// updated version number while old proposals retain their original value.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub votes_yes: i128,
    pub votes_no: i128,
    pub votes_abstain: i128,
    pub quorum: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub state: ProposalState,
    /// Earliest Unix timestamp at which the proposal may be executed.
    /// Set to `end_time + timelock_duration` when the proposal passes; 0 otherwise.
    pub execute_after: u64,
    /// Optional category tags (max 5, each max 32 chars).
    pub tags: Vec<String>,
    /// Schema version for this proposal's metadata (#547).
    /// Allows clients to handle format changes across contract upgrades safely.
    pub metadata_version: u32,
}

/// Storage key enum for the governance contract.
///
/// Every storage entry is keyed by a variant of this enum.  Because Soroban
/// serialises the variant discriminant as part of the XDR key, each variant
/// occupies a completely separate key space — two variants with the same
/// payload can never collide.
#[contracttype]
pub enum DataKey {
    /// Full [`Proposal`] struct, keyed by proposal ID (persistent storage).
    Proposal(u64),

    /// Monotonic counter used to derive the next proposal ID (instance storage).
    ProposalCount,

    /// Boolean flag recording whether `voter` has voted on `proposal_id` (persistent storage).
    HasVoted(u64, Address),

    /// Detailed vote record (vote type + weight) for `voter` on `proposal_id` (persistent storage).
    VoteRecord(u64, Address),

    /// Contract administrator address (instance storage).
    Admin,

    /// Address of the governance token contract (instance storage).
    VotingToken,

    /// Minimum token balance a proposer must hold to create a proposal (instance storage).
    MinProposalBalance,

    /// Minimum seconds a proposer must wait between consecutive proposals (instance storage).
    ProposalCooldown,

    /// Lifecycle state of the governance contract (instance storage).
    ContractState,

    /// Whether admin is restricted from voting on their own proposals (instance storage).
    RestrictAdminVote,

    /// Whether the contract is currently paused (instance storage).
    Paused,

    /// Optional reason string explaining why the contract was paused (instance storage).
    PauseReason,

    /// Timestamp (Unix seconds) of `proposer`'s most recent proposal (persistent storage).
    LastProposal(Address),

    /// Contract version stored as a `(major, minor, patch)` semver tuple (instance storage).
    Version,

    /// Token-balance snapshot for `voter` on `proposal_id`, captured at vote time (persistent storage).
    VoterSnapshot(u64, Address),

    /// Mandatory delay (seconds) between a proposal passing and it becoming executable (instance storage).
    TimelockDuration,

    /// Minimum allowed voting duration in seconds (instance storage).
    MinDuration,

    /// Maximum allowed voting duration in seconds (instance storage).
    MaxDuration,

    /// Absolute vote weight threshold that rejects a proposal immediately when
    /// `votes_no >= veto_threshold`. Stored as instance storage.
    VetoThreshold,

    /// Address nominated to become the next admin (instance storage).
    PendingAdmin,

    /// Unix timestamp after which the pending admin nomination expires (instance storage).
    AdminTransferExpiry,

    /// Amendment window in seconds before voting begins.
    AmendWindow,

    /// TTL bump amount for persistent storage entries (measured in ledgers).
    PersistentStorageTTL,

    /// Multi-sig admin configuration (admins list + threshold) (instance storage).
    MultiSigConfig,

    /// Monotonic counter for multi-sig action IDs (instance storage).
    MultiSigActionCount,

    /// Multi-sig action struct, keyed by action ID (persistent storage).
    MultiSigAction(u64),

    /// Boolean flag: has `approver` approved multi-sig `action_id` (persistent storage).
    MultiSigApproval(u64, Address),

    /// Current metadata schema version for newly created proposals (instance storage).
    /// Bumped by `migrate()` when the proposal data format changes (#547).
    MetadataVersion,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VoteRecord {
    pub vote_type: Vote,
    pub weight: i128,
}

/// Optional governance parameters passed to [`GovernanceContract::initialize`].
#[contracttype]
#[derive(Clone, Debug)]
pub struct GovernanceOptions {
    pub amend_window: u64,
    pub timelock_duration: u64,
    pub veto_threshold: i128,
    pub persistent_storage_ttl: u32,
}

/// Multi-sig admin configuration: a list of admin addresses and an approval threshold.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultiSigConfig {
    pub admins: Vec<Address>,
    pub threshold: u32,
}

/// The type of privileged action that requires multi-sig approval.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MultiSigActionType {
    ExecuteProposal,
    CancelProposal,
    UpdateMultiSig,
    Pause,
    Unpause,
}

/// A pending multi-sig action awaiting threshold approvals.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultiSigAction {
    pub id: u64,
    pub action_type: MultiSigActionType,
    pub proposal_id: u64,
    /// New multi-sig config for `UpdateMultiSig` actions; otherwise empty (`admins` len 0).
    pub new_config: MultiSigConfig,
    pub approvals: u32,
    pub executed: bool,
}

/// Full contract configuration returned by [`get_config`].
#[contracttype]
#[derive(Clone, Debug)]
pub struct GovernanceConfig {
    pub voting_token: Address,
    pub min_proposal_balance: i128,
    pub proposal_cooldown: u64,
    pub min_duration: u64,
    pub max_duration: u64,
    pub restrict_admin_vote: bool,
    pub timelock_duration: u64,
    pub paused: bool,
    pub version: (u32, u32, u32),
    pub persistent_storage_ttl: u32,
}

/// Spam-prevention configuration returned by [`get_spam_config`] (#548).
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpamConfig {
    /// Minimum token balance required to create a proposal (0 = disabled).
    pub min_proposal_balance: i128,
    /// Minimum seconds between consecutive proposals per address (0 = disabled).
    pub proposal_cooldown: u64,
}

// =============================================================================
// Multi-sig types (SC-003)
// =============================================================================

/// Multi-sig admin configuration.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultiSigConfig {
    pub admins: Vec<Address>,
    pub threshold: u32,
}

/// Type of privileged action that requires multi-sig approval.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MultiSigActionType {
    ExecuteProposal,
    CancelProposal,
    UpdateMultiSig,
    Pause,
    Unpause,
}

/// A pending or executed multi-sig action.
#[contracttype]
#[derive(Clone, Debug)]
pub struct MultiSigAction {
    pub id: u64,
    pub action_type: MultiSigActionType,
    pub proposal_id: u64,
    pub new_config: Option<MultiSigConfig>,
    pub approvals: u32,
    pub executed: bool,
}

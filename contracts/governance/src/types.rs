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

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AdminNotSet = 1,
    NotAdmin = 2,
    TokenNotSet = 3,
    BadQuorum = 4,
    BadDuration = 5,
    NotFound = 6,
    NotActive = 7,
    VoteEnded = 8,
    StillOpen = 9,
    AlreadyVoted = 10,
    NoPower = 11,
    NotPassed = 12,
    AlreadyInit = 13,
    Overflow = 14,
    LowBalance = 15,
    Cooldown = 16,
    BadTitle = 17,
    BadDesc = 18,
    BadRange = 19,
    OverSupply = 20,
    NotStarted = 21,
    AdminNoVote = 22,
    Paused = 23,
    NotPaused = 24,
    BadAddress = 25,
    IdOverflow = 26,
    Timelocked = 27,
    NoPending = 28,
    XferExpired = 29,
    NotPending = 30,
    NoDowngrade = 31,
    NoAmend = 32,
    NotOwner = 33,
    BadConfig = 34,
    MigFailed = 35,
    NegTally = 36,
    BadTransition = 37,
    Exists = 38,
    Cycle = 39,
    Delegated = 40,
    NoMultiSig = 41,
    NotMSAdmin = 42,
    NoAction = 43,
    Executed = 44,
    Approved = 45,
    EmptyAdmins = 46,
    BadThreshold = 47,
    BadToken = 48,
    ManyTags = 49,
    LongTag = 50,
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

    /// SC-013: Single composite key per voter per proposal (replaces HasVoted + VoterSnapshot).
    /// Key presence is the deduplication flag; `weight` field stores the balance snapshot.
    /// Before: 3 keys (HasVoted, VoteRecord, VoterSnapshot). After: 1 key (VoteRecord).
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

    /// Delegation from delegator to delegatee (persistent storage).
    Delegation(Address),

    /// Aggregate delegated weight received by a delegatee (persistent storage).
    DelegatedWeight(Address),

    /// Storage TTL bump amount configuration (instance storage).
    StorageBumpAmount,

    /// Storage TTL bump threshold configuration (instance storage).
    StorageBumpThreshold,

    /// Default quorum hint (instance storage).
    QuorumDefault,

    /// Compact metadata summary for a proposal (persistent storage).
    MetadataSummary(u64),
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

/// Compact metadata summary for list-view rendering (issue #485).
#[contracttype]
#[derive(Clone, Debug)]
pub struct ProposalMetadata {
    pub title: String,
    pub description_preview: String,
    pub description_checksum: u32,
    pub description_len: u32,
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
    pub new_config: MultiSigConfig,
    pub approvals: u32,
    pub executed: bool,
}

/// Spam-prevention configuration returned by [`get_spam_config`] (#548).
#[contracttype]
#[derive(Clone, Debug)]
pub struct SpamConfig {
    pub min_proposal_balance: i128,
    pub proposal_cooldown: u64,
}

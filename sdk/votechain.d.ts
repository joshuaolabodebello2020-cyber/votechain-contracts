/**
 * @fileoverview TypeScript type definitions and JSDoc for the VoteChain
 * governance contract JavaScript/TypeScript SDK.
 *
 * Import these types in any TypeScript project that integrates with the
 * VoteChain governance contract on Stellar Soroban.
 *
 * @example
 * ```ts
 * import type { Proposal, Vote, ProposalState } from "./votechain.d.ts";
 * ```
 */

import type { Contract, SorobanRpc, Keypair } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * The three vote choices a token holder may cast on a proposal.
 *
 * Encoded on-chain as `ScvVec([ScvSymbol("Yes")])` etc.
 */
export type Vote = "Yes" | "No" | "Abstain";

/**
 * All possible lifecycle states of a governance proposal.
 *
 * Transitions:
 * ```
 * Active → Passed   → Executed
 *        → Rejected
 *        → Cancelled
 * ```
 */
export type ProposalState =
  | "Active"
  | "Passed"
  | "Rejected"
  | "Executed"
  | "Cancelled";

// ---------------------------------------------------------------------------
// Core data structures
// ---------------------------------------------------------------------------

/**
 * Full on-chain representation of a governance proposal.
 *
 * Returned by {@link GovernanceClient.getProposal}.
 */
export interface Proposal {
  /** Unique monotonic proposal identifier (u64 on-chain). */
  id: bigint;
  /** Stellar address of the account that created the proposal. */
  proposer: string;
  /** Human-readable title (max 128 bytes). */
  title: string;
  /** Human-readable description (max 1 024 bytes). */
  description: string;
  /** Accumulated weight of Yes votes (i128 on-chain). */
  votes_yes: bigint;
  /** Accumulated weight of No votes (i128 on-chain). */
  votes_no: bigint;
  /** Accumulated weight of Abstain votes (i128 on-chain). */
  votes_abstain: bigint;
  /**
   * Minimum total vote weight required for the proposal to pass (i128).
   * Abstain votes count toward this threshold.
   */
  quorum: bigint;
  /** Unix timestamp (seconds) when voting opened. */
  start_time: bigint;
  /** Unix timestamp (seconds) when voting closes. */
  end_time: bigint;
  /** Current lifecycle state. */
  state: ProposalState;
}

/**
 * Immutable record of a single voter's choice and weight on a proposal.
 *
 * Returned by {@link GovernanceClient.getVote}.
 */
export interface VoteRecord {
  /** The choice the voter cast. */
  vote_type: Vote;
  /** Token balance snapshot captured at vote time (i128 on-chain). */
  weight: bigint;
}

/**
 * Semver version tuple returned by {@link GovernanceClient.getVersion}.
 */
export interface ContractVersion {
  major: number;
  minor: number;
  patch: number;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

/**
 * Configuration required to instantiate a {@link GovernanceClient}.
 */
export interface GovernanceClientConfig {
  /** Soroban RPC server instance. */
  server: SorobanRpc.Server;
  /** Bech32m contract address (C…). */
  contractId: string;
  /** Stellar network passphrase. */
  networkPassphrase: string;
  /**
   * Default keypair used to sign and pay for transactions.
   * Can be overridden per-call via the `signer` option.
   */
  signer: Keypair;
}

/**
 * Per-call options that override client-level defaults.
 */
export interface CallOptions {
  /** Override the default signer for this call. */
  signer?: Keypair;
  /** Maximum fee in stroops (default: "100"). */
  fee?: string;
  /** Transaction timeout in seconds (default: 30). */
  timeoutSeconds?: number;
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

/**
 * High-level async client for the VoteChain governance contract.
 *
 * All mutating methods build, simulate, sign, and submit a Soroban
 * transaction, then poll until confirmation.  Read-only methods use
 * `simulateTransaction` and never submit to the network.
 *
 * @example
 * ```ts
 * const client = new GovernanceClient({
 *   server,
 *   contractId: "C...",
 *   networkPassphrase: Networks.TESTNET,
 *   signer: keypair,
 * });
 *
 * const id = await client.createProposal({
 *   proposer: keypair,
 *   title: "Increase treasury allocation",
 *   description: "Allocate 10% more to the dev fund",
 *   quorum: 1000n,
 *   durationSeconds: 604800n,
 * });
 * ```
 */
export interface GovernanceClient {
  // ── Mutating calls ────────────────────────────────────────────────────────

  /**
   * Initialises the governance contract.  Must be called exactly once.
   *
   * @param params.admin - Stellar address of the contract administrator.
   * @param params.votingToken - Contract address of the SEP-41 governance token.
   * @param params.minProposalBalance - Minimum token balance required to create
   *   a proposal (0 = disabled).
   * @param params.proposalCooldown - Seconds a proposer must wait between
   *   consecutive proposals (0 = disabled).
   * @param opts - Optional per-call overrides.
   * @throws If the contract is already initialised.
   */
  initialize(
    params: {
      admin: string;
      votingToken: string;
      minProposalBalance?: bigint;
      proposalCooldown?: bigint;
    },
    opts?: CallOptions
  ): Promise<void>;

  /**
   * Creates a new governance proposal.
   *
   * @param params.proposer - Keypair of the account creating the proposal.
   * @param params.title - Proposal title (1–128 bytes).
   * @param params.description - Proposal description (1–1 024 bytes).
   * @param params.quorum - Minimum total vote weight required to pass.
   * @param params.durationSeconds - Voting window length in seconds (60–2 592 000).
   * @param opts - Optional per-call overrides.
   * @returns The numeric ID assigned to the new proposal.
   * @throws {@link ContractError} `InvalidTitle` | `InvalidDescription` |
   *   `InvalidQuorum` | `InvalidDurationRange` | `InsufficientBalance` |
   *   `ProposalCooldown` | `QuorumExceedsSupply`
   */
  createProposal(
    params: {
      proposer: Keypair;
      title: string;
      description: string;
      quorum: bigint;
      durationSeconds: bigint;
    },
    opts?: CallOptions
  ): Promise<bigint>;

  /**
   * Casts a vote on an active proposal.
   *
   * @param params.voter - Keypair of the voting account.
   * @param params.proposalId - ID of the target proposal.
   * @param params.vote - Vote choice: `"Yes"`, `"No"`, or `"Abstain"`.
   * @param opts - Optional per-call overrides.
   * @throws {@link ContractError} `ProposalNotFound` | `ProposalNotActive` |
   *   `VotingPeriodEnded` | `AlreadyVoted` | `NoVotingPower`
   */
  castVote(
    params: { voter: Keypair; proposalId: bigint; vote: Vote },
    opts?: CallOptions
  ): Promise<void>;

  /**
   * Finalises a proposal after its voting period has ended.
   *
   * Computes the outcome:
   * - **Passed** if `total_votes >= quorum` AND `votes_yes > votes_no`.
   * - **Rejected** otherwise (quorum not met, or tie).
   *
   * @param proposalId - ID of the proposal to finalise.
   * @param opts - Optional per-call overrides.
   * @throws {@link ContractError} `ProposalNotFound` | `ProposalNotActive` |
   *   `VotingStillOpen`
   */
  finalise(proposalId: bigint, opts?: CallOptions): Promise<void>;

  /**
   * Marks a passed proposal as executed.  Admin only.
   *
   * @param params.admin - Keypair of the contract administrator.
   * @param params.proposalId - ID of the passed proposal.
   * @param opts - Optional per-call overrides.
   * @throws {@link ContractError} `NotAdmin` | `ProposalNotFound` |
   *   `ProposalNotPassed`
   */
  execute(
    params: { admin: Keypair; proposalId: bigint },
    opts?: CallOptions
  ): Promise<void>;

  /**
   * Cancels an active proposal.  Admin only.
   *
   * @param params.admin - Keypair of the contract administrator.
   * @param params.proposalId - ID of the active proposal.
   * @param opts - Optional per-call overrides.
   * @throws {@link ContractError} `NotAdmin` | `ProposalNotFound` |
   *   `ProposalNotActive`
   */
  cancel(
    params: { admin: Keypair; proposalId: bigint },
    opts?: CallOptions
  ): Promise<void>;

  // ── Read-only calls ───────────────────────────────────────────────────────

  /**
   * Returns the full state of a proposal.
   *
   * @param proposalId - ID of the proposal to fetch.
   * @returns The {@link Proposal} struct.
   * @throws {@link ContractError} `ProposalNotFound`
   */
  getProposal(proposalId: bigint): Promise<Proposal>;

  /**
   * Returns the vote record for a specific voter on a proposal, or `null`
   * if the voter has not voted.
   *
   * @param proposalId - ID of the proposal.
   * @param voterAddress - Stellar address of the voter.
   */
  getVote(proposalId: bigint, voterAddress: string): Promise<VoteRecord | null>;

  /**
   * Returns whether an address has already voted on a given proposal.
   *
   * @param proposalId - ID of the proposal.
   * @param voterAddress - Stellar address to check.
   */
  hasVoted(proposalId: bigint, voterAddress: string): Promise<boolean>;

  /**
   * Returns the total number of proposals ever created.
   */
  proposalCount(): Promise<bigint>;

  /**
   * Returns the deployed contract version as a semver tuple.
   */
  getVersion(): Promise<ContractVersion>;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Numeric error codes returned by the governance contract.
 *
 * These map 1-to-1 to the `ContractError` enum in the Rust source.
 */
export const ContractErrorCode = {
  AdminNotSet: 1,
  NotAdmin: 2,
  VotingTokenNotSet: 3,
  InvalidQuorum: 4,
  InvalidDuration: 5,
  ProposalNotFound: 6,
  ProposalNotActive: 7,
  VotingPeriodEnded: 8,
  VotingStillOpen: 9,
  AlreadyVoted: 10,
  NoVotingPower: 11,
  ProposalNotPassed: 12,
  AlreadyInitialized: 13,
  VoteTallyOverflow: 14,
  InsufficientBalance: 15,
  ProposalCooldown: 16,
  TitleTooLong: 17,
  DescriptionTooLong: 18,
  InvalidTitle: 19,
  InvalidDescription: 20,
  InvalidDurationRange: 21,
  QuorumExceedsSupply: 22,
} as const;

/** Union of all valid contract error codes. */
export type ContractErrorCode =
  (typeof ContractErrorCode)[keyof typeof ContractErrorCode];

/**
 * Error thrown when the contract returns a non-success result.
 */
export interface ContractError extends Error {
  /** Numeric error code from {@link ContractErrorCode}. */
  code: ContractErrorCode;
}

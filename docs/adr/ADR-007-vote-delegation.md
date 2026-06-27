# ADR-007: Vote Delegation — Deferred (Not Implemented)

**Status:** Rejected  
**Date:** 2026-05-29

## Context

Vote delegation (also called "liquid democracy") allows a token holder to assign their voting power to another address. The delegate votes on the holder's behalf until the delegation is revoked. This pattern is common in ERC-20-based governance systems (e.g., Compound's `delegate()`, OpenZeppelin `ERC20Votes`).

As VoteChain matures, contributors raised the question of whether to add delegation support. The decision affects the token contract, the governance contract, and the vote-weight calculation model established in ADR-002 and ADR-003.

## Options Considered

### Option A — No delegation (current model)

Each voter casts their own vote with weight equal to their live token balance at vote time. Delegation is not supported.

- **Pros:** Simple, auditable, no additional storage or cross-contract calls. Consistent with ADR-002 and ADR-003.
- **Cons:** Token holders who cannot monitor proposals in time cannot participate through a trusted representative.

### Option B — On-chain delegation in the token contract

Add a `delegate(delegatee: Address)` function to the token contract. The governance contract reads the delegatee's accumulated voting power instead of the raw balance.

- **Pros:** Familiar pattern; widely used in EVM governance.
- **Cons:** Requires a delegation registry (persistent storage per holder), complicates the vote-weight calculation, increases contract size and call cost, and introduces a new attack surface (delegation griefing, circular delegation).

### Option C — Off-chain delegation with on-chain proof

Delegation is expressed off-chain (e.g., a signed message). The delegate submits the proof when casting a vote to claim the delegator's weight.

- **Pros:** No additional on-chain storage; flexible.
- **Cons:** Requires a verifiable signature scheme on Soroban, adds complexity to the client, and is harder to audit. Not yet well-supported in the Soroban SDK.

## Decision

**Reject delegation for the current release (Option A retained).**

The added complexity of Options B and C is not justified by the current use cases. VoteChain targets DAOs and protocols where token holders are expected to vote directly. The live-balance model (ADR-003) already prevents the most common delegation-related attack (flash-loan vote amplification).

This decision will be revisited if:
- A concrete user need for delegation is demonstrated by community feedback.
- The Soroban SDK provides native support for signature verification that makes Option C practical.
- A governance upgrade mechanism is in place to safely migrate existing proposals.

## Consequences

- No changes to the token or governance contracts.
- The `cast_vote` function continues to use the caller's live balance as vote weight.
- Delegation remains a documented future consideration; this ADR serves as the record of why it was deferred.
- If delegation is added in a future release, a new ADR must be written to supersede this one.

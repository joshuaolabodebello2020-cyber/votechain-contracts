# Proposal State Transition Documentation

## Overview

This document describes all permitted and forbidden proposal state transitions in the VoteChain governance contract. The state machine is enforced by the `check_proposal_state_transition` function in `lib.rs` to prevent lifecycle bugs.

## Proposal States

| State | Description | Terminal |
|-------|-------------|----------|
| **Active** | Proposal is open for voting and can be modified | No |
| **Passed** | Voting ended, quorum met, yes > no. Awaiting execution. | Terminal (unless executed) |
| **Rejected** | Voting ended but quorum not met or yes <= no | Yes |
| **Executed** | Admin marked the passed proposal as executed | Yes |
| **Cancelled** | Admin cancelled the proposal before voting ended | Yes |

## Permitted State Transitions

### 1. Active → Passed
- **Trigger**: `finalise()` function called after voting period ends
- **Conditions**:
  - Current state must be `Active`
  - Voting period must have ended (`ledger_timestamp > end_time`)
  - Total votes >= quorum
  - votes_yes > votes_no (strict majority)
- **Side Effects**:
  - Sets `execute_after = now + timelock_duration`
  - Emits `proposal_finalised` event
- **Code Location**: `lib.rs:923-953`

### 2. Active → Rejected
- **Trigger**: `finalise()` function called after voting period ends
- **Conditions**:
  - Current state must be `Active`
  - Voting period must have ended
  - Either: total votes < quorum OR votes_yes <= votes_no
- **Side Effects**:
  - Emits `proposal_finalised` event
- **Code Location**: `lib.rs:923-953`

### 3. Active → Rejected (Veto)
- **Trigger**: `cast_vote()` with `Vote::No` when veto threshold is reached
- **Conditions**:
  - Current state must be `Active`
  - votes_no >= veto_threshold (if veto_threshold > 0)
- **Side Effects**:
  - Immediate transition to Rejected
  - Emits `proposal_vetoed` event
- **Code Location**: `lib.rs:642-644`

### 4. Active → Cancelled
- **Trigger**: `cancel()` function called by admin
- **Conditions**:
  - Current state must be `Active`
  - Caller must be admin (or multi-sig admin)
  - Contract must not be paused
- **Side Effects**:
  - Emits `proposal_cancelled` event
- **Code Location**: `lib.rs:998-1022`

### 5. Passed → Executed
- **Trigger**: `execute()` function called by admin
- **Conditions**:
  - Current state must be `Passed`
  - Caller must be admin (or multi-sig admin)
  - Timelock must have expired (`ledger_timestamp >= execute_after`)
  - Contract must not be paused
- **Side Effects**:
  - Emits `proposal_executed` event
- **Code Location**: `lib.rs:962-989`

## Forbidden State Transitions

All transitions not listed above are forbidden and will revert with `ContractError::InvalidProposalStateTransition`:

### From Active
- ❌ Active → Executed (must go through Passed first)
- ❌ Active → Active (no-op, not a transition)

### From Passed
- ❌ Passed → Active (cannot revert to voting)
- ❌ Passed → Rejected (cannot reject after passing)
- ❌ Passed → Cancelled (cannot cancel after passing)
- ❌ Passed → Passed (no-op, not a transition)

### From Rejected
- ❌ Rejected → Active (cannot reopen voting)
- ❌ Rejected → Passed (cannot pass after rejection)
- ❌ Rejected → Executed (cannot execute rejected proposals)
- ❌ Rejected → Cancelled (cannot cancel rejected proposals)
- ❌ Rejected → Rejected (no-op, not a transition)

### From Executed
- ❌ Executed → Active (cannot reopen voting)
- ❌ Executed → Passed (cannot revert execution)
- ❌ Executed → Rejected (cannot reject after execution)
- ❌ Executed → Cancelled (cannot cancel after execution)
- ❌ Executed → Executed (no-op, not a transition)

### From Cancelled
- ❌ Cancelled → Active (cannot reopen voting)
- ❌ Cancelled → Passed (cannot pass cancelled proposals)
- ❌ Cancelled → Rejected (cannot reject cancelled proposals)
- ❌ Cancelled → Executed (cannot execute cancelled proposals)
- ❌ Cancelled → Cancelled (no-op, not a transition)

## State Transition Validation

The `check_proposal_state_transition` function enforces these rules:

```rust
fn check_proposal_state_transition(
    current: &ProposalState,
    next: &ProposalState,
) -> Result<(), ContractError> {
    match (current, next) {
        (ProposalState::Active, ProposalState::Passed)
        | (ProposalState::Active, ProposalState::Rejected)
        | (ProposalState::Active, ProposalState::Cancelled)
        | (ProposalState::Passed, ProposalState::Executed) => Ok(()),
        _ => Err(ContractError::InvalidProposalStateTransition),
    }
}
```

**Code Location**: `lib.rs:111-127`

## Additional State Guards

Beyond the state transition validation, each transition function has additional guards:

### finalise()
- Requires `ProposalNotActive` if not in Active state
- Requires `VotingStillOpen` if called before end_time
- Requires contract not paused

### execute()
- Requires `ProposalNotPassed` if not in Passed state
- Requires `TimelockNotExpired` if called too early
- Requires admin authentication
- Requires contract not paused

### cancel()
- Requires `ProposalNotActive` if not in Active state
- Requires admin authentication
- Requires contract not paused

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐                                               │
│  │  Active  │◄────────────────────────────────────────────┐ │
│  └────┬─────┘                                               │ │
│       │                                                     │ │
│       │ finalise() (quorum met, yes > no)                  │ │
│       │                                                     │ │
│       ▼                                                     │ │
│  ┌──────────┐                                               │ │
│  │  Passed  │                                               │ │
│  └────┬─────┘                                               │ │
│       │                                                     │ │
│       │ execute() (timelock expired)                        │ │
│       │                                                     │ │
│       ▼                                                     │ │
│  ┌──────────┐                                               │ │
│  │ Executed │──────────────────────────────────────────────┘ │
│  └──────────┘                                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐                                │
│  │ Rejected │  │Cancelled │                                │
│  └──────────┘  └──────────┘                                │
│       ▲             ▲                                        │
│       │             │                                        │
│       └─────────────┴──────────────────────────────────────┘
│       finalise() (quorum not met OR yes <= no)
│       OR
│       cast_vote() (veto threshold reached)
│       cancel() (admin only)
│
└─────────────────────────────────────────────────────────────┘
```

## Edge Cases

### Tie Vote (votes_yes == votes_no)
- Resolves as Rejected (requires strict majority)
- Even if quorum is met

### Veto Threshold
- If `votes_no >= veto_threshold`, immediate transition to Rejected
- Happens during voting, not during finalise
- Bypasses normal finalise logic

### Timelock
- Passed proposals cannot be executed until `execute_after` timestamp
- Prevents immediate execution after passing

### Contract Paused
- All state transitions are blocked when contract is paused
- Returns `ContractPaused` error

## Invariant Checks

Before any state transition is saved, the contract validates:

1. **Non-negative vote tallies**: All vote counts must be >= 0
2. **Valid state transition**: Must match permitted transitions
3. **Proposal invariants**: General proposal validity checks

**Code Location**: `lib.rs:129-135`

## Testing Coverage

All state transitions should be tested to prevent regressions:

1. ✅ Active → Passed (with quorum met, yes > no)
2. ✅ Active → Rejected (quorum not met)
3. ✅ Active → Rejected (yes <= no)
4. ✅ Active → Rejected (veto threshold)
5. ✅ Active → Cancelled
6. ✅ Passed → Executed
7. ❌ All forbidden transitions should revert

## Related Files

- `contracts/governance/src/lib.rs` - State transition logic
- `contracts/governance/src/types.rs` - State enum definitions
- `contracts/governance/src/test.rs` - Existing tests
- `contracts/governance/src/e2e_lifecycle_tests.rs` - End-to-end lifecycle tests
- `docs/lifecycle.md` - Lifecycle documentation

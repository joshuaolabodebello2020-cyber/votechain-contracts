# Voting Duration Limits - Technical Reference

## Feature Description

This feature enforces configurable minimum and maximum voting duration limits on the governance contract. Instead of hardcoded constants, duration limits are now:
- Set during contract initialization
- Stored in contract configuration storage
- Updatable by the admin after initialization
- Validated on every proposal creation

## Architecture

### Storage Design

**Instance Storage (Singleton Configuration)**
```
DataKey::MinDuration  → u64 (minimum voting duration in seconds)
DataKey::MaxDuration  → u64 (maximum voting duration in seconds)
```

Both keys are stored in instance storage alongside other singleton configuration values (`Admin`, `VotingToken`, `ProposalCooldown`, etc.). This ensures:
- Efficient access (loaded once per contract invocation)
- Shared TTL with contract instance
- Atomic reads with other config values

**Default Values**
- `MinDuration`: 60 seconds (1 minute) if not explicitly set
- `MaxDuration`: 2,592,000 seconds (30 days) if not explicitly set

### Function Signatures

#### Initialization
```rust
pub fn initialize(
    env: Env,
    admin: Address,
    voting_token: Address,
    min_proposal_balance: i128,
    proposal_cooldown: u64,
    min_duration: u64,           // NEW
    max_duration: u64,           // NEW
    restrict_admin_vote: bool,
) -> Result<(), ContractError>
```

**Parameters:**
- `min_duration`: Minimum allowed voting duration in seconds
  - Example: 3600 (1 hour), 86400 (1 day)
  - Recommended: 3600 or higher to prevent flash voting
- `max_duration`: Maximum allowed voting duration in seconds
  - Example: 604800 (7 days), 2592000 (30 days)
  - Recommended: 604800 to 2592000 for governance stability

**Behavior:**
- Stores both values in instance storage
- Called exactly once during contract deployment
- Reverts with `AlreadyInitialized` if called again

#### Proposal Creation (Updated)
```rust
pub fn create_proposal(
    env: Env,
    proposer: Address,
    title: String,
    description: String,
    quorum: i128,
    duration: u64,
) -> Result<u64, ContractError>
```

**Duration Validation:**
```rust
let min_duration = get_min_duration(&env);
let max_duration = get_max_duration(&env);
if duration < min_duration || duration > max_duration {
    return Err(ContractError::InvalidDurationRange);
}
```

**Error:** `InvalidDurationRange` (error code 21)

#### Update Duration Limits (New)
```rust
pub fn update_duration_limits(
    env: Env,
    admin: Address,
    min_duration: u64,
    max_duration: u64,
) -> Result<(), ContractError>
```

**Access Control:**
- Admin authentication required (`admin.require_auth()`)
- Caller must match stored admin address
- Reverts with `NotAdmin` if caller is not admin

**State Checks:**
- Reverts with `ContractPaused` if contract is paused
- No validation of min/max relationship (allows any values)

**Side Effects:**
- Updates `DataKey::MinDuration` in storage
- Updates `DataKey::MaxDuration` in storage
- Emits `durationupdate` event

**Use Cases:**
- Adjust voting windows based on governance experience
- Respond to network conditions or security concerns
- Tighten constraints for critical proposals
- Relax constraints for routine governance

#### Query Functions (New)
```rust
pub fn min_duration(env: Env) -> u64
pub fn max_duration(env: Env) -> u64
```

**Behavior:**
- Read-only, no authentication required
- Return current stored limits
- Return defaults (60, 2,592,000) if not explicitly set
- Never revert

## Event Schema

### Duration Limits Updated Event
```
Topic 0: "durationupdate" (symbol_short)
Data: (min_duration: u64, max_duration: u64)
```

**Emitted by:** `update_duration_limits()`

**Example:**
```
Event {
  topics: ("durationupdate",),
  data: (3600, 604800)  // 1 hour min, 7 days max
}
```

## Error Handling

### InvalidDurationRange (Error Code 21)
**Triggered when:**
- `duration < min_duration` in `create_proposal()`
- `duration > max_duration` in `create_proposal()`

**Message:** "Duration is outside the allowed [MIN_DURATION, MAX_DURATION] range"

**Recovery:**
- Proposer must retry with duration within [min_duration, max_duration]
- Query `min_duration()` and `max_duration()` to determine valid range

### NotAdmin (Error Code 2)
**Triggered when:**
- Non-admin calls `update_duration_limits()`

**Recovery:**
- Only admin can update limits
- Contact governance admin to make changes

### ContractPaused (Error Code 26)
**Triggered when:**
- `update_duration_limits()` called while contract is paused

**Recovery:**
- Admin must unpause contract first
- Then call `update_duration_limits()`

## Usage Examples

### Initialization with 1-Hour Minimum, 30-Day Maximum
```rust
GovernanceContract::initialize(
    env,
    admin_address,
    token_address,
    min_proposal_balance: 1000,
    proposal_cooldown: 86400,      // 1 day
    min_duration: 3600,            // 1 hour
    max_duration: 2_592_000,       // 30 days
    restrict_admin_vote: true,
)?;
```

### Creating a 7-Day Proposal
```rust
let proposal_id = GovernanceContract::create_proposal(
    env,
    proposer,
    "Increase Treasury Allocation".into(),
    "Proposal to increase treasury allocation by 10%".into(),
    quorum: 1_000_000,
    duration: 604_800,  // 7 days (within 1 hour - 30 days range)
)?;
```

### Updating Limits to 2-Hour Minimum, 14-Day Maximum
```rust
GovernanceContract::update_duration_limits(
    env,
    admin,
    min_duration: 7200,      // 2 hours
    max_duration: 1_209_600, // 14 days
)?;
```

### Querying Current Limits
```rust
let min = GovernanceContract::min_duration(env);  // Returns 7200
let max = GovernanceContract::max_duration(env);  // Returns 1_209_600
```

## Validation Rules

### Duration Validation in create_proposal()
```
Valid if: min_duration ≤ duration ≤ max_duration
Invalid if: duration < min_duration OR duration > max_duration
Error: InvalidDurationRange
```

### Boundary Conditions
- **Minimum boundary:** Inclusive (duration == min_duration is valid)
- **Maximum boundary:** Inclusive (duration == max_duration is valid)
- **Zero duration:** Invalid (must be ≥ min_duration)
- **Overflow:** Not checked (u64 max is ~584 billion seconds ≈ 18,500 years)

## Storage Efficiency

### Instance Storage Impact
- **MinDuration:** 8 bytes (u64)
- **MaxDuration:** 8 bytes (u64)
- **Total:** 16 bytes per contract instance

### Access Pattern
- Read on every `create_proposal()` call
- Write on `initialize()` and `update_duration_limits()`
- Cached with contract instance (efficient)

## Security Considerations

### Admin Privilege
- Only admin can update duration limits
- No time-lock or multi-sig protection (consider adding if needed)
- Updates take effect immediately

### Constraint Relaxation
- Admin can set `min_duration = 0` (allows flash voting)
- Admin can set `max_duration` very high (allows indefinite voting)
- No validation of min ≤ max relationship
- **Recommendation:** Implement governance checks or multi-sig for limit updates

### Existing Proposals
- Duration limits only apply to new proposals
- Existing active proposals retain their original duration
- Finalizing a proposal uses its stored `end_time` (not current limits)

## Migration Guide

### For Existing Deployments
If upgrading from hardcoded constants to configurable limits:

1. **Determine desired limits:**
   - Minimum: 3600 (1 hour) or higher
   - Maximum: 604800 (7 days) to 2592000 (30 days)

2. **Update initialization call:**
   ```rust
   // Old
   initialize(env, admin, token, min_balance, cooldown, restrict_admin)
   
   // New
   initialize(env, admin, token, min_balance, cooldown, 3600, 2592000, restrict_admin)
   ```

3. **Test thoroughly:**
   - Verify limits are stored correctly
   - Test proposal creation with various durations
   - Verify error handling for out-of-range durations

4. **Deploy and verify:**
   - Query `min_duration()` and `max_duration()` to confirm
   - Create test proposals to validate behavior

## Testing Checklist

- [ ] Initialize with various min/max duration values
- [ ] Create proposals with duration == min_duration (boundary)
- [ ] Create proposals with duration == max_duration (boundary)
- [ ] Reject proposals with duration < min_duration
- [ ] Reject proposals with duration > max_duration
- [ ] Update limits as admin
- [ ] Verify non-admin cannot update limits
- [ ] Verify update_duration_limits respects pause state
- [ ] Query min_duration() and max_duration()
- [ ] Verify event emission on update
- [ ] Test with edge cases (0, u64::MAX, etc.)
- [ ] Verify existing proposals unaffected by limit changes

## Performance Impact

- **Initialization:** +2 storage writes (negligible)
- **Proposal Creation:** +2 storage reads (already reading other config)
- **Update Limits:** +2 storage writes + 1 event (admin operation, infrequent)
- **Query:** +2 storage reads (read-only, no writes)

**Overall:** Minimal performance impact due to instance storage caching.

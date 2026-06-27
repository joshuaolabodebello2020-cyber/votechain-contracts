# Voting Duration Limits - Integration Guide

## Quick Start

### 1. Update Your Initialization Code

**Before:**
```rust
let result = client.initialize(
    &admin,
    &token_address,
    &1000,           // min_proposal_balance
    &86400,          // proposal_cooldown (1 day)
    &true,           // restrict_admin_vote
);
```

**After:**
```rust
let result = client.initialize(
    &admin,
    &token_address,
    &1000,           // min_proposal_balance
    &86400,          // proposal_cooldown (1 day)
    &3600,           // min_duration (1 hour) - NEW
    &2_592_000,      // max_duration (30 days) - NEW
    &true,           // restrict_admin_vote
);
```

### 2. Recommended Duration Values

**Conservative (Strict Governance):**
```rust
min_duration: 86400,      // 1 day minimum
max_duration: 604800,     // 7 days maximum
```

**Moderate (Balanced):**
```rust
min_duration: 3600,       // 1 hour minimum
max_duration: 2_592_000,  // 30 days maximum
```

**Permissive (Flexible):**
```rust
min_duration: 300,        // 5 minutes minimum
max_duration: 7_776_000,  // 90 days maximum
```

### 3. Query Current Limits

```rust
let min = client.min_duration();
let max = client.max_duration();
println!("Voting duration range: {} to {} seconds", min, max);
```

### 4. Update Limits (Admin Only)

```rust
let result = client.update_duration_limits(
    &admin,
    &7200,        // new min_duration (2 hours)
    &1_209_600,   // new max_duration (14 days)
);
```

## Common Scenarios

### Scenario 1: Emergency Governance (Fast Voting)

**Use Case:** Critical security issue requires rapid response

**Configuration:**
```rust
min_duration: 300,        // 5 minutes
max_duration: 3600,       // 1 hour
```

**Implementation:**
```rust
// Admin updates limits for emergency
client.update_duration_limits(&admin, &300, &3600)?;

// Proposer creates urgent proposal
let proposal_id = client.create_proposal(
    &proposer,
    "Emergency: Pause Token Transfers".into(),
    "Critical vulnerability detected. Pause all transfers immediately.".into(),
    &quorum,
    &1800,  // 30 minutes (within 5 min - 1 hour range)
)?;

// After emergency resolved, restore normal limits
client.update_duration_limits(&admin, &3600, &2_592_000)?;
```

### Scenario 2: Routine Governance (Standard Voting)

**Use Case:** Regular governance operations with balanced timing

**Configuration:**
```rust
min_duration: 3600,       // 1 hour (prevents flash voting)
max_duration: 604800,     // 7 days (reasonable deliberation)
```

**Implementation:**
```rust
// Initialize with standard limits
client.initialize(
    &admin,
    &token,
    &1000,
    &86400,
    &3600,      // 1 hour minimum
    &604800,    // 7 days maximum
    &true,
)?;

// Proposers create proposals with various durations
let short_proposal = client.create_proposal(
    &proposer,
    "Approve Budget".into(),
    "Approve Q4 budget allocation".into(),
    &quorum,
    &86400,  // 1 day (within range)
)?;

let long_proposal = client.create_proposal(
    &proposer,
    "Major Protocol Change".into(),
    "Implement new voting mechanism".into(),
    &quorum,
    &604800,  // 7 days (within range)
)?;
```

### Scenario 3: Adaptive Governance (Seasonal Adjustments)

**Use Case:** Adjust voting windows based on governance maturity

**Phase 1: Bootstrap (Tight Constraints)**
```rust
min_duration: 3600,       // 1 hour
max_duration: 86400,      // 1 day
```

**Phase 2: Growth (Moderate Constraints)**
```rust
min_duration: 3600,       // 1 hour
max_duration: 604800,     // 7 days
```

**Phase 3: Mature (Flexible Constraints)**
```rust
min_duration: 1800,       // 30 minutes
max_duration: 2_592_000,  // 30 days
```

**Implementation:**
```rust
// Phase 1: Initialize with tight constraints
client.initialize(&admin, &token, &1000, &86400, &3600, &86400, &true)?;

// After 3 months, transition to Phase 2
client.update_duration_limits(&admin, &3600, &604800)?;

// After 1 year, transition to Phase 3
client.update_duration_limits(&admin, &1800, &2_592_000)?;
```

## Error Handling

### Handling InvalidDurationRange

```rust
match client.create_proposal(&proposer, title, desc, quorum, duration) {
    Ok(proposal_id) => println!("Proposal created: {}", proposal_id),
    Err(ContractError::InvalidDurationRange) => {
        let min = client.min_duration();
        let max = client.max_duration();
        eprintln!(
            "Duration {} is outside valid range [{}, {}]",
            duration, min, max
        );
        eprintln!("Please choose a duration between {} and {} seconds", min, max);
    }
    Err(e) => eprintln!("Error: {:?}", e),
}
```

### Handling NotAdmin on Update

```rust
match client.update_duration_limits(&caller, &new_min, &new_max) {
    Ok(_) => println!("Duration limits updated"),
    Err(ContractError::NotAdmin) => {
        eprintln!("Only the admin can update duration limits");
        eprintln!("Current admin: {}", client.get_admin());
    }
    Err(e) => eprintln!("Error: {:?}", e),
}
```

### Handling ContractPaused

```rust
match client.update_duration_limits(&admin, &new_min, &new_max) {
    Ok(_) => println!("Duration limits updated"),
    Err(ContractError::ContractPaused) => {
        eprintln!("Contract is paused. Unpause first.");
        client.unpause(&admin)?;
        client.update_duration_limits(&admin, &new_min, &new_max)?;
    }
    Err(e) => eprintln!("Error: {:?}", e),
}
```

## Testing Examples

### Unit Test: Duration Validation

```rust
#[test]
fn test_duration_validation() {
    let env = Env::default();
    let admin = Address::random(&env);
    let token = Address::random(&env);
    
    // Initialize with 1 hour min, 7 days max
    GovernanceContract::initialize(
        env.clone(),
        admin.clone(),
        token.clone(),
        0,
        0,
        3600,      // 1 hour
        604800,    // 7 days
        false,
    ).unwrap();
    
    let proposer = Address::random(&env);
    
    // Valid: exactly at minimum
    let result = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Test".into(),
        "Test".into(),
        1000,
        3600,  // exactly min_duration
    );
    assert!(result.is_ok());
    
    // Valid: exactly at maximum
    let result = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Test".into(),
        "Test".into(),
        1000,
        604800,  // exactly max_duration
    );
    assert!(result.is_ok());
    
    // Invalid: below minimum
    let result = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Test".into(),
        "Test".into(),
        1000,
        1800,  // below min_duration
    );
    assert_eq!(result, Err(ContractError::InvalidDurationRange));
    
    // Invalid: above maximum
    let result = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Test".into(),
        "Test".into(),
        1000,
        1_209_600,  // above max_duration
    );
    assert_eq!(result, Err(ContractError::InvalidDurationRange));
}
```

### Unit Test: Update Duration Limits

```rust
#[test]
fn test_update_duration_limits() {
    let env = Env::default();
    let admin = Address::random(&env);
    let token = Address::random(&env);
    
    // Initialize
    GovernanceContract::initialize(
        env.clone(),
        admin.clone(),
        token.clone(),
        0,
        0,
        3600,
        604800,
        false,
    ).unwrap();
    
    // Verify initial limits
    assert_eq!(GovernanceContract::min_duration(env.clone()), 3600);
    assert_eq!(GovernanceContract::max_duration(env.clone()), 604800);
    
    // Update limits
    GovernanceContract::update_duration_limits(
        env.clone(),
        admin.clone(),
        7200,        // 2 hours
        1_209_600,   // 14 days
    ).unwrap();
    
    // Verify updated limits
    assert_eq!(GovernanceContract::min_duration(env.clone()), 7200);
    assert_eq!(GovernanceContract::max_duration(env.clone()), 1_209_600);
    
    // Non-admin cannot update
    let non_admin = Address::random(&env);
    let result = GovernanceContract::update_duration_limits(
        env.clone(),
        non_admin,
        3600,
        604800,
    );
    assert_eq!(result, Err(ContractError::NotAdmin));
}
```

### Integration Test: Full Workflow

```rust
#[test]
fn test_full_governance_workflow_with_duration_limits() {
    let env = Env::default();
    let admin = Address::random(&env);
    let token = Address::random(&env);
    let proposer = Address::random(&env);
    let voter = Address::random(&env);
    
    // 1. Initialize with duration limits
    GovernanceContract::initialize(
        env.clone(),
        admin.clone(),
        token.clone(),
        0,
        0,
        3600,      // 1 hour minimum
        604800,    // 7 days maximum
        false,
    ).unwrap();
    
    // 2. Create proposal with valid duration
    let proposal_id = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Test Proposal".into(),
        "A test proposal".into(),
        1000,
        86400,  // 1 day (within 1 hour - 7 days)
    ).unwrap();
    
    // 3. Verify proposal was created
    let proposal = GovernanceContract::get_proposal(env.clone(), proposal_id).unwrap();
    assert_eq!(proposal.id, proposal_id);
    assert_eq!(proposal.state, ProposalState::Active);
    
    // 4. Admin updates duration limits
    GovernanceContract::update_duration_limits(
        env.clone(),
        admin.clone(),
        7200,        // 2 hours
        1_209_600,   // 14 days
    ).unwrap();
    
    // 5. Create another proposal with new limits
    let proposal_id_2 = GovernanceContract::create_proposal(
        env.clone(),
        proposer.clone(),
        "Another Proposal".into(),
        "Another test proposal".into(),
        1000,
        604800,  // 7 days (within 2 hours - 14 days)
    ).unwrap();
    
    // 6. Verify both proposals exist
    assert_eq!(GovernanceContract::proposal_count(env.clone()), 2);
}
```

## Deployment Checklist

- [ ] Review and approve min/max duration values
- [ ] Update initialization code with new parameters
- [ ] Test with various duration values
- [ ] Verify error handling for out-of-range durations
- [ ] Test admin update_duration_limits function
- [ ] Verify event emission on updates
- [ ] Document chosen duration limits for governance
- [ ] Create runbook for emergency limit adjustments
- [ ] Train governance participants on new limits
- [ ] Deploy to testnet and verify
- [ ] Deploy to mainnet with monitoring

## Monitoring & Observability

### Events to Monitor

```
Event: durationupdate
Topics: ("durationupdate",)
Data: (min_duration: u64, max_duration: u64)

Action: Alert governance team when limits change
```

### Metrics to Track

- Proposal creation rate by duration
- Distribution of chosen durations
- Frequency of limit updates
- Proposals rejected due to invalid duration

### Queries to Run

```rust
// Check current limits
let min = client.min_duration();
let max = client.max_duration();

// Verify proposal duration is valid
let proposal = client.get_proposal(proposal_id)?;
let is_valid = proposal.end_time - proposal.start_time >= min
    && proposal.end_time - proposal.start_time <= max;
```

## Troubleshooting

### Problem: Proposal Creation Fails with InvalidDurationRange

**Solution:**
1. Query current limits: `client.min_duration()` and `client.max_duration()`
2. Adjust proposal duration to be within [min, max]
3. Retry proposal creation

### Problem: Cannot Update Duration Limits

**Possible Causes:**
- Caller is not admin → Use admin address
- Contract is paused → Call `unpause()` first
- Contract not initialized → Call `initialize()` first

**Solution:**
1. Verify caller is admin: `client.get_admin()`
2. Check if paused: `client.paused()`
3. Unpause if needed: `client.unpause(&admin)`
4. Retry update

### Problem: Existing Proposals Affected by Limit Changes

**Note:** Duration limits only apply to NEW proposals. Existing proposals retain their original duration and are unaffected by limit updates.

**Verification:**
```rust
let proposal = client.get_proposal(proposal_id)?;
let duration = proposal.end_time - proposal.start_time;
// This duration is fixed and won't change even if limits are updated
```

## Support & Questions

For issues or questions about the voting duration limits feature:
1. Check this integration guide
2. Review DURATION_LIMITS_TECHNICAL_REFERENCE.md
3. Check IMPLEMENTATION_SUMMARY.md for architecture details
4. Review test examples for usage patterns

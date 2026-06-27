# Upgrade and Migration Strategy

This document defines how VoteChain smart contracts are upgraded and how state migrations are handled for future versions.

## 1. Upgrade Strategy

### 1.1 Upgrade Mechanism

VoteChain uses Soroban's built-in contract upgrade mechanism. The contract admin can upgrade the contract by deploying a new WASM file and invoking the upgrade function.

### 1.2 Upgrade Process

1. **Build New Contract Version**:
   - Ensure all tests pass
   - Bump contract version in `lib.rs` (see `set_version` call)
   - Build optimized WASM

2. **Deploy New WASM**:
   - Deploy the new WASM file to the Stellar network
   - Obtain the new contract code hash/address

3. **Upgrade Contract**:
   - The contract admin calls the Soroban upgrade function to replace the contract code
   - After upgrade, the new code is active but state remains intact
   - A `contract_upgraded` event is emitted (see `events.rs`)

4. **Run Migration (if needed)**:
   - If state changes are required, call the `migrate()` function (admin-only)
   - This will perform any necessary data transformations and update the contract version
   - A `migration_completed` event is emitted

### 1.3 Upgrade Permissions

- Only the contract admin can perform upgrades
- Admin rotation uses the two-step transfer mechanism (see `propose_admin_transfer` and `accept_admin_transfer`)

## 2. Migration Patterns

### 2.1 Versioning

- Contract versions are stored as a `(major, minor, patch)` tuple in instance storage under `DataKey::Version`
- Versions follow Semantic Versioning (SemVer) guidelines

### 2.2 Migration Function (`migrate()`)

The `migrate()` function in `lib.rs` handles state migrations. Key features:
- **Admin-only**: Only the contract admin can trigger migrations
- **Idempotent**: Safe to call multiple times (skips if already at or above target version)
- **Atomic**: Migrations either complete fully or fail without partial changes

#### Migration Structure

```rust
pub fn migrate(env: Env, admin: Address) -> Result<(), ContractError> {
    // 1. Auth and validation
    admin.require_auth();
    require_non_zero_address(&env, &admin)?;
    if get_admin(&env)? != admin {
        return Err(ContractError::NotAdmin);
    }

    // 2. Check current version
    let old_version = get_version(&env);
    if old_version >= (TARGET_MAJOR, TARGET_MINOR, TARGET_PATCH) {
        return Ok(());
    }

    // 3. Validate preconditions (e.g., ensure contract is initialized)
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(ContractError::MigrationFailed);
    }

    // 4. Perform version-specific migrations
    if old_version < (2, 0, 0) {
        // v1 -> v2 migration logic here
    }

    // 5. Bump version and emit event
    set_version(&env, (TARGET_MAJOR, TARGET_MINOR, TARGET_PATCH));
    events::migration_completed(&env, old_version, (TARGET_MAJOR, TARGET_MINOR, TARGET_PATCH));
    Ok(())
}
```

### 2.3 State Migration Best Practices

1. **Backward Compatibility**:
   - New contract versions must be able to read old state
   - Use optional fields or default values for new storage entries

2. **Storage Key Stability**:
   - Avoid renaming existing `DataKey` enum variants
   - If renaming is necessary, add a migration step to copy data from old key to new key

3. **Data Validation**:
   - Always validate existing state before migrating
   - Use `env.storage().has()` to check for existing entries

4. **Event Logging**:
   - Emit events for all migrations (already implemented)
   - Include old and new versions in events

## 3. Migration Validation Tests

### 3.1 Test Framework

- Unit tests in `test.rs`
- Integration tests in `integration_tests.rs`
- Property tests in `prop_tests.rs`

### 3.2 Example Migration Test

```rust
#[test]
fn test_migrate_v1_to_v2() {
    let env = Env::default();
    let gov_id = env.register(GovernanceContract, ());
    let client = GovernanceContractClient::new(&env, &gov_id);

    // 1. Initialize with old version (e.g., v1)
    let admin = Address::generate(&env);
    let token_id = setup_token(&env, &admin);
    client.initialize(
        &admin, &token_id, &0, &0, &60, &2_592_000, &false, &0, &0, &0,
    );

    // 2. Simulate old state (if needed)

    // 3. Run migration
    client.migrate(&admin);

    // 4. Verify new version and state
    assert_eq!(client.get_version(), (2, 0, 0));
    // Verify migrated data
}
```

## 4. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Upgrade breaks contract functionality** | - Extensive testing before upgrade<br>- Rollback plan (keep old WASM available)<br>- Use staging/testnet for validation |
| **Migration fails mid-execution** | - Make migrations idempotent<br>- Test migrations thoroughly<br>- Have a recovery plan |
| **State corruption during migration** | - Validate all preconditions<br>- Use atomic operations<br>- Test migrations on testnet first |
| **Admin key compromise** | - Use multi-sig for admin (if available)<br>- Two-step admin transfer<br>- Limit admin exposure |

## 5. Example: v1 → v2 Migration

The current `migrate()` function is a placeholder for future migrations. When implementing a real migration:

1. Update the target version in `migrate()`
2. Add your migration logic between version checks
3. Test thoroughly
4. Document all changes in CHANGELOG.md

## 6. Deployment Checklist

Before upgrading a production contract:
- [ ] All unit/integration tests pass
- [ ] Migration tested on testnet
- [ ] Rollback plan documented
- [ ] Admin key secured
- [ ] Contract code audited (for critical changes)
- [ ] Stakeholders notified

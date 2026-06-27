# High-Risk Security Threats Tracking

This document tracks high-risk threats identified during the STRIDE threat modeling session for the VoteChain Token Contract (#314 SEC-012).

## Critical Risk Threats

### [SEC-012-T1] Balance Tampering
- **Description**: Attacker attempts to modify token balances in storage to award themselves tokens.
- **Status**: OPEN
- **Mitigation Plan**:
    - [x] Use Stellar's tamper-proof ledger storage.
    - [x] Restrict minting to authorized admins.
    - [ ] Implement multi-sig requirement for all balance-modifying admin operations.
    - [ ] Add circuit breaker for large mint operations.

### [SEC-012-T2] Snapshot Tampering
- **Description**: Attacker modifies historical balance snapshots to manipulate vote tallies.
- **Status**: MITIGATED
- **Mitigation Plan**:
    - [x] Snapshots are immutable after creation at a specific block height.
    - [x] Read-only access enforced by contract logic.
    - [ ] Add snapshot integrity verification tool for off-chain auditing.

### [SEC-012-A3] Unauthorized Minting
- **Description**: Non-admin account successfully calls the mint operation.
- **Status**: OPEN
- **Mitigation Plan**:
    - [x] Strict `require_auth()` check for admin on `mint` function.
    - [ ] Implement rate limiting on minting operations (max tokens per hour/day).
    - [ ] Implement multi-sig for minting approvals.

### [SEC-012-A5] Unauthorized Admin Changes
- **Description**: Attacker gains admin control by calling `set_admin` without authorization.
- **Status**: OPEN
- **Mitigation Plan**:
    - [x] Current admin must authorize `set_admin` call.
    - [ ] Implement admin rotation schedule.
    - [ ] Use multi-sig for admin privilege transfers.

### [SEC-012-I2] Admin Key Exposure
- **Description**: The private key of an admin account is compromised.
- **Status**: IN PROGRESS
- **Mitigation Plan**:
    - [x] Document key management best practices.
    - [ ] Implement mandatory multi-sig for all admin accounts.
    - [ ] Regular key rotation (see SEC-006).

## High Risk Threats

### [SEC-012-A2] Weak Permission Model
- **Description**: Overly broad permissions lead to accidental or malicious misuse.
- **Status**: OPEN
- **Mitigation Plan**:
    - [ ] Implement Role-Based Access Control (RBAC) if more roles are added.
    - [ ] Explicitly document the permission matrix for all operations.

### [SEC-012-A4] Unauthorized Burning
- **Description**: tokens are burned from an account without the owner's consent.
- **Status**: MITIGATED
- **Mitigation Plan**:
    - [x] Burn operation requires authorization from either the owner or a designated admin with specific burn rights.
    - [x] All burn events are emitted and traceable.

---
*This document is part of the security audit process and should be reviewed during each release cycle.*

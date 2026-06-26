# Security Audit Results and Mitigation Guide

## Overview

| Field | Value |
|-------|-------|
| Audit Firm | OtterSec |
| Engagement | SEC-001 |
| Scope | v0.1.1 |
| Period | 2026-05-01 – 2026-05-20 |
| Status | All critical/high findings remediated |

---

## Findings Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| OTT-001 | High | Vote weight recycling via token transfer | ✅ Remediated |
| OTT-002 | Medium | Quorum can be set to 1 by any proposer | Accepted (KI-005) |
| OTT-003 | Low | Single admin is a single point of trust | Accepted (KI-002) |
| OTT-004 | Informational | `unwrap_or` defaults in storage helpers | Accepted (KI-004) |

---

## Finding Details

### OTT-001 — Vote Weight Recycling via Token Transfer

- **Severity:** High
- **Component:** Governance Contract (`cast_vote`)
- **Status:** ✅ Remediated

**Description:**  
A voter could transfer tokens to a second address after voting, allowing the second address to cast an additional vote with the same tokens. Because vote weight was read from the live token balance at vote time without any transfer lock, the same economic stake could influence the outcome more than once within a single proposal.

**Mitigation:**  
Vote weight is now captured and stored immutably at the moment `cast_vote` is called (`VoterSnapshot` in persistent storage). Subsequent transfers do not affect the recorded weight, and each address may vote at most once per proposal (`HasVoted` guard). See `SEC-010-reentrancy-cast-vote.md` and `SEC-008-token-balance-fetch-audit.md` for implementation details.

---

### OTT-002 — Quorum Can Be Set to 1 by Any Proposer

- **Severity:** Medium
- **Component:** Governance Contract (`create_proposal`)
- **Status:** Accepted (KI-005)

**Description:**  
The `quorum` parameter in `create_proposal` is supplied by the proposer and validated only to be `> 0` and `<= total_supply`. A proposer can therefore set quorum to `1`, meaning a single token vote is sufficient to pass a proposal regardless of actual participation.

**Rationale for Acceptance:**  
Enforcing a minimum quorum floor at the contract level would remove flexibility needed by governance communities with varying total supplies. The risk is mitigated operationally: admins can call `update_quorum` to raise the threshold on active proposals, and monitoring tooling can alert on suspiciously low quorum values. A configurable minimum quorum floor is planned for v0.2.0.

---

### OTT-003 — Single Admin Is a Single Point of Trust

- **Severity:** Low
- **Component:** Governance Contract, Token Contract (`initialize`, `transfer_admin`)
- **Status:** Accepted (KI-002)

**Description:**  
Both contracts are controlled by a single admin address. If that key is compromised, an attacker can cancel proposals, execute passed proposals without valid governance, mint or burn tokens, and transfer admin rights.

**Rationale for Acceptance:**  
Single-key admin is the standard bootstrapping pattern on Soroban. The risk is mitigated by deploying behind a multi-sig wallet in production (see recommended mitigations below). Native multi-sig admin support is tracked in the roadmap.

---

### OTT-004 — `unwrap_or` Defaults in Storage Helpers

- **Severity:** Informational
- **Component:** Governance Contract, Token Contract (`storage.rs`)
- **Status:** Accepted (KI-004)

**Description:**  
Several storage accessors use `unwrap_or(default)` to return a zero or false value when a key is absent rather than returning an error. In practice this is intentional and safe (absent balance → 0, absent flag → false), but it silently masks uninitialized-contract calls that would otherwise fail loudly.

**Rationale for Acceptance:**  
The initialization guard (`ContractState` check on all entry points) ensures state-changing operations cannot proceed against an uninitialized contract. The `unwrap_or` pattern is therefore safe at the current call sites. Explicit `NotFound` errors on the public read functions would improve observability but are deferred to avoid a breaking API change.

---

## Dependency Audit

```
cargo audit result (run: 2026-04-23)

Crates scanned: 183
Vulnerabilities found: 0
Warnings: 0
```

All direct and transitive dependencies were free of known advisories as of the audit date. Re-run `cargo audit` before each release to check for new advisories.

---

## Known Risks

Full details are in [`docs/security/known-issues.md`](known-issues.md). The table below summarises KI-001 through KI-005.

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| KI-001 | Medium | Flash-loan / transfer-then-vote attack | Mitigated (vote weight snapshot) |
| KI-002 | Low | Single admin key is a single point of failure | Accepted |
| KI-003 | Low | Voting period is immutable after creation | Accepted (by design) |
| KI-004 | Informational | `unwrap_or` defaults in storage helpers | Accepted |
| KI-005 | Medium | Proposer can set arbitrarily low quorum | Accepted |

---

## Recommended Mitigations for Accepted Risks

**KI-001 — Vote weight recycling (flash-loan / transfer-then-vote)**  
- Use a multi-sig admin so no single key can abuse privileged functions.  
- Monitor on-chain transfer events during active proposal windows.  
- A protocol-level balance snapshot (captured at proposal creation, not vote time) is planned for v0.2.0 to fully close this attack surface.

**KI-002 — Single admin key**  
- Deploy both contracts with a multi-sig wallet (e.g., a 2-of-3 Stellar multi-sig account) as the admin.  
- Rotate keys on a regular schedule and immediately on any suspected compromise.  
- Use `transfer_admin` to move control to the multi-sig before the contracts go live.

**KI-005 — Proposer-controlled low quorum**  
- Monitor new proposals for unusually low quorum values via an off-chain indexer.  
- Use `update_quorum` (admin operation) to raise the threshold on active proposals if an inappropriate quorum is detected.  
- Consider enforcing a protocol-level minimum quorum floor in v0.2.0.

---

## How to Find Security Docs

All security-related documents are located as follows:

| File | Description |
|------|-------------|
| [`SECURITY.md`](../../SECURITY.md) | Vulnerability disclosure policy and contact |
| [`AUDIT.md`](../../AUDIT.md) | Audit engagement summary and report references |
| [`docs/security/threat-model.md`](threat-model.md) | Full threat actor analysis and mitigations |
| [`docs/security/known-issues.md`](known-issues.md) | Documented known issues with severity and status |
| [`docs/security/audit-scope.md`](audit-scope.md) | What was in scope for the OtterSec audit |
| [`docs/security/AUDIT_RESULTS.md`](AUDIT_RESULTS.md) | This file — consolidated findings and mitigations |

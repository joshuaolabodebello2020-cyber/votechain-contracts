# Governance Parameter Tuning Guide

This guide explains how each governance parameter affects DAO behaviour, documents the contract-enforced limits, suggests sensible defaults, and provides example configurations for common DAO profiles.

---

## Parameter Reference

These parameters are set at contract initialisation via `initialize()` or updated later via admin functions.

### `quorum` (per-proposal)

**What it is:** The minimum total vote weight (yes + no + abstain) required for a proposal to be eligible to pass. Measured in raw token units (not percentage).

**Contract-enforced limits:**
- Must be `> 0`
- Must be `≤ total_supply` at the time the proposal is created
- Validated again if updated via `update_quorum()`

**Effect on DAO behaviour:**

| Quorum setting | Low (e.g. 1% of supply) | High (e.g. 50% of supply) |
|---------------|------------------------|--------------------------|
| Ease of passing | Easy — few voters needed | Hard — broad mobilisation required |
| Legitimacy risk | High — small group can decide | Low — requires genuine participation |
| Gridlock risk | Low | High if participation is low |

**Recommended defaults:**

| DAO size | Suggested quorum (% of supply) | Reasoning |
|----------|-------------------------------|-----------|
| Small (<100 members) | 30–50% | High participation expected; meaningful bar |
| Medium (100–1 000 members) | 15–30% | Mix of active/passive holders |
| Large (1 000+ members) | 5–15% | Passive majority; too high causes gridlock |

---

### `duration` (per-proposal)

**What it is:** The voting window in seconds from the moment the proposal is created. After `duration` seconds the voting period closes and anyone may call `finalise()`.

**Contract-enforced limits:**
- Minimum: `60` seconds (1 minute)
- Maximum: `2 592 000` seconds (30 days)
- Values outside this range are rejected with `InvalidDurationRange`

**Effect on DAO behaviour:**

| Duration | Short (hours) | Long (days–weeks) |
|----------|--------------|-----------------|
| Decision speed | Fast | Slow |
| Participation | Low (limited window) | Higher (accommodates time zones) |
| Risk | Rushed decisions; low turnout | Stale proposals; governance fatigue |

**Recommended defaults:**

| DAO profile | Suggested duration | Notes |
|-------------|-------------------|-------|
| Emergency / time-sensitive | `3 600` (1 hour) to `86 400` (1 day) | Restrict to critical proposals only |
| Standard governance | `432 000` (5 days) | Balances speed and global participation |
| Constitutional / high-stakes | `604 800` (7 days) | Maximum deliberation time |

---

### `min_proposal_balance`

**What it is:** The minimum governance token balance a proposer must hold to create a proposal. Set to `0` to allow any token holder to propose.

**Contract-enforced limits:**
- Must be `≥ 0`
- Compared against the proposer's live token balance at proposal creation time

**Effect on DAO behaviour:**

| Setting | Low / zero | High |
|---------|-----------|------|
| Accessibility | Open to all token holders | Restricted to large stakeholders |
| Spam risk | Higher | Lower |
| Plutocracy risk | Lower | Higher |

**Recommended defaults:**

| DAO profile | Suggested value | Reasoning |
|-------------|----------------|-----------|
| Permissive governance | `0` | Anyone with tokens can propose |
| Spam-resistant | ~0.1% of total supply | Meaningful but accessible |
| Stakeholder-gated | ~1% of total supply | Reserved for significant holders |

---

### `proposal_cooldown`

**What it is:** The minimum number of seconds a proposer must wait between creating proposals. Set to `0` to disable cooldown.

**Contract-enforced limits:**
- Must be `≥ 0`
- Enforced per-address via the `LastProposal` storage entry

**Effect on DAO behaviour:**

| Cooldown | None / zero | Long (days) |
|----------|------------|------------|
| Proposal cadence | Unlimited | Rate-limited per address |
| Spam risk | Higher | Lower |
| Responsiveness | Immediate | Delayed in emergencies |

**Recommended defaults:**

| DAO profile | Suggested cooldown |
|-------------|-------------------|
| High-trust / small teams | `0` (disabled) |
| Standard | `86 400` (1 day) |
| Conservative | `604 800` (7 days) |

---

### `restrict_admin_vote`

**What it is:** A boolean flag. When `true`, the admin address cannot cast a vote on proposals they created.

**Contract-enforced limits:**
- Boolean — either `true` or `false`
- Enforced at vote time; admin may still vote on proposals created by others

**Effect on DAO behaviour:**
- `true` — reduces conflict-of-interest risk; recommended for most deployments
- `false` — admin participates freely; appropriate only when admin is a neutral multisig

---

## Contract-Enforced Limits Summary

| Parameter | Min | Max | Error if violated |
|-----------|-----|-----|------------------|
| `duration` | `60` s | `2 592 000` s | `InvalidDurationRange` |
| `quorum` | `1` | `total_supply` | `InvalidQuorum` / `QuorumExceedsSupply` |
| `min_proposal_balance` | `0` | — | — |
| `proposal_cooldown` | `0` | — | — |
| Proposal title length | 1 char | 128 chars | `InvalidTitle` |
| Proposal description length | 1 char | 1 024 chars | `InvalidDescription` |

---

## Example Configurations

### Small DAO — fast and open

A small, trusted team making quick operational decisions.

```toml
# config/governance-small-dao.toml
min_proposal_balance = 0       # Anyone with tokens can propose
proposal_cooldown    = 3600    # 1-hour cooldown between proposals
restrict_admin_vote  = true    # Admin cannot vote on own proposals
```

Typical proposal creation:
```
quorum   = 30% of supply       # Achievable with high participation
duration = 86400               # 1 day — fast decisions
```

### Medium DAO — balanced governance

A growing protocol with a mix of active and passive token holders.

```toml
# config/governance-medium-dao.toml
min_proposal_balance = 1000    # Small stake required to propose
proposal_cooldown    = 86400   # 1-day cooldown
restrict_admin_vote  = true
```

Typical proposal creation:
```
quorum   = 20% of supply
duration = 432000              # 5 days — global participation window
```

### Large DAO — conservative and deliberate

A large protocol with many passive holders and formal governance.

```toml
# config/governance-large-dao.toml
min_proposal_balance = 10000   # Significant stake required
proposal_cooldown    = 604800  # 7-day cooldown between proposals
restrict_admin_vote  = true
```

Typical proposal creation:
```
quorum   = 10% of supply
duration = 604800              # 7 days — ample time for deliberation
```

### Emergency proposal (within any DAO)

Use a short duration only for time-critical security or operational issues. Keep the quorum achievable but the approval threshold high (enforced off-chain via community norms, since VoteChain's pass condition is `votes_yes > votes_no`).

```
quorum   = 5% of supply        # Low to allow fast action
duration = 3600                # 1 hour — minimum allowed is 60 s
```

---

## Pass Conditions and Quorum Interaction

The contract evaluates this formula when `finalise()` is called:

```
total_votes = votes_yes + votes_no + votes_abstain

Passed   if  total_votes >= quorum  AND  votes_yes > votes_no
Rejected otherwise (including ties)
```

Key points:
- **Abstain counts toward quorum** but not toward the yes/no outcome. It is useful for signalling participation without taking a position.
- **A tie is a rejection** — `votes_yes == votes_no` fails even if quorum is met.
- `update_quorum()` can be called by the admin on an active proposal if conditions change, subject to the same `> 0` and `≤ total_supply` limits.

---

## Monitoring and Adjustment

Track these metrics to know when parameters need tuning:

| Metric | Warning signal | Suggested action |
|--------|---------------|-----------------|
| Quorum achievement rate | < 50% of proposals reach quorum | Lower quorum or increase voting duration |
| Proposal pass rate | > 90% or < 10% | Re-evaluate quorum and community alignment |
| Spam proposals | Multiple low-quality proposals per day | Increase `min_proposal_balance` or `proposal_cooldown` |
| Voter participation | Declining trend | Shorten duration to avoid fatigue, or run outreach |

To change parameters after deployment, use the admin functions:
- `update_quorum()` — adjust quorum on a specific active proposal
- Re-deployment or an upgrade path is required to change `min_proposal_balance`, `proposal_cooldown`, and `restrict_admin_vote` at the contract level

---

## Related Documentation

- [Proposal Lifecycle](lifecycle.md) — state transitions and finalization logic
- [Governance Contract Reference](../README.md#governance-contract-reference) — full API documentation
- [Storage Model](storage.md) — how parameters are persisted
- [DAO Integration Guide](dao-integration-guide.md) — end-to-end deployment walkthrough
- [FAQ](faq.md) — common governance questions

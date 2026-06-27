# DOC-007: Governance Parameter Tuning Guide

## Overview

This guide provides best practices for choosing governance parameters in VoteChain for DAOs of different sizes. Parameters significantly impact governance security, responsiveness, and participation.

## Parameters Overview

### Core Governance Parameters

| Parameter | Type | Impact | Default |
|-----------|------|--------|---------|
| **Quorum** | Percentage (0-100) | Minimum participation needed for valid votes | 50% |
| **Threshold** | Percentage (0-100) | Minimum approval needed for proposal passage | 51% |
| **Voting Duration** | Seconds | Time window for voting on proposals | 432,000 (5 days) |
| **Cooldown Period** | Seconds | Minimum time between proposal creation | 86,400 (1 day) |
| **Min Balance** | Tokens | Minimum holding to create proposals | 1,000 tokens |
| **Snapshot Window** | Seconds | Age of historical balances used for voting | 0 (use live balances) |

---

## Small DAOs (<100 Members)

### Characteristics
- Known participants, tight-knit community
- High participation rate typically expected
- Faster decision-making preferred
- Lower administrative overhead

### Recommended Configuration

```toml
[small_dao]
quorum = 60                    # 60% - Ensure majority participation
threshold = 50                 # 50% - Simple majority sufficient
voting_duration = 86400        # 1 day - Faster decisions
cooldown_period = 3600         # 1 hour - More frequent proposals
min_balance = 100              # Low threshold for proposal creation
snapshot_window = 0            # Live balances (everyone engaged)
```

### Rationale

**Quorum 60%**: With <100 members, getting 60% to vote is realistic and ensures genuine community buy-in.

**Threshold 50%**: Simple majority acceptable in small, homogeneous communities. Change to 66% if disagreement is high.

**Voting Duration 1 day**: Small communities can reach consensus quickly. Extended to 2-3 days if timezone spread exists.

**Cooldown 1 hour**: Enables rapid iteration and response to changes. Watch for spam; increase to daily if problematic.

**Min Balance 100**: Low barrier encourages participation. Adjust based on token distribution.

**Live Balances**: No snapshots needed; instant voting power visibility and fairness.

### Example Tuning Process

1. **Start**: Deploy with above config
2. **Monitor**: Track participation and proposal outcomes for 4 weeks
3. **Adjust**: If participation < 60%, reduce quorum to 45%. If proposals fail due to disagreement, increase threshold to 66%.
4. **Lock**: Use governance vote to formalize final parameters

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Low participation | Unclear proposals | Improve proposal template, communication |
| Proposals never pass | Too high threshold | Lower threshold to 50% |
| Spam proposals | Low cooldown/barrier | Increase cooldown to 6 hours, min balance to 500 |
| Analysis paralysis | Long voting duration | Reduce to 12 hours for urgent decisions |

---

## Medium DAOs (100-1000 Members)

### Characteristics
- Diverse stakeholder base
- Geographic distribution common
- Mix of active and passive holders
- Formal governance processes needed

### Recommended Configuration

```toml
[medium_dao]
quorum = 45                    # 45% - Realistic for diverse members
threshold = 66                 # 66% - Supermajority for protection
voting_duration = 432000       # 5 days - Global participation time
cooldown_period = 86400        # 1 day - Measured proposal pace
min_balance = 1000             # Meaningful stake required
snapshot_window = 604800       # 7 days - Historical voting power
```

### Rationale

**Quorum 45%**: Balances engagement requirement with realism. Lower than small DAO since passive holders exist. Avoid going below 30%.

**Threshold 66%**: Supermajority ensures broad support and prevents contentious decisions. Can lower to 50% for technical proposals only.

**Voting Duration 5 days**: Accommodates global time zones, enables discussion and deliberation.

**Cooldown 1 day**: Prevents proposal spam while allowing measured governance pace.

**Min Balance 1000**: Requires meaningful stake (adjust based on token price). Prevents spam proposals.

**7-day Snapshot**: Balances voting power fairness with preventing vote trading. Alternative: use real-time balances if trust is high.

### Phase-based Governance

Consider a multi-phase approach:

**Phase 1 (Weeks 1-4)**: Lower quorum (40%), simple majority (50%), short voting (3 days)
- Purpose: Establish patterns, test governance
- Risk: Rapid changes might cause issues

**Phase 2 (Weeks 5-16)**: Target parameters above
- Purpose: Stable governance
- After 3+ successful votes, move to Phase 3

**Phase 3 (Month 5+)**: Increase quorum to 50%, threshold to 70%
- Purpose: Long-term stability
- For emergency governance: override with supermajority vote

### Parameter Calculation Examples

**Scenario 1**: DAO with 500 members, 10% active participation expected
- Quorum 45% = 225 members needed (achievable with campaigns)
- Voting window: 7 days to reach 225 active voters

**Scenario 2**: DAO with 200 members, 30% regular participation
- Quorum 40% = 80 members needed (realistic)
- Cooldown: 1 day prevents governance spam
- Voting duration: 5 days allows everyone to vote

### Governance Tiers

Consider creating proposal tiers:

```
Tier 1: Minor changes (e.g., description updates)
- Quorum: 25%
- Threshold: 50%
- Duration: 2 days
- Min balance: 100 tokens

Tier 2: Standard proposals (e.g., parameter tweaks)
- Quorum: 45%
- Threshold: 66%
- Duration: 5 days
- Min balance: 1000 tokens

Tier 3: Major changes (e.g., contract upgrades)
- Quorum: 50%
- Threshold: 75%
- Duration: 7 days
- Min balance: 5000 tokens
```

---

## Large DAOs (1000+ Members)

### Characteristics
- Distributed stakeholder base
- Passive participant majority
- Professional governance needed
- Risk of gridlock if barriers too high

### Recommended Configuration

```toml
[large_dao]
quorum = 30                    # 30% - Realistic for large, passive base
threshold = 60                 # 60% - Balanced consensus
voting_duration = 604800       # 7 days - Ample time for discussion
cooldown_period = 604800       # 7 days - Prevent governance spam
min_balance = 10000            # Significant stake required
snapshot_window = 1209600      # 14 days - Historical fairness
```

### Rationale

**Quorum 30%**: With 1000+ passive holders, 30% is ambitious but achievable with engagement campaigns. Do not go below 20%.

**Threshold 60%**: Clear majority consensus without requiring supermajority that causes gridlock.

**Voting Duration 7 days**: Accommodates extreme time zone dispersion, allows media coverage and debate.

**Cooldown 7 days**: Prevents governance spam and allows adequate discussion between proposals.

**Min Balance 10000**: Requires substantial stake ($10k+ at typical valuations), deters spam.

**14-day Snapshot**: Prevents vote trading and gives time for stakeholder coordination.

### Governance Delegation

For large DAOs, consider delegation mechanism:

```
Allow members to delegate voting power to:
- Professional governance committees
- Trusted community members
- Specialists for technical proposals

Advantages:
- Increases effective participation
- Enables thoughtful voting
- Prevents vote fragmentation

Risks:
- Centralization of voting power
- Need for delegate accountability
```

### Emergency Governance

Reserve fast-track process for emergencies:

```
Emergency Proposal (e.g., security exploit):
- Quorum: 20% (reduced)
- Threshold: 80% (very high bar)
- Duration: 24 hours (fast)
- Requires: Multi-sig council signature

Constraints:
- Limited to security/legal issues only
- Can be used max 2x per year
- Subject to governance review
```

### Participation Incentives

For large DAOs with low participation:

```
Option 1: Voting Rewards
- Distribute treasury portion to voters
- Increases participation to 35-40%
- Cost: 1-2% of annual budget

Option 2: Governance Tiers
- Enhanced benefits for active governance participants
- Increases participation to 25-30%
- Cost: Minor (implementation only)

Option 3: Delegation Campaigns
- Encourage delegation to knowledgeable members
- Increases effective participation to 45%
- Cost: Coordination only
```

### Real-World Example: 5000-Member DAO

**Setup**:
- 5000 members holding governance token
- 2% average participation expected (~100 active voters)
- Wide geographic distribution

**Initial Config**:
- Quorum: 35% (1750 members) - initially ambitious
- Threshold: 60% (60% of participating members)
- Voting: 7 days
- Cooldown: 7 days

**After 6 Months**:
- Actual participation: 15% average
- **Adjustment**: Reduce quorum to 25% (1250 members)
- Result: Governance can now proceed

**After 1 Year**:
- With delegation: 30% effective participation
- Participation still at 15% but more impactful
- Maintain current parameters
- Consider delegation incentives for increased reach

---

## Parameter Trade-offs Matrix

| Goal | Quorum | Threshold | Duration | Cooldown | Min Balance |
|------|--------|-----------|----------|----------|-------------|
| **Agility** | Low 20% | Low 50% | Short 1d | Short 1h | Low 100 |
| **Legitimacy** | High 60% | High 70% | Long 7d | Long 7d | High 10k |
| **Participation** | Low 30% | Medium 60% | Long 7d | Medium 1d | Low 500 |
| **Security** | Medium 40% | High 70% | Medium 5d | Medium 1d | Medium 5k |
| **Balanced** | Medium 40-50% | Medium 60-66% | Medium 5d | Medium 1d | Medium 1-5k |

---

## Monitoring & Adjustment Process

### Key Metrics to Track

```
Weekly:
- Average voting participation rate
- Average time to proposal resolution
- Proposal pass/fail/cancel rate
- Quorum achievement rate

Monthly:
- Member retention vs. participation
- Cooldown effectiveness (proposals submitted)
- Min balance impact (proposal creators)
- Voter concentration (whale voting patterns)

Quarterly:
- Overall DAO health score
- Community satisfaction survey
- Parameter effectiveness review
- Adjustment needs assessment
```

### Adjustment Decision Tree

```
If participation < target quorum by 20%:
  └─ Reduce quorum by 10-15%
  └─ Increase voting duration by 2 days
  └─ Consider delegation mechanism

If participation > target threshold consistently:
  └─ Increase quorum to higher tier
  └─ Increase threshold for long-term stability
  └─ Consider additional Tier 3 proposals

If proposal failure rate > 50%:
  └─ Likely too high threshold
  └─ Reduce to 55% (from 66%)
  └─ Monitor for 4 weeks

If governance spam detected:
  └─ Increase cooldown period 2x
  └─ Increase min balance 5x
  └─ Monitor for 2 weeks
```

---

## Implementation Checklist

### Phase 1: Initial Deployment
- [ ] Select DAO size category
- [ ] Use recommended configuration from guide
- [ ] Set up monitoring dashboard
- [ ] Document baseline metrics
- [ ] Create adjustment process

### Phase 2: Monitoring (4-12 weeks)
- [ ] Track weekly metrics
- [ ] Identify discrepancies from projections
- [ ] Collect community feedback
- [ ] Document issues and successes

### Phase 3: Adjustment (As needed)
- [ ] Review metrics against goals
- [ ] Identify needed parameter changes
- [ ] Propose changes through governance
- [ ] Implement after vote passes
- [ ] Monitor impact for 4 weeks

### Phase 4: Finalization (6+ months)
- [ ] Document final parameter rationale
- [ ] Create institutional knowledge documentation
- [ ] Train new community members
- [ ] Plan annual review process

---

## Common Mistakes to Avoid

❌ **Too high quorum**: Causes governance gridlock, nothing ever passes
- Solution: Start at 40% for medium DAOs, adjust after 2 months

❌ **Too low threshold**: Contentious decisions divide community
- Solution: Use 60%+ to ensure broad buy-in

❌ **Snapshot window too old**: Enables vote trading and power accumulation
- Solution: Use 7-14 days maximum

❌ **Min balance not adjusted for token value**: Creates barriers to participation
- Solution: Quarterly review against token price

❌ **No delegation mechanism**: Passive holders prevent legitimate quorum
- Solution: Implement delegation for 1000+ member DAOs

❌ **No emergency governance process**: Can't respond to security issues
- Solution: Reserve fast-track for verified emergencies only

---

## Tools & Resources

### Monitoring Tools
- [VoteChain Dashboard](../PROD-004_governance-dashboard.md): Real-time metrics
- [Parameter Simulator](../tools/parameter-simulator.md): Test configurations
- [Analytics Dashboard](../docs/analytics.md): Historical analysis

### Community Resources
- [Governance Best Practices](governance-best-practices.md)
- [FAQ](../docs/faq.md#governance-parameters)
- [Community Forum](https://forum.votechain.io): Discussion & feedback

### Related Documentation
- [Proposal Lifecycle](../docs/lifecycle.md)
- [Contract Reference](../docs/governance-reference.md)
- [Security Considerations](../docs/security/)

---

## Questions? Need Help?

1. **Parameter Calculator**: See [tools/calculator.md](../tools/calculator.md)
2. **Governance Audit**: Request via governance-team@votechain.io
3. **Community Support**: Ask in [Discord #governance](https://discord.gg/votechain)
4. **Professional Services**: Contact [governance@votechain.io](mailto:governance@votechain.io)

---

**Document Version**: 1.0
**Last Updated**: 2026-05-30
**Maintainer**: Governance Team

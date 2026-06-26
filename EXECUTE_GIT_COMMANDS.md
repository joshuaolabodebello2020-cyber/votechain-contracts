# QUICK START: Execute These Git Commands

This file contains all the git commands needed to set up the 4 GitHub issues. Run these commands in your terminal.

## Setup (Run Once)

```bash
cd /workspaces/votechain-contracts
git config user.email "you@example.com"
git config user.name "Your Name"
```

## Issue #322: Governance Dashboard API

```bash
git checkout -b feat/322-governance-dashboard
git add backend/src/routes/governance.ts backend/src/app.ts frontend/src/pages/GovernanceDashboard.tsx
git commit -m "feat(#322): Implement governance statistics API endpoint

- Create /api/governance/stats endpoint for dashboard metrics
- Connect GovernanceDashboard component to real API
- Support total proposals, participation rate, pass rate tracking
- Enable real-time metrics refresh every 5 minutes

Closes #322"
git push -u origin feat/322-governance-dashboard
```

## Issue #320: Demo Deployment Guide

```bash
git checkout -b feat/320-demo-deployment main
git add docs/DEMO_DEPLOYMENT.md
git commit -m "docs(#320): Add demo deployment guide for Stellar testnet

- Document full deployment process for testnet demo
- Include contract initialization and sample proposals
- Provide frontend deployment and verification steps
- Add environment configuration templates
- Reference deployment links and maintenance procedures

Closes #320"
git push -u origin feat/320-demo-deployment
```

## Issue #314: STRIDE Threat Modeling

```bash
git checkout -b feat/314-threat-modeling main
git add docs/security/SEC-012-threat-modeling-token.md
git commit -m "security(#314): Complete STRIDE threat modeling for token contract

- Analyze Spoofing, Tampering, Repudiation risks
- Document Information Disclosure threats
- Review Authentication and Authorization threats
- Evaluate Denial of Service vectors
- Define mitigation strategies for all high-risk threats
- Create action items for security improvements

Closes #314"
git push -u origin feat/314-threat-modeling
```

## Issue #279: Parameter Tuning Guide

```bash
git checkout -b feat/279-parameter-tuning main
git add docs/GOVERNANCE_PARAMETER_TUNING.md
git commit -m "docs(#279): Write governance parameter tuning guide

- Document parameter recommendations for small, medium, large DAOs
- Explain quorum, threshold, voting duration, cooldown tradeoffs
- Provide example configurations and tuning processes
- Include phase-based governance approach
- Add emergency governance process
- Create monitoring metrics and adjustment decision tree

Closes #279"
git push -u origin feat/279-parameter-tuning
```

## Verify All Branches

```bash
git branch -a
git log --oneline -10
```

## All Set!

After running the commands above, your branches will be pushed to GitHub. You can then:
1. Open GitHub and create PRs from each branch
2. Link each PR to its corresponding issue
3. Submit the PRs for review

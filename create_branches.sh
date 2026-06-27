#!/bin/bash

# Script to create branches and commits for all 4 issues

cd /workspaces/votechain-contracts

# Issue #322: Build governance dashboard
echo "=== Issue #322: Governance Dashboard ==="
git checkout -b feat/322-governance-dashboard
git add backend/src/routes/governance.ts backend/src/app.ts frontend/src/pages/GovernanceDashboard.tsx
git commit -m "feat(#322): Implement governance statistics API endpoint

- Create /api/governance/stats endpoint for dashboard metrics
- Connect GovernanceDashboard component to real API
- Support total proposals, participation rate, pass rate tracking
- Enable real-time metrics refresh every 5 minutes

Closes #322"

# Issue #320: Demo deployment
echo "=== Issue #320: Demo Deployment ==="
git checkout -b feat/320-demo-deployment main
git add docs/DEMO_DEPLOYMENT.md
git commit -m "docs(#320): Add demo deployment guide for Stellar testnet

- Document full deployment process for testnet demo
- Include contract initialization and sample proposals
- Provide frontend deployment and verification steps
- Add environment configuration templates
- Reference deployment links and maintenance procedures

Closes #320"

# Issue #314: Threat modeling
echo "=== Issue #314: Threat Modeling ==="
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

# Issue #279: Parameter tuning guide
echo "=== Issue #279: Parameter Tuning Guide ==="
git checkout -b feat/279-parameter-tuning main
git add docs/GOVERNANCE_PARAMETER_TUNING.md
git commit -m "docs(#279): Write governance parameter tuning guide

- Document parameter recommendations for small (<100), medium (100-1000), large (1000+) DAOs
- Explain quorum, threshold, voting duration, cooldown tradeoffs
- Provide example configurations and tuning processes
- Include phase-based governance approach for medium DAOs
- Add emergency governance process for large DAOs
- Create monitoring metrics and adjustment decision tree

Closes #279"

echo "=== All branches created ==="

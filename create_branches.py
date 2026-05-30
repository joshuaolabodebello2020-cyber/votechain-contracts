#!/usr/bin/env python3
"""Script to create branches and commits for GitHub issues"""

import subprocess
import os

os.chdir("/workspaces/votechain-contracts")

def run_cmd(cmd):
    """Run command and return output"""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    return result.returncode

# Issue #322: Governance Dashboard
print("\n=== Issue #322: Governance Dashboard ===")
run_cmd("git checkout -b feat/322-governance-dashboard 2>/dev/null || git checkout feat/322-governance-dashboard")
run_cmd("git add backend/src/routes/governance.ts backend/src/app.ts frontend/src/pages/GovernanceDashboard.tsx")
run_cmd('''git commit -m "feat(#322): Implement governance statistics API endpoint

- Create /api/governance/stats endpoint for dashboard metrics
- Connect GovernanceDashboard component to real API
- Support total proposals, participation rate, pass rate tracking
- Enable real-time metrics refresh every 5 minutes

Closes #322"''')

# Issue #320: Demo Deployment  
print("\n=== Issue #320: Demo Deployment ===")
run_cmd("git checkout -b feat/320-demo-deployment main")
run_cmd("git add docs/DEMO_DEPLOYMENT.md")
run_cmd('''git commit -m "docs(#320): Add demo deployment guide for Stellar testnet

- Document full deployment process for testnet demo
- Include contract initialization and sample proposals
- Provide frontend deployment and verification steps
- Add environment configuration templates
- Reference deployment links and maintenance procedures

Closes #320"''')

# Issue #314: Threat Modeling
print("\n=== Issue #314: Threat Modeling ===")
run_cmd("git checkout -b feat/314-threat-modeling main")
run_cmd("git add docs/security/SEC-012-threat-modeling-token.md")
run_cmd('''git commit -m "security(#314): Complete STRIDE threat modeling for token contract

- Analyze Spoofing, Tampering, Repudiation risks
- Document Information Disclosure threats
- Review Authentication and Authorization threats
- Evaluate Denial of Service vectors
- Define mitigation strategies for all high-risk threats
- Create action items for security improvements

Closes #314"''')

# Issue #279: Parameter Tuning
print("\n=== Issue #279: Parameter Tuning ===")
run_cmd("git checkout -b feat/279-parameter-tuning main")
run_cmd("git add docs/GOVERNANCE_PARAMETER_TUNING.md")
run_cmd('''git commit -m "docs(#279): Write governance parameter tuning guide

- Document parameter recommendations for small (<100), medium (100-1000), large (1000+) DAOs
- Explain quorum, threshold, voting duration, cooldown tradeoffs
- Provide example configurations and tuning processes
- Include phase-based governance approach for medium DAOs
- Add emergency governance process for large DAOs
- Create monitoring metrics and adjustment decision tree

Closes #279"''')

print("\n=== Listing branches ===")
run_cmd("git branch -a")

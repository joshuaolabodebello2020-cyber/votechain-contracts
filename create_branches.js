#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

const workdir = '/workspaces/votechain-contracts';

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd}`);
    exec(cmd, { cwd: workdir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        if (stderr) console.error(stderr);
        reject(error);
      } else {
        console.log(stdout);
        if (stderr) console.log(stderr);
        resolve(stdout);
      }
    });
  });
}

async function main() {
  try {
    // Issue #322
    console.log('\n========== Issue #322: Governance Dashboard ==========');
    await runCommand('git checkout -b feat/322-governance-dashboard 2>/dev/null || git checkout feat/322-governance-dashboard');
    await runCommand('git add backend/src/routes/governance.ts backend/src/app.ts frontend/src/pages/GovernanceDashboard.tsx');
    await runCommand(`git commit -m "feat(#322): Implement governance statistics API endpoint

- Create /api/governance/stats endpoint for dashboard metrics
- Connect GovernanceDashboard component to real API
- Support total proposals, participation rate, pass rate tracking
- Enable real-time metrics refresh every 5 minutes

Closes #322"`);
    
    // Issue #320
    console.log('\n========== Issue #320: Demo Deployment ==========');
    await runCommand('git checkout -b feat/320-demo-deployment main');
    await runCommand('git add docs/DEMO_DEPLOYMENT.md');
    await runCommand(`git commit -m "docs(#320): Add demo deployment guide for Stellar testnet

- Document full deployment process for testnet demo
- Include contract initialization and sample proposals
- Provide frontend deployment and verification steps
- Add environment configuration templates
- Reference deployment links and maintenance procedures

Closes #320"`);
    
    // Issue #314
    console.log('\n========== Issue #314: Threat Modeling ==========');
    await runCommand('git checkout -b feat/314-threat-modeling main');
    await runCommand('git add docs/security/SEC-012-threat-modeling-token.md');
    await runCommand(`git commit -m "security(#314): Complete STRIDE threat modeling for token contract

- Analyze Spoofing, Tampering, Repudiation risks
- Document Information Disclosure threats
- Review Authentication and Authorization threats
- Evaluate Denial of Service vectors
- Define mitigation strategies for all high-risk threats
- Create action items for security improvements

Closes #314"`);
    
    // Issue #279
    console.log('\n========== Issue #279: Parameter Tuning ==========');
    await runCommand('git checkout -b feat/279-parameter-tuning main');
    await runCommand('git add docs/GOVERNANCE_PARAMETER_TUNING.md');
    await runCommand(`git commit -m "docs(#279): Write governance parameter tuning guide

- Document parameter recommendations for small, medium, large DAOs
- Explain quorum, threshold, voting duration, cooldown tradeoffs
- Provide example configurations and tuning processes
- Include phase-based governance approach
- Add emergency governance process
- Create monitoring metrics and adjustment decision tree

Closes #279"`);
    
    // Verify
    console.log('\n========== Verification ==========');
    await runCommand('git branch -a');
    await runCommand('git log --oneline -15');
    
    console.log('\n✅ All branches created successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: git push -u origin feat/322-governance-dashboard');
    console.log('2. Run: git push -u origin feat/320-demo-deployment');
    console.log('3. Run: git push -u origin feat/314-threat-modeling');
    console.log('4. Run: git push -u origin feat/279-parameter-tuning');
    console.log('5. Create PRs on GitHub from each branch');
    
  } catch (error) {
    console.error('❌ Process failed:', error);
    process.exit(1);
  }
}

main();

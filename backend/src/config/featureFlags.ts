export interface FeatureFlags {
  enableGovernanceStats: boolean;
  enableVoterVotes: boolean;
  enableProposalInvalidation: boolean;
  enableAdvancedMetrics: boolean;
}

function parseEnvFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase().trim();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return defaultValue;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableGovernanceStats: parseEnvFlag(process.env.FEATURE_GOVERNANCE_STATS, true),
    enableVoterVotes: parseEnvFlag(process.env.FEATURE_VOTER_VOTES, true),
    enableProposalInvalidation: parseEnvFlag(process.env.FEATURE_PROPOSAL_INVALIDATION, true),
    enableAdvancedMetrics: parseEnvFlag(process.env.FEATURE_ADVANCED_METRICS, false),
  };
}

export function getFeatureFlag(name: keyof FeatureFlags): boolean {
  return getFeatureFlags()[name];
}

export const DISABLED_FEATURE_MESSAGE =
  "This feature is currently disabled. Contact your administrator for more information.";

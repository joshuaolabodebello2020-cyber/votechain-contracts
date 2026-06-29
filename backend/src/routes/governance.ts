/**
 * Governance routes - provides dashboard metrics and statistics.
 * RPC calls are wrapped with a circuit breaker so upstream failures degrade
 * gracefully instead of cascading.
 *
 * Feature flags control which endpoints are active. Disabled features return
 * a clear message indicating they are not available.
 */

import { Router, Request, Response } from "express";
import { validate } from "../middleware/requestValidator";
import { sendSuccess, sendError } from "../middleware/response";
import { getFeatureFlags, DISABLED_FEATURE_MESSAGE } from "../config/featureFlags";

const router = Router();

// GET /governance/stats — returns governance health metrics
router.get(
  "/governance/stats",
  validate({}),
  async (_req: Request, res: Response) => {
    if (!getFeatureFlags().enableGovernanceStats) {
      return sendError(res, 503, "FEATURE_DISABLED", DISABLED_FEATURE_MESSAGE);
    }
    try {
      // TODO: Replace with real Stellar RPC / indexer call
      const stats = {
        byState: {
          active: 3,
          passed: 12,
          rejected: 5,
          executed: 10,
          cancelled: 2,
        },
        participationOverTime: [
          { date: "2026-01", rate: 42 },
          { date: "2026-02", rate: 55 },
          { date: "2026-03", rate: 61 },
          { date: "2026-04", rate: 48 },
          { date: "2026-05", rate: 64 },
        ],
        topVoters: [
          { address: "GABC...1234", total_weight: 9800000 },
          { address: "GDEF...5678", total_weight: 7200000 },
          { address: "GHIJ...9012", total_weight: 5500000 },
          { address: "GKLM...3456", total_weight: 4100000 },
          { address: "GNOP...7890", total_weight: 3800000 },
          { address: "GQRS...1234", total_weight: 3200000 },
          { address: "GTUV...5678", total_weight: 2900000 },
          { address: "GWXY...9012", total_weight: 2400000 },
          { address: "GZAB...3456", total_weight: 1900000 },
          { address: "GCDE...7890", total_weight: 1500000 },
        ],
        avgQuorumAchievement: 73,
      };

      sendSuccess(res, stats);
    } catch (err) {
      console.error("Error fetching governance stats:", err);
      sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch governance statistics");
    }
  }
);

// GET /voters/:address/votes — returns votes for a specific voter
router.get(
  "/voters/:address/votes",
  validate({
    params: {
      address: { type: "string", required: true },
    },
  }),
  async (req: Request, res: Response) => {
    if (!getFeatureFlags().enableVoterVotes) {
      return sendError(res, 503, "FEATURE_DISABLED", DISABLED_FEATURE_MESSAGE);
    }
    const { address } = req.params;
    // TODO: Replace with real Stellar RPC / indexer call
    sendSuccess(res, []);
  }
);

export default router;

/**
 * Governance routes - provides dashboard metrics and statistics.
 * Replace stub handlers with real Stellar RPC / indexer calls.
 */

import { Router, Request, Response } from "express";
import { withCorrelationId } from "../middleware/requestLogger";

const router = Router();

interface ProposalStats {
  byState: Record<string, number>;
  participationOverTime: Array<{ date: string; rate: number }>;
  topVoters: Array<{ address: string; total_weight: number }>;
  avgQuorumAchievement: number;
}

// GET /governance/stats — returns governance health metrics
router.get("/governance/stats", async (_req: Request, res: Response) => {
  try {
    // TODO: Replace with real API calls to Stellar RPC / indexer
    const stats: ProposalStats = {
      byState: {
        Active: 3,
        Passed: 12,
        Rejected: 5,
        Executed: 10,
        Cancelled: 2,
      },
      participationOverTime: [
        { date: "2026-01", rate: 42 },
        { date: "2026-02", rate: 55 },
        { date: "2026-03", rate: 61 },
        { date: "2026-04", rate: 48 },
        { date: "2026-05", rate: 64 },
      ],
      topVoters: [
        { address: "GABC...1234", total_weight: 9_800_000 },
        { address: "GDEF...5678", total_weight: 7_200_000 },
        { address: "GHIJ...9012", total_weight: 5_500_000 },
        { address: "GKLM...3456", total_weight: 4_100_000 },
        { address: "GNOP...7890", total_weight: 3_800_000 },
        { address: "GQRS...1234", total_weight: 3_200_000 },
        { address: "GTUV...5678", total_weight: 2_900_000 },
        { address: "GWXY...9012", total_weight: 2_400_000 },
        { address: "GZAB...3456", total_weight: 1_900_000 },
        { address: "GCDE...7890", total_weight: 1_500_000 },
      ],
      avgQuorumAchievement: 73,
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching governance stats:", error);
    res.status(500).json(withCorrelationId(res, { error: "Failed to fetch governance statistics" }));
  }
});

export default router;

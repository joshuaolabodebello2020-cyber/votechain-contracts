/**
 * Governance routes - provides dashboard metrics and statistics.
 * RPC calls are wrapped with a circuit breaker so upstream failures degrade
 * gracefully instead of cascading.
 */

import { Router, Request, Response } from "express";
import { rpcCircuitBreaker, CircuitOpenError } from "../middleware/circuitBreaker";

const router = Router();

interface ProposalStats {
  byState: Record<string, number>;
  participationOverTime: Array<{ date: string; rate: number }>;
  topVoters: Array<{ address: string; total_weight: number }>;
  avgQuorumAchievement: number;
}

// GET /health/rpc — exposes circuit-breaker state
router.get("/health/rpc", (_req: Request, res: Response) => {
  const status = rpcCircuitBreaker.status();
  const httpStatus = status.state === "OPEN" ? 503 : 200;
  res.status(httpStatus).json(status);
});

// GET /governance/stats — returns governance health metrics
router.get("/governance/stats", async (_req: Request, res: Response) => {
  try {
    // Wrap the upstream RPC call in the circuit breaker.
    // Swap the lambda body for a real Stellar RPC / indexer call.
    const stats: ProposalStats = await rpcCircuitBreaker.call(async () => ({
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
    }));

    res.json(stats);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      res.status(503).json({ error: error.message, retryAfterMs: error.retryAfterMs });
    } else {
      console.error("Error fetching governance stats:", error);
      res.status(500).json({ error: "Failed to fetch governance statistics" });
    }
  }
});

export default router;

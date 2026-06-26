/**
 * Governance routes — dashboard metrics fetched from the Soroban RPC node.
 */

import { Router, Request, Response } from "express";
import {
  fetchProposalCount,
  readContractData,
  getGovernanceContractId,
  wrapRpcError,
} from "../services/stellarRpc";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";

const router = Router();

interface ProposalStats {
  byState: Record<string, number>;
  totalProposals: number;
}

// GET /governance/stats — governance health metrics
router.get("/governance/stats", async (_req: Request, res: Response) => {
  try {
    const count = await fetchProposalCount();
    const ids = Array.from({ length: count }, (_, i) => i + 1);

    const proposals = (
      await Promise.all(
        ids.map((id) =>
          readContractData(
            getGovernanceContractId(),
            xdr.ScVal.scvMap([
              new xdr.ScMapEntry({
                key: nativeToScVal("Proposal"),
                val: nativeToScVal(id, { type: "u64" }),
              }),
            ])
          )
        )
      )
    ).filter(Boolean) as Array<Record<string, unknown>>;

    const byState: Record<string, number> = {};
    for (const p of proposals) {
      const state = String(p.state ?? "Unknown");
      byState[state] = (byState[state] ?? 0) + 1;
    }

    const stats: ProposalStats = { byState, totalProposals: count };
    res.json(stats);
  } catch (err) {
    const error = wrapRpcError(err);
    console.error("Error fetching governance stats:", error);
    res.status(502).json({ error: error.message });
  }
});

export default router;

/**
 * Proposal routes with Redis caching applied.
 * On-chain data is fetched via the shared Stellar RPC service.
 */

import { Router, Request, Response } from "express";
import {
  cacheProposalList,
  cacheProposalItem,
  getCacheMetrics,
  invalidateProposalCache,
} from "../middleware/redisCache";
import {
  fetchProposalCount,
  readContractData,
  getGovernanceContractId,
  wrapRpcError,
} from "../services/stellarRpc";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";

const router = Router();

// GET /proposals — cached 30 s
router.get("/proposals", cacheProposalList, async (_req: Request, res: Response) => {
  try {
    const count = await fetchProposalCount();
    // Fetch each proposal by its numeric ID from persistent storage
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const proposals = await Promise.all(
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
    );
    res.json(proposals.filter(Boolean));
  } catch (err) {
    const error = wrapRpcError(err);
    console.error("Error fetching proposals:", error);
    res.status(502).json({ error: error.message });
  }
});

// GET /proposals/:id — cached 10 s
router.get("/proposals/:id", cacheProposalItem, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid proposal id" });
    return;
  }
  try {
    const proposal = await readContractData(
      getGovernanceContractId(),
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: nativeToScVal("Proposal"),
          val: nativeToScVal(id, { type: "u64" }),
        }),
      ])
    );
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    res.json(proposal);
  } catch (err) {
    const error = wrapRpcError(err);
    console.error(`Error fetching proposal ${id}:`, error);
    res.status(502).json({ error: error.message });
  }
});

// POST /proposals/invalidate — called by the event indexer on new on-chain events
router.post("/proposals/invalidate", async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };
  await invalidateProposalCache(id);
  res.json({ ok: true, invalidated: id ?? "list" });
});

// GET /metrics/cache — exposes hit/miss counters
router.get("/metrics/cache", (_req: Request, res: Response) => {
  res.json(getCacheMetrics());
});

export default router;

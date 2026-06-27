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
import { validate } from "../middleware/requestValidator";

const router = Router();

// GET /proposals — cached 30 s
router.get(
  "/proposals",
  validate({
    query: {
      limit: { type: "integer", required: false, min: 1, max: 100 },
      page: { type: "integer", required: false, min: 1 },
      status: { type: "string", required: false, enum: ["Active", "Passed", "Rejected", "Executed", "Cancelled"] },
    },
  }),
  cacheProposalList,
  async (_req: Request, res: Response) => {
    // TODO: fetch from Stellar RPC / indexer
    const proposals: unknown[] = [];
    res.json(proposals);
  }
);

// GET /proposals/:id — cached 10 s
router.get(
  "/proposals/:id",
  validate({
    params: {
      id: { type: "string", required: true, min: 1, max: 64, pattern: /^[a-zA-Z0-9_-]+$/ },
    },
  }),
  cacheProposalItem,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: fetch single proposal from Stellar RPC / indexer
    res.json({ id });
  }
);

// POST /proposals/invalidate — called by the event indexer on new on-chain events
router.post(
  "/proposals/invalidate",
  validate({
    body: {
      id: { type: "string", required: false, min: 1, max: 64, pattern: /^[a-zA-Z0-9_-]+$/ },
    },
  }),
  async (req: Request, res: Response) => {
    const { id } = req.body as { id?: string };
    await invalidateProposalCache(id);
    res.json({ ok: true, invalidated: id ?? "list" });
  }
);

// GET /metrics/cache — exposes hit/miss counters
router.get("/metrics/cache", (_req: Request, res: Response) => {
  res.json(getCacheMetrics());
});

export default router;

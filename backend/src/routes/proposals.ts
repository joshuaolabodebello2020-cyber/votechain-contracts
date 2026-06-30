/**
 * Proposal routes with Redis caching applied.
 * On-chain data is fetched via the shared Stellar RPC service.
 *
 * Feature flags control which endpoints are active. Disabled features return
 * a clear message indicating they are not available.
 */

import { Router, Request, Response } from "express";
import {
  cacheProposalList,
  cacheProposalItem,
  getCacheMetrics,
  invalidateProposalCache,
} from "../middleware/redisCache";
import { validate } from "../middleware/requestValidator";
import { sendSuccess, sendError } from "../middleware/response";
import { requireAdmin } from "../middleware/adminAuth";
import { logAdminAction, getAuditLog } from "../middleware/auditLogger";

const router = Router();

// GET /proposals — cached 30 s
router.get(
  "/proposals",
  validate({
    query: {
      offset: { type: "integer", required: false, min: 0 },
      limit: { type: "integer", required: false, min: 1, max: 50 },
      state: { type: "string", required: false, enum: ["active", "passed", "rejected", "executed", "cancelled"] },
    },
  }),
  cacheProposalList,
  async (_req: Request, res: Response) => {
    const proposals: unknown[] = [];
    sendSuccess(res, proposals);
  }
);

// GET /proposals/:id — cached 10 s
router.get(
  "/proposals/:id",
  validate({ params: { id: { type: "integer", required: true } } }),
  cacheProposalItem,
  async (req: Request, res: Response) => {
    sendSuccess(res, { id: req.params.id });
  }
);

// GET /proposals/:id/votes
router.get(
  "/proposals/:id/votes",
  validate({ params: { id: { type: "integer", required: true } } }),
  async (_req: Request, res: Response) => {
    sendSuccess(res, []);
  }
);

// POST /proposals/invalidate — called by the event indexer on new on-chain events
router.post(
  "/proposals/invalidate",
  requireAdmin,
  validate({
    body: {
      id: { type: "string", required: false, min: 1, max: 64, pattern: /^[a-zA-Z0-9_-]+$/ },
    },
  }),
  async (req: Request, res: Response) => {
    if (!getFeatureFlags().enableProposalInvalidation) {
      return sendError(res, 503, "FEATURE_DISABLED", DISABLED_FEATURE_MESSAGE);
    }
    const { id } = req.body as { id?: string };
    logAdminAction({
      actor: "admin",
      action: "CACHE_INVALIDATION",
      endpoint: req.path,
      method: req.method,
      statusCode: 200,
    });
    await invalidateProposalCache(id);
    res.json({ ok: true, invalidated: id ?? "list" });
  }
);

// GET /audit-log — exposes audit log for authorized operators
router.get("/audit-log", requireAdmin, (_req: Request, res: Response) => {
  sendSuccess(res, getAuditLog());
});

// GET /metrics/cache — exposes hit/miss counters
router.get("/metrics/cache", requireAdmin, (_req: Request, res: Response) => {
  if (!getFeatureFlags().enableAdvancedMetrics) {
    return sendError(res, 503, "FEATURE_DISABLED", DISABLED_FEATURE_MESSAGE);
  }
  sendSuccess(res, getCacheMetrics());
});

export default router;

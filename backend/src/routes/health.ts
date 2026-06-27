import { Router, Request, Response } from "express";
import { isRedisReady } from "../middleware/redisCache";

const router = Router();

/** GET /live — process is alive */
router.get("/live", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

/** GET /ready — backend and Redis are connected */
router.get("/ready", (_req: Request, res: Response) => {
  if (!isRedisReady()) {
    res.status(503).json({ status: "unavailable", redis: false });
    return;
  }
  res.json({ status: "ok", redis: true });
});

export default router;

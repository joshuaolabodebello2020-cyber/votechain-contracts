import express from "express";
import { getRedisClient } from "./redis";
import { getCachedProposal, getCacheStats } from "./cache";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Health check — supports Docker Compose and Kubernetes readiness probes (#459)
app.get("/health", async (_req, res) => {
  const redis = getRedisClient();
  let redisStatus = "down";
  try {
    if (redis) {
      await redis.ping();
      redisStatus = "up";
    }
  } catch {
    redisStatus = "down";
  }
  const healthy = redisStatus === "up";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "healthy" : "unhealthy",
    redis: redisStatus,
  });
});

// Return cached proposal data (#465)
app.get("/proposals/:id", async (req, res) => {
  const { id } = req.params;
  const cached = await getCachedProposal(id);
  res.json({ id, cached: cached !== null, data: cached });
});

// Cache hit/miss metrics (#465)
app.get("/metrics/cache", (_req, res) => {
  res.json(getCacheStats());
});

// Graceful startup — warn if Redis unavailable but keep server running (#459)
const redis = getRedisClient();
if (redis) {
  redis.connect().catch((err: Error) => {
    console.warn("[startup] Redis unavailable:", err.message, "— continuing without cache");
  });
}

app.listen(PORT, () => console.log(`votechain-backend listening on :${PORT}`));

export default app;

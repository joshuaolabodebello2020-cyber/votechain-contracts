import express from "express";
import { connectRedis } from "./middleware/redisCache";
import proposalRoutes from "./routes/proposals";
import governanceRoutes from "./routes/governance";
import healthRoutes from "./routes/health";

const app = express();
app.use(express.json());
app.use("/api", proposalRoutes);
app.use("/api", governanceRoutes);
app.use("/", healthRoutes);

const PORT = process.env.PORT ?? 3001;

connectRedis().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;

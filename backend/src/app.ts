import express from "express";
import { connectRedis } from "./middleware/redisCache";
import { correlationId, requestLogger } from "./middleware/requestLogger";
import proposalRoutes from "./routes/proposals";
import governanceRoutes from "./routes/governance";

const app = express();
app.use(express.json());
app.use(correlationId);
app.use(requestLogger);
app.use("/api", proposalRoutes);
app.use("/api", governanceRoutes);

const PORT = process.env.PORT ?? 3001;

connectRedis().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;

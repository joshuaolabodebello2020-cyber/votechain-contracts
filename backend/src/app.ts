import express from "express";
import { connectRedis } from "./middleware/redisCache";
import { rateLimiter } from "./middleware/rateLimiter";
import {
  jsonParserOptions,
  payloadErrorHandler,
  rejectOversizedRequests,
  validateFieldSizes,
} from "./middleware/payloadLimit";
import proposalRoutes from "./routes/proposals";
import governanceRoutes from "./routes/governance";

const app = express();

// Reject requests that declare an oversized Content-Length before body parsing
// so the server never reads oversized payloads into memory (#546).
app.use(rejectOversizedRequests);

// Parse JSON bodies with a hard size limit (default 100 KB, overridable via
// MAX_JSON_BYTES env var). Express returns 413 for bodies exceeding the limit.
app.use(express.json(jsonParserOptions()));

// Validate individual field sizes after parsing to catch edge cases (#546).
app.use(validateFieldSizes);

app.use("/api", rateLimiter);
app.use("/api", proposalRoutes);
app.use("/api", governanceRoutes);

// Convert body-parser errors (413 / 400) into structured JSON responses (#546).
app.use(payloadErrorHandler);

const PORT = process.env.PORT ?? 3001;

connectRedis().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;

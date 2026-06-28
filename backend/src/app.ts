import express from "express";
import * as OpenApiValidator from "express-openapi-validator";
import path from "path";
import { connectRedis } from "./middleware/redisCache";
import { rateLimiter } from "./middleware/rateLimiter";
import {
  jsonParserOptions,
  payloadErrorHandler,
  rejectOversizedRequests,
  validateFieldSizes,
} from "./middleware/payloadLimit";
import { sendError } from "./middleware/response";
import proposalRoutes from "./routes/proposals";
import governanceRoutes from "./routes/governance";
import healthRoutes from "./routes/health";

const app = express();

// Reject requests that declare an oversized Content-Length before body parsing
// so the server never reads oversized payloads into memory (#546).
app.use(rejectOversizedRequests);

// Parse JSON bodies with a hard size limit (default 100 KB, overridable via
// MAX_JSON_BYTES env var). Express returns 413 for bodies exceeding the limit.
app.use(express.json(jsonParserOptions()));

// Validate individual field sizes after parsing to catch edge cases (#546).
app.use(validateFieldSizes);

// Serve OpenAPI specification
app.get("/api/v1/openapi.yml", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../../api/openapi.yml"));
});
app.get("/api/v1/openapi.json", (_req, res) => {
  res.sendFile(path.resolve(__dirname, "../../api/openapi.yml"));
});

// Apply OpenAPI validator to all /api/v1 routes
app.use(
  OpenApiValidator.middleware({
    apiSpec: path.resolve(__dirname, "../../api/openapi.yml"),
    validateRequests: true,
    validateResponses: true,
    validateSecurity: false,
  })
);

// Mount routes under /api/v1
app.use("/api/v1", rateLimiter);
app.use("/api/v1", proposalRoutes);
app.use("/api/v1", governanceRoutes);
app.use("/", healthRoutes);

// OpenAPI error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[OpenAPI Validation Error]", err);
  sendError(res, err.status || 500, "VALIDATION_ERROR", err.message || "Invalid request");
});

// Convert body-parser errors (413 / 400) into structured JSON responses (#546).
app.use(payloadErrorHandler);

const PORT = process.env.PORT ?? 3001;

connectRedis().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
});

export default app;

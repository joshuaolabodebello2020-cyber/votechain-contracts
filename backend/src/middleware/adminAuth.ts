import { Request, Response, NextFunction } from "express";
import { logAdminAction } from "./auditLogger";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-admin-key"];
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    return res.status(500).json({
      error: "SERVER_MISCONFIGURED",
      message: "Admin key is not configured on the server",
    });
  }

  if (!key || key !== expected) {
    logAdminAction({
      actor: "unknown",
      action: "AUTH_FAILURE",
      endpoint: req.path,
      method: req.method,
      statusCode: 403,
    });
    return res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
  }

  logAdminAction({
    actor: "admin",
    action: "AUTH_SUCCESS",
    endpoint: req.path,
    method: req.method,
    statusCode: 200,
  });

  next();
}

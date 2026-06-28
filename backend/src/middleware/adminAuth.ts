import { Request, Response, NextFunction } from "express";

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
    return res.status(403).json({
      error: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  next();
}

import { Response } from "express";
import { ApiError, ApiMeta, ApiResponse } from "../types";

export function sendSuccess<T>(res: Response, data: T, meta?: ApiMeta, status = 200): void {
  const body: ApiResponse<T> = { data, errors: null, meta: meta ?? null };
  res.status(status).json(body);
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  const body: ApiResponse<null> = { data: null, errors: [{ code, message }], meta: null };
  res.status(status).json(body);
}

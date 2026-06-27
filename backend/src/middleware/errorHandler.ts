import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly messages: string[];

  constructor(messages: string[]) {
    super("Validation Failed", 400);
    this.messages = messages;
  }
}

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  // Log error details
  if (statusCode === 500) {
    console.error("[Internal Server Error]", err);
  } else {
    console.warn(`[API Error] ${statusCode}:`, err.message);
  }

  // Consistent API error response shape
  const response: Record<string, any> = {
    status: "error",
    message: isOperational || statusCode !== 500 ? err.message : "Internal Server Error",
  };

  // Include structured validation errors if they exist
  if (err instanceof ValidationError) {
    response.messages = err.messages;
  } else if (err.messages) {
    response.messages = err.messages;
  }

  res.status(statusCode).json(response);
}

import type { Request, Response, NextFunction } from "express";

/** Uniform, structured error envelope for the whole API. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Mongoose throws a CastError for a malformed ObjectId (e.g. a stale or
  // hand-typed URL) — that's a client input problem, not a server fault,
  // so it should surface as a clean 404 rather than a raw 500.
  if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "CastError") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "The requested resource could not be found." } });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on our end." } });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

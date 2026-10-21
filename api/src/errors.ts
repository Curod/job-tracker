import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", issues: err.issues });
    return;
  }

  if ((err as { type?: string })?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
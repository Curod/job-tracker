import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";
import { findSessionUser, SESSION_COOKIE } from "./sessions.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") throw new HttpError(401, "Not authenticated");

  const user = await findSessionUser(token);
  if (!user) throw new HttpError(401, "Not authenticated");

  req.user = user;
  next();
}

export function currentUser(req: Request) {
  if (!req.user) throw new Error("currentUser() used on a route without requireAuth");
  return req.user;
}
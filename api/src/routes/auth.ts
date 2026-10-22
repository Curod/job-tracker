import { Router } from "express";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { currentUser, requireAuth } from "../auth/middleware.js";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../auth/sessions.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "../http.js";

const email = z.string().trim().toLowerCase().pipe(z.email().max(320));

const signupInput = z.object({
  email,
  password: z.string().min(8).max(128),
});

const loginInput = z.object({
  email,
  password: z.string().min(1).max(128),
});

const publicUser = { id: users.id, email: users.email, createdAt: users.createdAt };

let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= argon2.hash("not-a-real-password");
  return dummyHash;
}

async function insertUser(email: string, passwordHash: string) {
  try {
    const [user] = await db.insert(users).values({ email, passwordHash }).returning(publicUser);
    return user;
  } catch (err) {
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(409, "Email is already registered");
    }
    throw err;
  }
}

export const authRouter = Router();

authRouter.post("/auth/signup", async (req, res) => {
  const { email, password } = signupInput.parse(req.body);
  const user = await insertUser(email, await argon2.hash(password));

  await createSession(res, user.id);
  res.status(201).json(user);
});

authRouter.post("/auth/login", async (req, res) => {
  const { email, password } = loginInput.parse(req.body);

  const [user] = await db
    .select({ ...publicUser, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));

  const passwordOk = await argon2.verify(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !passwordOk) throw new HttpError(401, "Invalid email or password");

  await createSession(res, user.id);
  res.json({ id: user.id, email: user.email, createdAt: user.createdAt });
});

authRouter.post("/auth/logout", async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string") await deleteSession(token);

  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  res.json(currentUser(req));
});
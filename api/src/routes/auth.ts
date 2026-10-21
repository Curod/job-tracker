import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "../http.js";

const signupInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  password: z.string().min(8).max(128),
});

export const authRouter = Router();

authRouter.post("/auth/signup", async (req, res) => {
  const { email, password } = signupInput.parse(req.body);
  const passwordHash = await argon2.hash(password);

  try {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt });

    res.status(201).json(user);
  } catch (err) {
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
      throw new HttpError(409, "Email is already registered");
    }
    throw err;
  }
});